/**
 * The deck, and the marks a card can carry.
 *
 * A card is a rank, a suit and at most one mark inked onto it. Everything else
 * a card does during scoring follows from those three things, so this file is
 * the whole vocabulary the rest of the game speaks.
 */

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export const SUITS = ["S", "H", "D", "C"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** How a card is written down everywhere: rank, a dash, suit. "A-S", "10-H". */
export type CardId = string;

/**
 * A mark inked onto a card.
 *
 * `bonus` and `mult` are flat: they add the same amount every time the card
 * scores. `holo` and `steel` are the pair that make a deck worth rebuilding —
 * a multiplier applied late is worth far more than points applied early, and
 * learning that is most of learning the game.
 */
export type Mark = "" | "bonus" | "mult" | "holo" | "steel";

export interface Card {
  id: CardId;
  rank: Rank;
  suit: Suit;
  mark: Mark;
}

export const SUIT_NAMES: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };

/** Hearts and diamonds print in the red ink; the other two in near-black. */
export function isRed(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

export function cardId(rank: Rank, suit: Suit): CardId {
  return `${rank}-${suit}`;
}

/** What a rank is worth before anything else touches it. */
export function pointsOf(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number.parseInt(rank, 10);
}

/** Ordering value, aces high. Used for straights and for sorting a hand. */
export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank) + 2;
}

export function isFace(rank: Rank): boolean {
  return rank === "J" || rank === "Q" || rank === "K";
}

/** What each mark is worth, and how it reads on the card's corner. */
export const MARKS: Record<Exclude<Mark, "">, { label: string; note: string; ink: string }> = {
  bonus: { label: "+30 Points", note: "Scores 30 extra points.", ink: "#1d1846" },
  mult: { label: "+4 Mult", note: "Adds 4 to the multiplier.", ink: "#d9173c" },
  holo: { label: "+10 Mult", note: "Adds 10 to the multiplier.", ink: "#3b0f5c" },
  steel: { label: "×1.5 Mult", note: "Multiplies the multiplier by one and a half.", ink: "#22060e" },
};

/** The fifty-two, in factory order: spades, hearts, diamonds, clubs, low to high. */
export function orderedDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) cards.push({ id: cardId(rank, suit), rank, suit, mark: "" });
  return cards;
}

/** A card as a person reads it: A♠, 10♥. */
export function prettyCard(card: Card): string {
  const pips: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
  return `${card.rank}${pips[card.suit]}`;
}

/** 1'000 — Swiss grouping, the same everywhere in the casino. */
export function formatNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** A multiplier reads with one decimal only when it has one: 46, but 7.5. */
export function formatMult(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : value.toFixed(1);
}
