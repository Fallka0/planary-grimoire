/**
 * Rites — the one-shot workings that change cards in the deck.
 *
 * A sigil changes how a hand is *scored*. A rite changes the cards themselves,
 * once, for the rest of the run. That is the whole difference, and it is why a
 * rite is spent the moment it is used while a sigil stays in the book.
 *
 * Every rite asks you to pick the cards it works on, which is the point: a
 * marked card is worth nothing until it also turns up in a hand you were going
 * to play anyway, so choosing which cards to mark is choosing what your deck
 * is going to be about.
 */

import { type Card, type Mark, RANKS, type Rank, type Suit, SUIT_NAMES } from "./cards";

export type RiteId = "keeper" | "blade" | "mirror" | "anvil" | "weave" | "climb" | "blank";

export interface Rite {
  id: RiteId;
  name: string;
  note: string;
  /** How many cards it may be worked on. */
  cards: number;
  /** Set when the rite needs a suit chosen as well. */
  needsSuit?: boolean;
  field: string;
  ink: string;
  plate: string;
  /** The glyph printed on its leaf. */
  glyph: string;
}

export const RITES: Rite[] = [
  {
    id: "keeper",
    name: "The Keeper",
    note: "Marks up to 2 cards for +30 points.",
    cards: 2,
    field: "#1d1846",
    ink: "#fbf1ea",
    plate: "#8ea4ff",
    glyph: "+30",
  },
  {
    id: "blade",
    name: "The Blade",
    note: "Marks up to 2 cards for +4 mult.",
    cards: 2,
    field: "#b3122e",
    ink: "#fbf1ea",
    plate: "#ff5a78",
    glyph: "+4",
  },
  {
    id: "mirror",
    name: "The Mirror",
    note: "Marks 1 card for +10 mult.",
    cards: 1,
    field: "#3b0f5c",
    ink: "#fbf1ea",
    plate: "#c58bff",
    glyph: "+10",
  },
  {
    id: "anvil",
    name: "The Anvil",
    note: "Marks 1 card as steel: ×1.5 mult.",
    cards: 1,
    field: "#16100a",
    ink: "#f7d77e",
    plate: "#b8761c",
    glyph: "×1.5",
  },
  {
    id: "weave",
    name: "The Weave",
    note: "Turns up to 3 cards to a suit you name.",
    cards: 3,
    needsSuit: true,
    field: "#0b4a30",
    ink: "#efe3c4",
    plate: "#3ef0c4",
    glyph: "♠♥",
  },
  {
    id: "climb",
    name: "The Climb",
    note: "Raises up to 2 cards by one rank. Aces stay aces.",
    cards: 2,
    field: "#ff5b2e",
    ink: "#2a0710",
    plate: "#f6eee4",
    glyph: "↑",
  },
  {
    id: "blank",
    name: "The Blank",
    note: "Strips the mark from up to 3 cards.",
    cards: 3,
    field: "#f6eee4",
    ink: "#22060e",
    plate: "#b3122e",
    glyph: "—",
  },
];

export const RITE_BY_ID = new Map(RITES.map((rite) => [rite.id, rite]));

const MARK_OF: Partial<Record<RiteId, Mark>> = { keeper: "bonus", blade: "mult", mirror: "holo", anvil: "steel", blank: "" };

/**
 * Works a rite on the chosen cards and hands back the whole deck.
 *
 * The deck is replaced rather than mutated: a run is saved between seals, and
 * a card quietly changing under a saved game is the kind of bug that is only
 * ever noticed as "my deck is wrong" three chapters later.
 */
export function workRite(deck: Card[], rite: Rite, chosen: readonly string[], suit?: Suit): Card[] {
  const picked = new Set(chosen.slice(0, rite.cards));
  return deck.map((card) => {
    if (!picked.has(card.id)) return card;
    if (rite.id === "weave" && suit) return { ...card, suit, id: `${card.rank}-${suit}` };
    if (rite.id === "climb") {
      const next = RANKS[Math.min(RANKS.length - 1, RANKS.indexOf(card.rank) + 1)] as Rank;
      return { ...card, rank: next, id: `${next}-${card.suit}` };
    }
    const mark = MARK_OF[rite.id];
    return mark === undefined ? card : { ...card, mark };
  });
}

/**
 * Keeps a deck's ids unique after a rite has rewritten some of them.
 *
 * Two cards can legitimately become the same rank and suit — weave three cards
 * to hearts and two of them may collide — and the whole engine keys cards by
 * id. So the deck is renumbered after every working, and the ids stay opaque.
 */
export function renumber(deck: Card[]): Card[] {
  const seen = new Map<string, number>();
  return deck.map((card) => {
    const base = `${card.rank}-${card.suit}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...card, id: n === 1 ? base : `${base}#${n}` };
  });
}

export function suitLabel(suit: Suit): string {
  return SUIT_NAMES[suit];
}
