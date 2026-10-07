"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, CardId, Suit } from "@/game/cards";
import { shaped } from "@/game/covenants";
import type { DeckId } from "@/game/decks";
import type { LeafContents } from "@/game/leaves";
import type { HandName } from "@/game/hands";
import { renumber, type Rite, workRite } from "@/game/rites";
import { preview, resolve, type Resolution, type ScoreEvent } from "@/game/score";
import { CHAPTERS, SEAL_ORDER } from "@/game/seals";
import {
  addCard,
  addSigil,
  advance,
  canRefuse,
  cardsLeft,
  deal,
  HAND_SIZE,
  MAX_SELECT,
  newRun,
  type Offer,
  payoutFor,
  raiseHand,
  refuse,
  reorder,
  reroll,
  rollShop,
  type RoundState,
  type RunState,
  sealKind,
  sell,
  setDeck,
  type Shop,
  signCovenant,
  sigilsOf,
  spend,
  startSeal,
} from "@/game/run";
import type { Sigil } from "@/game/sigils";
import { sfx } from "./audio";
import { haptic } from "./device";
import { reportRun, type Unlocked } from "./casino";

/**
 * The run, and the clock that walks it.
 *
 * Every number this hook reports has already been decided by the engine; what
 * it adds is time. A hand is resolved in full the moment it is played, and the
 * result is then released one beat at a time so the table can show the
 * arithmetic happening. Nothing here can change an outcome — if it could, the
 * animation would be the game, and the game would be the animation.
 */

const SAVE_KEY = "grimoire:run";

/**
 * The clock.
 *
 * Deliberately unhurried. The scoring beat is the one number that decides
 * whether a hand reads as arithmetic you can follow or as a fruit machine, and
 * it is better slow than clever.
 */
const BEAT_MS = 560;
const DEAL_STAGGER_MS = 95;
const SETTLE_MS = 1300;
const TALLY_HOLD_MS = 2100;

export type Phase = "choosing" | "dealing" | "picking" | "scoring" | "tallied" | "broken" | "shop" | "over" | "won";

/** A leaf that has been bought and is open on the table. */
export interface OpenLeaf {
  offer: Offer;
  contents: LeafContents;
  /** Set once a rite has been picked and is waiting for the cards to work on. */
  rite?: Rite;
}

interface Saved {
  run: RunState;
  round: RoundState | null;
  phase: Phase;
  shop: Shop | null;
}

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function store(saved: Saved) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Storage blocked: the run lasts for this page view only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing stored.
  }
}

const FINISHED_KEY = "grimoire:finished";

export function finishedDecks(): DeckId[] {
  try {
    return JSON.parse(window.localStorage.getItem(FINISHED_KEY) ?? "[]") as DeckId[];
  } catch {
    return [];
  }
}

function recordFinish(deck: DeckId): void {
  try {
    window.localStorage.setItem(FINISHED_KEY, JSON.stringify([...new Set([...finishedDecks(), deck])]));
  } catch {
    // Nothing stored.
  }
}

export interface Beat {
  event: ScoreEvent;
  key: string;
}

