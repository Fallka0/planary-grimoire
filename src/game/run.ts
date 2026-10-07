/**
 * A run: eight chapters, three seals each, and a shop between every one.
 *
 * The run is one seed. Everything it draws — the shuffle, what the shop
 * stocks, which suit The Hollow names — comes out of that one stream, so a
 * seed replays exactly and two players on the same seed are playing the same
 * book. The seed is drawn from the platform's cryptographic generator, so a
 * fresh run cannot be predicted; once drawn, it is a fixed story you are
 * discovering rather than one being written as you go.
 */

import { type Card, type CardId } from "./cards";
import type { HandLevels, HandName } from "./hands";
import { COVENANTS, type Covenant, type CovenantId, shaped } from "./covenants";
import { buildDeck, DECK_BY_ID, type Deck, type DeckId } from "./decks";
import { fillLeaf, LEAF_KINDS, type LeafContents, type LeafKind } from "./leaves";
import { newSeed, Rng } from "./rng";
import { CHAPTERS, discardsUnder, handsUnder, quotaFor, SEAL_ORDER, SEAL_REWARD, type SealKind, wardenFor, type WardenRule } from "./seals";
import { SIGIL_BY_ID, SIGILS, type Sigil, TIER_WEIGHT } from "./sigils";
import { TOKENS, type TokenId } from "./tokens";

export const HAND_SIZE = 8;
/** The most cards one hand can hold. */
export const MAX_SELECT = 5;
/** Ink earned for every five kept. The cap is a covenant's to move. */
const INTEREST_PER = 5;

export type Zone = "deck" | "hand" | "play" | "gone";

export interface RunState {
  seed: string;
  deck: DeckId;
  chapter: number;
  /** Index into SEAL_ORDER. */
  seal: number;
  ink: number;
  slots: number;
  /** Sigil ids, in the order they sit in the book. Order changes what they are worth. */
  sigils: string[];
  /** The run's own deck, which packs can add to. */
  cards: Card[];
  /** Where the run's stream stands, so a saved run resumes without repeating itself. */
  cursor: number;
  /** Every sigil this player has ever seen, for the collection. */
  seen: string[];
  /** How far each hand has been raised. Anything absent is still at one. */
  levels: HandLevels;
  /** Standing agreements, kept for the rest of the run. */
  covenants: CovenantId[];
  /** Tokens taken for refusing a seal, spent on the next shop. */
  tokens: TokenId[];
  /** Which seals of this chapter were refused, so they are not offered twice. */
  refused: number[];
  /** True once the eighth warden is broken. */
  won: boolean;
}

export interface RoundState {
  quota: number;
  score: number;
  hands: number;
  discards: number;
  /** Which hand of this seal is being played, counting from one. */
  handNumber: number;
  warden: WardenRule | null;
  zone: Record<CardId, Zone>;
  /** The shuffled order the deck is dealt in. */
  order: CardId[];
  ptr: number;
  selected: CardId[];
  /** The hand currently on the table, in played order. */
  playing: CardId[];
}

export function deckOf(run: RunState): Deck {
  return DECK_BY_ID.get(run.deck)!;
}

export function sealKind(run: RunState): SealKind {
  return SEAL_ORDER[run.seal];
}

export function sigilsOf(run: RunState): Sigil[] {
  return run.sigils.map((id) => SIGIL_BY_ID.get(id)).filter((s): s is Sigil => Boolean(s));
}

export function newRun(deckId: DeckId, seed = newSeed()): RunState {
  const deck = DECK_BY_ID.get(deckId)!;
  const rng = new Rng(seed);
  return {
    seed,
    deck: deckId,
    chapter: 1,
    seal: 0,
    ink: deck.ink_,
    slots: deck.slots,
    sigils: [],
    cards: buildDeck(deck),
    cursor: rng.cursor,
    seen: [],
    levels: {},
    covenants: [],
    tokens: [],
    refused: [],
    won: false,
  };
}

/**
 * Opens the next seal.
 *
 * The warden's choices — which suit The Hollow names — are made here, from the
 * run's stream, so they are part of the seed rather than of the moment.
 */
export function startSeal(run: RunState): { run: RunState; round: RoundState } {
  const rng = Rng.resume(run.cursor);
  const kind = sealKind(run);
  const deck = deckOf(run);

  let warden: WardenRule | null = null;
  if (kind === "warden") {
    const which = wardenFor(run.chapter);
    warden = { id: which.id, suit: which.id === "hollow" ? rng.pick(["S", "H", "D", "C"] as const) : undefined };
  }

  const order = rng.shuffled(run.cards.map((card) => card.id));
  const zone: Record<CardId, Zone> = {};
  for (const card of run.cards) zone[card.id] = "deck";

  const extra = shaped(run.covenants);
  return {
    run: { ...run, cursor: rng.cursor },
    round: {
      quota: quotaFor(run.chapter, kind),
      score: 0,
      hands: handsUnder(warden, deck.hands + extra.hands),
      discards: discardsUnder(warden, deck.discards + extra.discards),
      handNumber: 1,
      warden,
      zone,
      order,
      ptr: 0,
      selected: [],
      playing: [],
    },
  };
}

