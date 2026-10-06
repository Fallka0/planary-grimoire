/**
 * Sigils — the marks in the book, and the only things that bend the rules.
 *
 * A sigil is behaviour hung off one of two moments in the scoring sequence:
 * `card`, which fires once for every card that scores, and `hand`, which fires
 * once after the cards are done. That is the whole interface. Everything a
 * sigil can do is add points, add multiplier, or multiply the multiplier — and
 * because the order of those three is fixed (see score.ts) a player can work
 * out the value of any combination without being told.
 *
 * The ordering rule worth knowing: sigils fire left to right, in the order
 * they sit in the book. A sigil that multiplies is worth more to the right of
 * one that adds, which makes arranging the book a real decision rather than
 * an inventory chore.
 */

import { isFace, type Card } from "./cards";
import type { HandName } from "./hands";

export type Tier = "Common" | "Uncommon" | "Rare" | "Legendary";

/** The art printed in the sigil's window. Each is drawn flat, in two inks. */
export type SigilArt = "num" | "chip" | "stack" | "backs" | "rings" | "eye" | "moon" | "key";

export interface Effect {
  points?: number;
  mult?: number;
  /** Multiplies the multiplier. Applied where it falls in the sequence. */
  times?: number;
}

export interface FireContext {
  /** Every card played, in played order. */
  played: Card[];
  /** The subset that scores. */
  scoring: Card[];
  hand: HandName;
  handsLeft: number;
  discardsLeft: number;
  /** How many sigils are in the book, including this one. */
  sigilCount: number;
  /** Which hand of the round this is, counting from one. */
  handNumber: number;
}

export interface Sigil {
  id: string;
  name: string;
  /** One sentence, in the words a player would use. */
  note: string;
  tier: Tier;
  /** Ink to buy one in the shop. */
  price: number;
  /** When it fires. */
  at: "card" | "hand";
  art: SigilArt;
  /** Set only for `num` art: the figure printed large in the window. */
  big?: string;
  field: string;
  ink: string;
  plate: string;
  /** Returns what it adds, or null when its condition is not met. */
  fire: (ctx: FireContext, card?: Card) => Effect | null;
}

const hearts = (cards: Card[]) => cards.filter((c) => c.suit === "H").length;

/**
 * The roster.
 *
 * Deliberately weighted toward conditions a player can see at a glance — a
 * suit, a face card, how many cards were played. A sigil whose condition needs
 * arithmetic to check is a sigil nobody builds around.
 */