export function useRun(initial?: { deck: DeckId; seed?: string }) {
  const [run, setRun] = useState<RunState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [phase, setPhase] = useState<Phase>("choosing");
  const [shop, setShop] = useState<Shop | null>(null);
  const [leaf, setLeaf] = useState<OpenLeaf | null>(null);
  const [dealt, setDealt] = useState<Record<CardId, number>>({});
  const [beat, setBeat] = useState<Beat | null>(null);
  const [running, setRunning] = useState<{ points: number; mult: number } | null>(null);
  const [tally, setTally] = useState<Resolution | null>(null);
  const [unlocked, setUnlocked] = useState<Unlocked[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 3600);
    return () => window.clearTimeout(timer);
  }, [note]);

  // Start: resume what was saved, or begin the binding we were sent here with.
  useEffect(() => {
    const saved = load();
    if (saved?.run && !initial) {
      setRun(saved.run);
      setRound(saved.round);
      setShop(saved.shop);
      setPhase(saved.phase === "scoring" || saved.phase === "dealing" ? "picking" : saved.phase);
      return;
    }
    setRun(newRun(initial?.deck ?? "plain", initial?.seed));
    setPhase("choosing");
    // Only ever on mount: a run is opened once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!run) return;
    if (phase === "scoring" || phase === "dealing") return;
    store({ run, round, phase, shop });
  }, [run, round, phase, shop]);

  const sigils = useMemo(() => (run ? sigilsOf(run) : []), [run]);
  const byId = useMemo(() => new Map((run?.cards ?? []).map((card) => [card.id, card])), [run]);

  const inHand = useMemo(() => {
    if (!run || !round) return [];
    return run.cards.filter((card) => round.zone[card.id] === "hand");
  }, [run, round]);

  const selected = useMemo(
    () => (round ? (round.selected.map((id) => byId.get(id)).filter(Boolean) as Card[]) : []),
    [round, byId],
  );

  const look = useMemo(() => {
    if (!round || !selected.length) return null;
    return preview({
      played: selected,
      sigils,
      handsLeft: round.hands,
      discardsLeft: round.discards,
      handNumber: round.handNumber,
      warden: round.warden,
      levels: run?.levels,
    });
  }, [round, selected, sigils, run?.levels]);

  /** Opens the chosen seal and deals the first hand. */
  const openSeal = useCallback(
    (state: RunState) => {
      const started = startSeal(state);
      const handed = deal(started.round, HAND_SIZE + shaped(state.covenants).handSize);
      const delays: Record<CardId, number> = {};
      handed.dealt.forEach((id, i) => (delays[id] = i * DEAL_STAGGER_MS));
      setRun(started.run);
      setRound(handed.round);
      setDealt(delays);
      setPhase("dealing");
      setBeat(null);
      setRunning(null);
      setTally(null);
      sfx.deal();
      after(SETTLE_MS, () => {
        setDealt({});
        setPhase("picking");
      });
    },
    [after],
  );

  const chooseSeal = useCallback(() => {
    if (!run) return;
    sfx.press();
    openSeal(run);
  }, [run, openSeal]);

  /** Walks away from a seal and takes a token instead. */
  const refuseSeal = useCallback(() => {
    if (!run || !canRefuse(run)) return;
    const { run: moved, token } = refuse(run);
    sfx.token();
    setRun(moved);
    setNote(token === "ink" ? "Five ink, taken on the spot." : "Taken. It is spent at the next shop.");
  }, [run]);

  const toggle = useCallback(
    (id: CardId) => {
      if (phase !== "picking") return;
      setRound((current) => {
        if (!current || current.zone[id] !== "hand") return current;
        const has = current.selected.includes(id);
        if (!has && current.selected.length >= MAX_SELECT) return current;
        sfx.tap();
        haptic.tap();
        return { ...current, selected: has ? current.selected.filter((x) => x !== id) : [...current.selected, id] };
      });
    },
    [phase],
  );

  const play = useCallback(() => {
    if (!run || !round || phase !== "picking" || !round.selected.length || round.hands <= 0) return;
    const played = inHand.filter((card) => round.selected.includes(card.id));
    const resolution = resolve({
      played,
      sigils,
      handsLeft: round.hands - 1,
      discardsLeft: round.discards,
      handNumber: round.handNumber,
      warden: round.warden,
      levels: run.levels,
    });
    if (!resolution) return;

    const zone = { ...round.zone };
    played.forEach((card) => (zone[card.id] = "play"));
    // Laid out as the hand it is, so the pops run along something readable.
    setRound({ ...round, zone, selected: [], playing: resolution.arranged.map((card) => card.id) });
    setPhase("scoring");
    setRunning({ points: 0, mult: 0 });
    sfx.play();
    haptic.knock();

    let t = 760;
    resolution.events.forEach((event, i) => {
      after(t, () => {
        setBeat({ event, key: `${i}-${event.cardId ?? event.sigilId}` });
        setRunning({ points: event.points, mult: event.mult });
        if (event.kind === "points") sfx.point(i);
        else sfx.mult(i);
      });
      t += BEAT_MS;
    });

    after(t + 200, () => {
      setBeat(null);
      setTally(resolution);
      setRound((current) => (current ? { ...current, score: current.score + resolution.total } : current));
      sfx.total();
      setPhase("tallied");
    });

    after(t + TALLY_HOLD_MS, () => {
      setTally(null);
      setRound((current) => {
        if (!current) return current;
        const gone = { ...current.zone };
        played.forEach((card) => (gone[card.id] = "gone"));
        return { ...current, zone: gone, hands: current.hands - 1, handNumber: current.handNumber + 1 };
      });
      after(480, () => {
        setRound((current) => {
          if (!current || !run) return current;
          if (current.score >= current.quota) {
            sfx.win();
            haptic.win();
            setPhase("broken");
            return current;
          }
          if (current.hands <= 0 || cardsLeft(current) === 0) {
            sfx.lose();
            setPhase("over");
            void reportRun({ deck: run.deck, seed: run.seed, chapter: run.chapter, won: false, sigils: run.sigils });
            return current;
          }
          const handed = deal(current, played.length);
          const delays: Record<CardId, number> = {};
          handed.dealt.forEach((id, i) => (delays[id] = i * DEAL_STAGGER_MS));
          setDealt(delays);
          sfx.deal();
          after(SETTLE_MS, () => setDealt({}));
          setPhase("picking");
          return handed.round;
        });
      });
    });
  }, [run, round, phase, inHand, sigils, after]);

  const discard = useCallback(() => {
    if (!round || phase !== "picking" || !round.selected.length || round.discards <= 0) return;
    const count = round.selected.length;
    const zone = { ...round.zone };
    round.selected.forEach((id) => (zone[id] = "gone"));
    setRound({ ...round, zone, selected: [], discards: round.discards - 1 });
    setPhase("scoring");
    sfx.discard();
    after(560, () => {
      setRound((current) => {
        if (!current) return current;
        if (cardsLeft(current) === 0 && current.hands > 0) {
          setPhase("picking");
          return current;
        }
        const handed = deal(current, count);
        const delays: Record<CardId, number> = {};
        handed.dealt.forEach((id, i) => (delays[id] = i * DEAL_STAGGER_MS));
        setDealt(delays);
        sfx.deal();
        after(SETTLE_MS, () => setDealt({}));
        setPhase("picking");
        return handed.round;
      });
    });
  }, [round, phase, after]);

  const payout = useMemo(() => (run && round ? payoutFor(run, round) : null), [run, round]);

  const collect = useCallback(() => {
    if (!run || !round || !payout) return;
    sfx.coin();
    const moved = advance(run, payout.total);
    if (moved.won) {
      recordFinish(moved.deck);
      setRun(moved);
      setPhase("won");
      void reportRun({ deck: moved.deck, seed: moved.seed, chapter: moved.chapter, won: true, sigils: moved.sigils }).then(setUnlocked);
      return;
    }
    const rolled = rollShop(moved);
    setRun(rolled.run);
    setShop(rolled.shop);
    setPhase("shop");
  }, [run, round, payout]);

  /** Leaves the shop, back to choosing the next seal. */
  const leaveShop = useCallback(() => {
    sfx.press();
    setShop(null);
    setLeaf(null);
    setRound(null);
    setPhase("choosing");
  }, []);

  // ── Buying ────────────────────────────────────

  const buyOffer = useCallback(
    (offer: Offer) => {
      if (!run || !shop) return;
      const paid = spend(run, shop, offer);
      sfx.coin();

      if (offer.kind === "sigil" && offer.sigil) {
        setRun(addSigil(paid.run, offer.sigil));
        setShop(paid.shop);
        return;
      }
      if (offer.kind === "covenant" && offer.covenant) {
        setRun(signCovenant(paid.run, offer.covenant));
        setShop(paid.shop);
        setNote(`Signed: ${offer.covenant.name.toLowerCase()}.`);
        return;
      }
      if (offer.kind === "leaf" && offer.contents) {
        setRun(paid.run);
        setShop(paid.shop);
        setLeaf({ offer, contents: offer.contents });
        sfx.open();
      }
    },
    [run, shop],
  );

  const closeLeaf = useCallback(() => setLeaf(null), []);

  /** Keeps one thing out of an open leaf. A rite keeps the leaf open for its cards. */
  const keepFromLeaf = useCallback(
    (choice: { sigil?: Sigil; card?: Card; rite?: Rite; verse?: HandName }) => {
      if (!run || !leaf) return;
      if (choice.sigil) {
        setRun(addSigil(run, choice.sigil));
        setLeaf(null);
        sfx.press();
        return;
      }
      if (choice.card) {
        setRun(addCard(run, choice.card));
        setLeaf(null);
        sfx.press();
        return;
      }
      if (choice.verse) {
        setRun(raiseHand(run, choice.verse));
        setNote(`${choice.verse} raised to level ${Math.max(1, run.levels[choice.verse] ?? 1) + 1}.`);
        setLeaf(null);
        sfx.rite();
        return;
      }
      if (choice.rite) {
        setLeaf({ ...leaf, rite: choice.rite });
        sfx.tap();
      }
    },
    [run, leaf],
  );

  /** Works the chosen rite on the chosen cards. */
  const applyRite = useCallback(
    (cards: readonly string[], suit?: Suit) => {
      if (!run || !leaf?.rite) return;
      const worked = renumber(workRite(run.cards, leaf.rite, cards, suit));
      setRun(setDeck(run, worked));
      setNote(`${leaf.rite.name} worked on ${cards.length} card${cards.length === 1 ? "" : "s"}.`);
      setLeaf(null);
      sfx.rite();
    },
    [run, leaf],
  );

  const again = useCallback(() => {
    if (!run || !shop) return;
    const next = reroll(run, shop);
    if (!next) return;
    sfx.shuffle();
    setRun(next.run);
    setShop(next.shop);
  }, [run, shop]);

  const sellSigil = useCallback((index: number) => {
    sfx.coin();
    setRun((current) => (current ? sell(current, index) : current));
  }, []);

  const moveSigil = useCallback((from: number, to: number) => {
    sfx.tap();
    setRun((current) => (current ? reorder(current, from, to) : current));
  }, []);

  const restart = useCallback(
    (deck: DeckId) => {
      clearTimers();
      clearSave();
      setShop(null);
      setLeaf(null);
      setRound(null);
      setRun(newRun(deck));
      setPhase("choosing");
    },
    [clearTimers],
  );

  return {
    run,
    round,
    phase,
    shop,
    leaf,
    sigils,
    inHand,
    selected,
    look,
    dealt,
    beat,
    running,
    tally,
    payout,
    unlocked,
    note,
    deckLeft: round ? cardsLeft(round) : 0,
    chapters: CHAPTERS,
    seals: SEAL_ORDER.length,
    kind: run ? sealKind(run) : ("lesser" as const),
    canRefuse: run ? canRefuse(run) : false,
    chooseSeal,
    refuseSeal,
    toggle,
    play,
    discard,
    collect,
    leaveShop,
    buyOffer,
    closeLeaf,
    keepFromLeaf,
    applyRite,
    again,
    sellSigil,
    moveSigil,
    restart,
  };
}
