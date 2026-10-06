"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, CardId } from "@/game/cards";
import type { DeckId } from "@/game/decks";
import { preview, resolve, type Resolution, type ScoreEvent } from "@/game/score";
import { CHAPTERS, SEAL_ORDER } from "@/game/seals";
import {
  advance,
  buy,
  cardsLeft,
  deal,
  HAND_SIZE,
  MAX_SELECT,
  newRun,
  type Offer,
  payoutFor,
  reorder,
  reroll,
  rollShop,
  type RoundState,
  type RunState,
  sealKind,
  sell,
  type Shop,
  sigilsOf,
  startSeal,
} from "@/game/run";
import type { Sigil } from "@/game/sigils";
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

/** One beat of the scoring sequence, and how long a card takes to settle. */
const BEAT_MS = 430;
const DEAL_STAGGER_MS = 70;
const SETTLE_MS = 1100;

export type Phase = "dealing" | "picking" | "scoring" | "tallied" | "broken" | "spent" | "shop" | "over" | "won";

interface Saved {
  run: RunState;
  round: RoundState;
  phase: Phase;
  shop: Shop | null;
  finished: DeckId[];
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

/** Decks finished at least once, kept apart from the run so it survives losing. */
const FINISHED_KEY = "grimoire:finished";

export function finishedDecks(): DeckId[] {
  try {
    return JSON.parse(window.localStorage.getItem(FINISHED_KEY) ?? "[]") as DeckId[];
  } catch {
    return [];
  }
}

function recordFinish(deck: DeckId): DeckId[] {
  const all = [...new Set([...finishedDecks(), deck])];
  try {
    window.localStorage.setItem(FINISHED_KEY, JSON.stringify(all));
  } catch {
    // Nothing stored.
  }
  return all;
}

export interface Beat {
  event: ScoreEvent;
  /** A key that changes every beat, so the pop can be re-triggered. */
  key: string;
}

export function useRun(initial?: { deck: DeckId; seed?: string }) {
  const [run, setRun] = useState<RunState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [phase, setPhase] = useState<Phase>("dealing");
  const [shop, setShop] = useState<Shop | null>(null);
  const [dealt, setDealt] = useState<Record<CardId, number>>({});
  const [beat, setBeat] = useState<Beat | null>(null);
  const [running, setRunning] = useState<{ points: number; mult: number } | null>(null);
  const [tally, setTally] = useState<Resolution | null>(null);
  /** Badges the casino handed back when the book was finished. */
  const [unlocked, setUnlocked] = useState<Unlocked[]>([]);
  const timers = useRef<number[]>([]);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  /** Opens a seal and deals the opening hand. */
  const open = useCallback(
    (state: RunState) => {
      const started = startSeal(state);
      const handed = deal(started.round, HAND_SIZE);
      const delays: Record<CardId, number> = {};
      handed.dealt.forEach((id, i) => (delays[id] = i * DEAL_STAGGER_MS));
      setRun(started.run);
      setRound(handed.round);
      setDealt(delays);
      setPhase("dealing");
      setBeat(null);
      setRunning(null);
      setTally(null);
      after(SETTLE_MS, () => {
        setDealt({});
        setPhase("picking");
      });
    },
    [after],
  );

  // Start: resume what was saved, or begin the deck we were sent here with.
  useEffect(() => {
    const saved = load();
    if (saved?.run && !initial) {
      setRun(saved.run);
      setRound(saved.round);
      setPhase(saved.phase === "scoring" || saved.phase === "dealing" ? "picking" : saved.phase);
      setShop(saved.shop);
      return;
    }
    open(newRun(initial?.deck ?? "plain", initial?.seed));
    // Only ever on mount: a run is opened once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save after every settled change, never mid-animation.
  useEffect(() => {
    if (!run || !round) return;
    if (phase === "scoring" || phase === "dealing") return;
    store({ run, round, phase, shop, finished: finishedDecks() });
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

  /** What the current selection would be named and based at. */
  const look = useMemo(() => {
    if (!round || !selected.length) return null;
    return preview({ played: selected, sigils, handsLeft: round.hands, discardsLeft: round.discards, handNumber: round.handNumber, warden: round.warden });
  }, [round, selected, sigils]);

  const toggle = useCallback(
    (id: CardId) => {
      if (phase !== "picking") return;
      setRound((current) => {
        if (!current || current.zone[id] !== "hand") return current;
        const has = current.selected.includes(id);
        if (!has && current.selected.length >= MAX_SELECT) return current;
        return { ...current, selected: has ? current.selected.filter((x) => x !== id) : [...current.selected, id] };
      });
    },
    [phase],
  );

  /**
   * Plays the selection.
   *
   * The whole hand is resolved here, once, before a single pixel moves. What
   * follows is replay: each event is released on its own beat, and the running
   * figures come straight off the event rather than being recomputed, so the
   * panel and the final total can never disagree.
   */
  const play = useCallback(() => {
    if (!run || !round || phase !== "picking" || !round.selected.length || round.hands <= 0) return;
    // In the order they sit in the hand, so the pops run left to right.
    const played = inHand.filter((card) => round.selected.includes(card.id));
    const resolution = resolve({
      played,
      sigils,
      handsLeft: round.hands - 1,
      discardsLeft: round.discards,
      handNumber: round.handNumber,
      warden: round.warden,
    });
    if (!resolution) return;

    const zone = { ...round.zone };
    played.forEach((card) => (zone[card.id] = "play"));
    setRound({ ...round, zone, selected: [], playing: played.map((card) => card.id) });
    setPhase("scoring");
    setRunning({ points: 0, mult: 0 });

    let t = 520;
    resolution.events.forEach((event, i) => {
      after(t, () => {
        setBeat({ event, key: `${i}-${event.cardId ?? event.sigilId}` });
        setRunning({ points: event.points, mult: event.mult });
      });
      t += BEAT_MS;
    });

    after(t + 120, () => {
      setBeat(null);
      setTally(resolution);
      setRound((current) => (current ? { ...current, score: current.score + resolution.total } : current));
      setPhase("tallied");
    });

    after(t + 1500, () => {
      setTally(null);
      setRound((current) => {
        if (!current) return current;
        const gone = { ...current.zone };
        played.forEach((card) => (gone[card.id] = "gone"));
        return { ...current, zone: gone, hands: current.hands - 1, handNumber: current.handNumber + 1 };
      });
      after(380, () => {
        setRound((current) => {
          if (!current || !run) return current;
          if (current.score >= current.quota) {
            setPhase("broken");
            return current;
          }
          if (current.hands <= 0 || cardsLeft(current) === 0) {
            setPhase("over");
            // How far the book got still earns its badges.
            void reportRun({ deck: run.deck, seed: run.seed, chapter: run.chapter, won: false, sigils: run.sigils });
            return current;
          }
          const handed = deal(current, played.length);
          const delays: Record<CardId, number> = {};
          handed.dealt.forEach((id, i) => (delays[id] = i * DEAL_STAGGER_MS));
          setDealt(delays);
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
    after(420, () => {
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
        after(SETTLE_MS, () => setDealt({}));
        setPhase("picking");
        return handed.round;
      });
    });
  }, [round, phase, after]);

  const payout = useMemo(() => (run && round ? payoutFor(run, round) : null), [run, round]);

  /** Takes the ink for a broken seal and opens the shop. */
  const collect = useCallback(() => {
    if (!run || !round || !payout) return;
    const moved = advance(run, payout.total);
    if (moved.won) {
      recordFinish(moved.deck);
      setRun(moved);
      setPhase("won");
      // The casino keeps the badges. It is told after the win is on screen,
      // never before: a slow network must not hold up the end of a run.
      void reportRun({ deck: moved.deck, seed: moved.seed, chapter: moved.chapter, won: true, sigils: moved.sigils }).then(setUnlocked);
      return;
    }
    const rolled = rollShop(moved);
    setRun(rolled.run);
    setShop(rolled.shop);
    setPhase("shop");
  }, [run, round, payout]);

  const leaveShop = useCallback(() => {
    if (!run) return;
    setShop(null);
    open(run);
  }, [run, open]);

  const purchase = useCallback(
    (offer: Offer, chosen?: Sigil) => {
      if (!run || !shop) return;
      const next = buy(run, shop, offer, chosen);
      setRun(next.run);
      setShop(next.shop);
    },
    [run, shop],
  );

  const again = useCallback(() => {
    if (!run || !shop) return;
    const next = reroll(run, shop);
    if (!next) return;
    setRun(next.run);
    setShop(next.shop);
  }, [run, shop]);

  const sellSigil = useCallback((index: number) => setRun((current) => (current ? sell(current, index) : current)), []);
  const moveSigil = useCallback((from: number, to: number) => setRun((current) => (current ? reorder(current, from, to) : current)), []);

  const restart = useCallback(
    (deck: DeckId) => {
      clearTimers();
      clearSave();
      setShop(null);
      open(newRun(deck));
    },
    [clearTimers, open],
  );

  return {
    run,
    round,
    phase,
    shop,
    unlocked,
    sigils,
    inHand,
    selected,
    look,
    dealt,
    beat,
    running,
    tally,
    payout,
    deckLeft: round ? cardsLeft(round) : 0,
    chapters: CHAPTERS,
    sealIndex: run?.seal ?? 0,
    seals: SEAL_ORDER.length,
    kind: run ? sealKind(run) : "lesser",
    toggle,
    play,
    discard,
    collect,
    leaveShop,
    purchase,
    again,
    sellSigil,
    moveSigil,
    restart,
  };
}