/** Deals `count` cards into the hand, and says which arrived so they can be staggered. */
export function deal(round: RoundState, count: number): { round: RoundState; dealt: CardId[] } {
  const zone = { ...round.zone };
  const dealt: CardId[] = [];
  let ptr = round.ptr;
  while (dealt.length < count && ptr < round.order.length) {
    const id = round.order[ptr++];
    zone[id] = "hand";
    dealt.push(id);
  }
  return { round: { ...round, zone, ptr }, dealt };
}

export function cardsLeft(round: RoundState): number {
  return round.order.length - round.ptr;
}

// ── Breaking a seal ───────────────────────────────────

export interface Payout {
  seal: number;
  hands: number;
  interest: number;
  total: number;
}

/**
 * What a broken seal pays.
 *
 * Interest is the quiet lesson: ink kept earns ink, so the shop is not only a
 * question of what to buy but of when to stop. It is capped, or a player who
 * never buys anything would out-earn one who plays.
 */
export function payoutFor(run: RunState, round: RoundState): Payout {
  const seal = SEAL_REWARD[sealKind(run)];
  const hands = Math.max(0, round.hands);
  const interest = Math.min(shaped(run.covenants).interestCap, Math.floor(run.ink / INTEREST_PER));
  return { seal, hands, interest, total: seal + hands + interest };
}

/** Moves the run on to the next seal, or to the end of the book. */
export function advance(run: RunState, payout: number): RunState {
  const next = { ...run, ink: run.ink + payout };
  if (run.seal < SEAL_ORDER.length - 1) return { ...next, seal: run.seal + 1 };
  if (run.chapter >= CHAPTERS) return { ...next, won: true };
  // A new chapter forgets which seals were refused in the last one.
  return { ...next, chapter: run.chapter + 1, seal: 0, refused: [] };
}

/** True when this seal may be walked away from. A warden may not. */
export function canRefuse(run: RunState): boolean {
  return sealKind(run) !== "warden";
}

/**
 * Refuses a seal and takes a token instead.
 *
 * No ink changes hands — that is the cost — and the run moves straight to the
 * next seal of the chapter. The token is drawn from the run's stream, so the
 * reward for walking away was decided with everything else.
 */
export function refuse(run: RunState): { run: RunState; token: TokenId } {
  const rng = Rng.resume(run.cursor);
  const token = rng.pick(TOKENS).id;
  const moved = {
    ...run,
    cursor: rng.cursor,
    tokens: [...run.tokens, token],
    refused: [...run.refused, run.seal],
    seal: Math.min(SEAL_ORDER.length - 1, run.seal + 1),
    // The ink token is the one that pays now rather than at the shop.
    ink: run.ink + (token === "ink" ? 5 : 0),
  };
  return { run: moved, token };
}

// ── The shop ──────────────────────────────────────────

export type OfferKind = "sigil" | "leaf" | "covenant";

export interface Offer {
  key: string;
  kind: OfferKind;
  price: number;
  name: string;
  note: string;
  sold: boolean;
  /** A sigil offer. */
  sigil?: Sigil;
  /** A leaf offer: the kind, and what is inside once it is opened. */
  leaf?: LeafKind;
  contents?: LeafContents;
  /** A covenant offer. */
  covenant?: Covenant;
}

export interface Shop {
  /** The two (or three) sigils along the top. */
  sigils: Offer[];
  /** The covenant on the lower left, one a chapter. */
  covenant: Offer | null;
  /** The leaves on the lower right. */
  leaves: Offer[];
  rerolls: number;
  /** A free restock owed by a thrift token. */
  freeReroll: boolean;
}

export function rerollCost(run: RunState, shop: Shop): number {
  if (shop.freeReroll) return 0;
  return Math.max(1, 2 + shop.rerolls - shaped(run.covenants).rerollOff);
}

export function allOffers(shop: Shop): Offer[] {
  return [...shop.sigils, ...(shop.covenant ? [shop.covenant] : []), ...shop.leaves];
}

/**
 * Stocks the shop.
 *
 * Two sigils along the top, one covenant and two leaves below — the covenant
 * only once a chapter, because its whole weight comes from being the thing you
 * can only have one of. Tokens taken for refusing a seal are spent here, which
 * is why they are read before anything is priced.
 */
