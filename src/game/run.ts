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
import { buildDeck, DECK_BY_ID, type Deck, type DeckId } from "./decks";
import { newSeed, Rng } from "./rng";
import { CHAPTERS, discardsUnder, handsUnder, quotaFor, SEAL_ORDER, SEAL_REWARD, type SealKind, wardenFor, type WardenRule } from "./seals";
import { SIGIL_BY_ID, SIGILS, type Sigil, TIER_WEIGHT } from "./sigils";

export const HAND_SIZE = 8;
/** The most cards one hand can hold. */
export const MAX_SELECT = 5;
/** Ink earned for every five kept, and the most interest one seal can pay. */
const INTEREST_PER = 5;
const INTEREST_CAP = 5;

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

  return {
    run: { ...run, cursor: rng.cursor },
    round: {
      quota: quotaFor(run.chapter, kind),
      score: 0,
      hands: handsUnder(warden, deck.hands),
      discards: discardsUnder(warden, deck.discards),
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
  const interest = Math.min(INTEREST_CAP, Math.floor(run.ink / INTEREST_PER));
  return { seal, hands, interest, total: seal + hands + interest };
}

/** Moves the run on to the next seal, or to the end of the book. */
export function advance(run: RunState, payout: number): RunState {
  const next = { ...run, ink: run.ink + payout };
  if (run.seal < SEAL_ORDER.length - 1) return { ...next, seal: run.seal + 1 };
  if (run.chapter >= CHAPTERS) return { ...next, won: true };
  return { ...next, chapter: run.chapter + 1, seal: 0 };
}

// ── The shop ──────────────────────────────────────────

export type OfferKind = "sigil" | "pack" | "voucher";

export interface Offer {
  key: string;
  kind: OfferKind;
  price: number;
  /** For a sigil offer. */
  sigil?: Sigil;
  /** For a pack: the sigils it is holding. */
  choices?: Sigil[];
  name: string;
  note: string;
  sold: boolean;
}

export interface Shop {
  offers: Offer[];
  rerolls: number;
}

export function rerollCost(shop: Shop): number {
  return 2 + shop.rerolls;
}

/**
 * Stocks the shop.
 *
 * Two sigils, a pack and sometimes a voucher. Sigils already in the book are
 * never offered again — a shop that sells you what you own is a shop you stop
 * reading.
 */
export function rollShop(run: RunState): { run: RunState; shop: Shop } {
  const rng = Rng.resume(run.cursor);
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

  const forSale = take(2);
  const inPack = take(2);
  const offers: Offer[] = forSale.map((sigil, i) => ({
    key: `s${i}`,
    kind: "sigil" as const,
    price: sigil.price,
    sigil,
    name: sigil.name,
    note: sigil.note,
    sold: false,
  }));

  if (inPack.length) {
    offers.push({
      key: "pack",
      kind: "pack",
      price: 5,
      choices: inPack,
      name: "A sealed leaf",
      note: `Open it and keep one of ${inPack.length}.`,
      sold: false,
    });
  }

  // A voucher turns up now and then; a book with room in it is worth more than
  // anything that could go in the room.
  if (rng.float() < 0.34) {
    offers.push({
      key: "voucher",
      kind: "voucher",
      price: 10,
      name: "A wider spine",
      note: "One more slot in the book, for the rest of the run.",
      sold: false,
    });
  }

  return { run: { ...run, cursor: rng.cursor }, shop: { offers, rerolls: 0 } };
}

export function reroll(run: RunState, shop: Shop): { run: RunState; shop: Shop } | null {
  const cost = rerollCost(shop);
  if (run.ink < cost) return null;
  const rolled = rollShop({ ...run, ink: run.ink - cost });
  return { run: rolled.run, shop: { ...rolled.shop, rerolls: shop.rerolls + 1 } };
}

/** True when there is room in the book and ink in the pocket. */
export function canBuy(run: RunState, offer: Offer): boolean {
  if (offer.sold || run.ink < offer.price) return false;
  if (offer.kind === "sigil") return run.sigils.length < run.slots;
  if (offer.kind === "pack") return run.sigils.length < run.slots;
  return true;
}

export function buy(run: RunState, shop: Shop, offer: Offer, chosen?: Sigil): { run: RunState; shop: Shop } {
  const spent = { ...run, ink: run.ink - offer.price };
  const shut = { ...shop, offers: shop.offers.map((o) => (o.key === offer.key ? { ...o, sold: true } : o)) };

  if (offer.kind === "voucher") return { run: { ...spent, slots: spent.slots + 1 }, shop: shut };

  const sigil = offer.kind === "sigil" ? offer.sigil : chosen;
  if (!sigil) return { run: spent, shop: shut };
  return {
    run: { ...spent, sigils: [...spent.sigils, sigil.id], seen: spent.seen.includes(sigil.id) ? spent.seen : [...spent.seen, sigil.id] },
    shop: shut,
  };
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