export const SIGILS: Sigil[] = [
  // ── Common ────────────────────────────────────
  {
    id: "ember",
    name: "Ember",
    note: "+4 Mult on every hand.",
    tier: "Common",
    price: 4,
    at: "hand",
    art: "num",
    big: "+4",
    field: "#e8c7a2",
    ink: "#2a0710",
    plate: "#e0334f",
    fire: () => ({ mult: 4 }),
  },
  {
    id: "tinder",
    name: "Tinder",
    note: "+40 Points if the hand holds a pair.",
    tier: "Common",
    price: 4,
    at: "hand",
    art: "backs",
    field: "#ff5b2e",
    ink: "#2a0710",
    plate: "#f6eee4",
    fire: (ctx) => {
      const counts = new Map<string, number>();
      for (const card of ctx.played) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
      return [...counts.values()].some((n) => n >= 2) ? { points: 40 } : null;
    },
  },
  {
    id: "hearthstone",
    name: "Hearthstone",
    note: "+3 Mult for each heart that scores.",
    tier: "Common",
    price: 5,
    at: "hand",
    art: "chip",
    field: "#b3122e",
    ink: "#fbf1ea",
    plate: "#ff5a78",
    fire: (ctx) => (hearts(ctx.scoring) ? { mult: 3 * hearts(ctx.scoring) } : null),
  },
  {
    id: "chalk",
    name: "Chalk",
    note: "+9 Points for every card that scores.",
    tier: "Common",
    price: 4,
    at: "hand",
    art: "num",
    big: "+9",
    field: "#f6eee4",
    ink: "#22060e",
    plate: "#8ea4ff",
    fire: (ctx) => ({ points: 9 * ctx.scoring.length }),
  },
  {
    id: "hourglass",
    name: "Hourglass",
    note: "+25 Points for each hand you have left.",
    tier: "Common",
    price: 5,
    at: "hand",
    art: "rings",
    field: "#1d2a5c",
    ink: "#fbf1ea",
    plate: "#8ee6ff",
    fire: (ctx) => (ctx.handsLeft ? { points: 25 * ctx.handsLeft } : null),
  },

  // ── Uncommon ──────────────────────────────────
  {
    id: "loupe",
    name: "Loupe",
    note: "+12 Points for each face card that scores.",
    tier: "Uncommon",
    price: 6,
    at: "card",
    art: "eye",
    field: "#cc1259",
    ink: "#fbf1ea",
    plate: "#ffb3cf",
    fire: (_ctx, card) => (card && isFace(card.rank) ? { points: 12 } : null),
  },
  {
    id: "coil",
    name: "Coil",
    note: "+2 Mult for each spade that scores.",
    tier: "Uncommon",
    price: 6,
    at: "card",
    art: "stack",
    field: "#0e3a36",
    ink: "#f2ece0",
    plate: "#ffc83d",
    fire: (_ctx, card) => (card?.suit === "S" ? { mult: 2 } : null),
  },
  {
    id: "thorn",
    name: "Thorn",
    note: "+8 Mult when no face card is played.",
    tier: "Uncommon",
    price: 7,
    at: "hand",
    art: "num",
    big: "+8",
    field: "#4a1766",
    ink: "#fbf1ea",
    plate: "#c58bff",
    fire: (ctx) => (ctx.played.every((c) => !isFace(c.rank)) ? { mult: 8 } : null),
  },
  {
    id: "mirror",
    name: "Mirror",
    note: "The first card that scores, scores twice.",
    tier: "Uncommon",
    price: 7,
    at: "card",
    art: "rings",
    field: "#1d2a5c",
    ink: "#fbf1ea",
    plate: "#ff5a78",
    // The doubling is handled in score.ts, which knows the card's own points;
    // this only says when it applies.
    fire: (ctx, card) => (card && card === ctx.scoring[0] ? {} : null),
  },
  {
    id: "lantern",
    name: "Lantern",
    note: "×1.5 Mult when you play exactly five cards.",
    tier: "Uncommon",
    price: 8,
    at: "hand",
    art: "moon",
    field: "#3b0f5c",
    ink: "#fbf1ea",
    plate: "#fff3c4",
    fire: (ctx) => (ctx.played.length === 5 ? { times: 1.5 } : null),
  },

  // ── Rare ──────────────────────────────────────
  {
    id: "wyrm",
    name: "Wyrm",
    note: "×2 Mult when you play five cards.",
    tier: "Rare",
    price: 11,
    at: "hand",
    art: "stack",
    field: "#1d1846",
    ink: "#fbf1ea",
    plate: "#ff3d6e",
    fire: (ctx) => (ctx.played.length === 5 ? { times: 2 } : null),
  },
  {
    id: "eclipse",
    name: "Eclipse",
    note: "×3 Mult on a flush.",
    tier: "Rare",
    price: 12,
    at: "hand",
    art: "moon",
    field: "#0e0620",
    ink: "#fbf1ea",
    plate: "#8ee6ff",
    fire: (ctx) => (ctx.hand === "Flush" || ctx.hand === "Straight flush" ? { times: 3 } : null),
  },
  {
    id: "obelisk",
    name: "Obelisk",
    note: "+5 Mult for every sigil in the book.",
    tier: "Rare",
    price: 11,
    at: "hand",
    art: "num",
    big: "+5",
    field: "#16100a",
    ink: "#f7d77e",
    plate: "#b8761c",
    fire: (ctx) => ({ mult: 5 * ctx.sigilCount }),
  },
  {
    id: "covenant",
    name: "Covenant",
    note: "×2.5 Mult when the hand is exactly a pair.",
    tier: "Rare",
    price: 10,
    at: "hand",
    art: "key",
    field: "#722440",
    ink: "#f8ecee",
    plate: "#ff2e55",
    fire: (ctx) => (ctx.hand === "Pair" ? { times: 2.5 } : null),
  },
  {
    id: "ouroboros",
    name: "Ouroboros",
    note: "+6 Mult for each hand already played this round.",
    tier: "Rare",
    price: 10,
    at: "hand",
    art: "rings",
    field: "#0b4a30",
    ink: "#efe3c4",
    plate: "#3ef0c4",
    fire: (ctx) => (ctx.handNumber > 1 ? { mult: 6 * (ctx.handNumber - 1) } : null),
  },

  // ── Legendary ─────────────────────────────────
  {
    id: "the-binding",
    name: "The Binding",
    note: "×5 Mult on a straight flush.",
    tier: "Legendary",
    price: 18,
    at: "hand",
    art: "key",
    field: "#050302",
    ink: "#fff3c4",
    plate: "#ff2e8a",
    fire: (ctx) => (ctx.hand === "Straight flush" ? { times: 5 } : null),
  },
  {
    id: "the-ninth",
    name: "The Ninth",
    note: "×1.5 Mult, and again for every discard you did not use.",
    tier: "Legendary",
    price: 20,
    at: "hand",
    art: "eye",
    field: "#1a060e",
    ink: "#fbf1ea",
    plate: "#ff2e8a",
    fire: (ctx) => ({ times: 1.5 ** (1 + ctx.discardsLeft) }),
  },
];

export const SIGIL_BY_ID = new Map(SIGILS.map((sigil) => [sigil.id, sigil]));

/** How often each tier turns up in the shop. */
export const TIER_WEIGHT: Record<Tier, number> = { Common: 10, Uncommon: 5, Rare: 2, Legendary: 1 };

/** The tier colours the casino already uses for everything a player owns. */
export const TIER_INK: Record<Tier, string> = {
  Common: "#d9cfc4",
  Uncommon: "#c9e7b5",
  Rare: "#7cc4ff",
  Legendary: "#f7c65c",
};