export function rollShop(run: RunState): { run: RunState; shop: Shop } {
  const rng = Rng.resume(run.cursor);
  const extra = shaped(run.covenants);
  const tokens = run.tokens;

  const held = new Set(run.sigils);
  const pool = SIGILS.filter((sigil) => !held.has(sigil.id));
  const take = (n: number) => {
    const picked: Sigil[] = [];
    const left = [...pool];
    for (let i = 0; i < n && left.length; i++) {
      const sigil = rng.weighted(left, (s) => TIER_WEIGHT[s.tier]);
      picked.push(sigil);
      left.splice(left.indexOf(sigil), 1);
    }
    return picked;
  };

  const forSale = take(2 + extra.shopSigils);
  const sigils: Offer[] = forSale.map((sigil, i) => ({
    key: `s${i}`,
    kind: "sigil" as const,
    // A sigil token makes the first one free.
    price: i === 0 && tokens.includes("sigil") ? 0 : sigil.price,
    sigil,
    name: sigil.name,
    note: sigil.note,
    sold: false,
  }));

  // One covenant a chapter, and never one already signed.
  const open = COVENANTS.filter((c) => !run.covenants.includes(c.id));
  const wantsCovenant = run.seal === 0 || tokens.includes("covenant");
  const covenant: Offer | null =
    open.length && wantsCovenant
      ? (() => {
          const pick = rng.pick(open);
          return { key: "c", kind: "covenant" as const, price: pick.price, covenant: pick, name: pick.name, note: pick.note, sold: false };
        })()
      : null;

  const leafCount = 2 + (tokens.includes("leaf") ? 1 : 0);
  const leaves: Offer[] = Array.from({ length: leafCount }, (_, i) => {
    const spec = rng.pick(LEAF_KINDS);
    return {
      key: `l${i}`,
      kind: "leaf" as const,
      price: i === leafCount - 1 && tokens.includes("leaf") ? 0 : spec.price,
      leaf: spec.kind,
      contents: fillLeaf(spec.kind, rng, run.sigils),
      name: spec.name,
      note: spec.note,
      sold: false,
    };
  });

  return {
    run: { ...run, cursor: rng.cursor, tokens: [] },
    shop: { sigils, covenant, leaves, rerolls: 0, freeReroll: tokens.includes("cheap") },
  };
}

export function reroll(run: RunState, shop: Shop): { run: RunState; shop: Shop } | null {
  const cost = rerollCost(run, shop);
  if (run.ink < cost) return null;
  // A restock keeps the covenant: it is the chapter's, not the roll's.
  const rolled = rollShop({ ...run, ink: run.ink - cost, tokens: [] });
  return {
    run: rolled.run,
    shop: { ...rolled.shop, covenant: shop.covenant, rerolls: shop.rerolls + 1, freeReroll: false },
  };
}

/** True when there is room in the book and ink in the pocket. */
export function canBuy(run: RunState, offer: Offer): boolean {
  if (offer.sold || run.ink < offer.price) return false;
  if (offer.kind === "sigil") return run.sigils.length < run.slots;
  return true;
}

/** Marks an offer taken and spends the ink. What it gives back is the caller's. */
export function spend(run: RunState, shop: Shop, offer: Offer): { run: RunState; shop: Shop } {
  const mark = (list: Offer[]) => list.map((o) => (o.key === offer.key ? { ...o, sold: true } : o));
  return {
    run: { ...run, ink: run.ink - offer.price },
    shop: {
      ...shop,
      sigils: mark(shop.sigils),
      leaves: mark(shop.leaves),
      covenant: shop.covenant && shop.covenant.key === offer.key ? { ...shop.covenant, sold: true } : shop.covenant,
    },
  };
}

/** Writes a sigil into the book. */
export function addSigil(run: RunState, sigil: Sigil): RunState {
  if (run.sigils.length >= run.slots) return run;
  return {
    ...run,
    sigils: [...run.sigils, sigil.id],
    seen: run.seen.includes(sigil.id) ? run.seen : [...run.seen, sigil.id],
  };
}

/** Signs a covenant, and applies the room it buys straight away. */
export function signCovenant(run: RunState, covenant: Covenant): RunState {
  const next = { ...run, covenants: [...run.covenants, covenant.id] };
  return covenant.id === "spine" ? { ...next, slots: next.slots + 1 } : next;
}

/** Adds a card to the run's deck. */
export function addCard(run: RunState, card: Card): RunState {
  return { ...run, cards: [...run.cards, card] };
}

/** Raises a hand a level, for the rest of the run. */
export function raiseHand(run: RunState, name: HandName): RunState {
  return { ...run, levels: { ...run.levels, [name]: Math.max(1, run.levels[name] ?? 1) + 1 } };
}

/** Replaces the deck wholesale, after a rite has been worked on it. */
export function setDeck(run: RunState, cards: Card[]): RunState {
  return { ...run, cards };
}

/** Sells a sigil back for half its price, rounded down, and never less than one. */
export function sell(run: RunState, index: number): RunState {
  const sigil = SIGIL_BY_ID.get(run.sigils[index]);
  if (!sigil) return run;
  return { ...run, ink: run.ink + Math.max(1, Math.floor(sigil.price / 2)), sigils: run.sigils.filter((_, i) => i !== index) };
}

/** Moves a sigil along the book. Order decides what the multipliers are worth. */
export function reorder(run: RunState, from: number, to: number): RunState {
  const sigils = [...run.sigils];
  const [moved] = sigils.splice(from, 1);
  sigils.splice(Math.max(0, Math.min(sigils.length, to)), 0, moved);
  return { ...run, sigils };
}
