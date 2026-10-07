/**
 * What a handful of cards is worth, and which of them actually score.
 *
 * Two separate questions, and keeping them apart is what makes the rest of the
 * game legible. The *name* of a hand decides the base points and multiplier.
 * The *scoring set* decides which cards get to fire their marks — and it is
 * not always the whole hand: a pair played alongside three stragglers scores
 * two cards, not five. Players work this out by watching the cards pop, which
 * is why the animation walks the scoring set rather than the played set.
 */

import { type Card, rankValue } from "./cards";

export type HandName =
  | "High card"
  | "Pair"
  | "Two pair"
  | "Three of a kind"
  | "Straight"
  | "Flush"
  | "Full house"
  | "Four of a kind"
  | "Straight flush";

export interface HandLevel {
  /** Base points before any card or sigil touches them. */
  points: number;
  /** Base multiplier, likewise. */
  mult: number;
}

/**
 * The ladder.
 *
 * Points rise gently and multipliers rise steeply, so the interesting play is
 * nearly always to improve the multiplier rather than the points. A straight
 * flush is twelve times a pair on points but it is a hundred and twenty-eight
 * times on the product, and that gap is the game's whole economy.
 */
export const HAND_LEVELS: Record<HandName, HandLevel> = {
  "High card": { points: 5, mult: 1 },
  Pair: { points: 12, mult: 2 },
  "Two pair": { points: 24, mult: 2 },
  "Three of a kind": { points: 32, mult: 3 },
  Straight: { points: 36, mult: 4 },
  Flush: { points: 40, mult: 4 },
  "Full house": { points: 48, mult: 4 },
  "Four of a kind": { points: 64, mult: 6 },
  "Straight flush": { points: 96, mult: 8 },
};

/** Best to worst, for the collection screen and the hand book. */
export const HAND_ORDER: HandName[] = [
  "Straight flush",
  "Four of a kind",
  "Full house",
  "Flush",
  "Straight",
  "Three of a kind",
  "Two pair",
  "Pair",
  "High card",
];

export interface Evaluation {
  name: HandName;
  /** The cards that will fire, in the order they are laid out. */
  scoring: Card[];
  /** Every played card, arranged so the hand reads as what it is. */
  arranged: Card[];
}

/**
 * Lays a played hand out so it reads as the hand it is.
 *
 * Five cards in the order you happened to pick them up say nothing; the same
 * five grouped say "full house" before you have finished looking. So pairs and
 * sets sit together, a straight runs low to high, and a flush keeps its ranks
 * in order — and whatever does not score is pushed to the end, out of the way
 * of the cards that do.
 *
 * The scoring order follows this arrangement, which is why the pops run left
 * to right along a hand that already makes sense.
 */
export function arrange(cards: Card[], name: HandName, scoring: Card[]): Card[] {
  const scores = new Set(scoring);
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);

  const straightish = name === "Straight" || name === "Straight flush";
  const flushish = name === "Flush";

  return [...cards].sort((a, b) => {
    // Cards that score come first, always: they are the hand.
    if (scores.has(a) !== scores.has(b)) return scores.has(a) ? -1 : 1;
    if (straightish) return rankValue(a.rank) - rankValue(b.rank);
    if (flushish) return rankValue(b.rank) - rankValue(a.rank);
    // Otherwise by set size, then by rank: three fours before two sevens.
    const sizeA = counts.get(a.rank) ?? 0;
    const sizeB = counts.get(b.rank) ?? 0;
    if (sizeA !== sizeB) return sizeB - sizeA;
    if (a.rank !== b.rank) return rankValue(b.rank) - rankValue(a.rank);
    return "SHDC".indexOf(a.suit) - "SHDC".indexOf(b.suit);
  });
}

/**
 * Names a hand and picks out the cards that score.
 *
 * Straights and flushes need all five cards, so a four-card flush is a flush
 * of nothing. The ace is the one rank that reaches both ways: A-2-3-4-5 is a
 * straight and so is 10-J-Q-K-A, which is why the low wheel is checked by
 * value rather than by position.
 */
export function evaluate(cards: Card[]): Evaluation | null {
  if (cards.length === 0) return null;

  const byRank = new Map<string, Card[]>();
  for (const card of cards) byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
  // Biggest group first, and on a tie the higher rank, so "two pair" always
  // names the better pair first and a full house is read the way it is said.
  const groups = [...byRank.values()].sort((a, b) => b.length - a.length || rankValue(b[0].rank) - rankValue(a[0].rank));

  const five = cards.length === 5;
  const flush = five && cards.every((card) => card.suit === cards[0].suit);

  let straight = false;
  if (five && groups.length === 5) {
    const values = cards.map((card) => rankValue(card.rank)).sort((a, b) => a - b);
    straight = values[4] - values[0] === 4 || values.join() === "2,3,4,5,14";
  }

  // In played order, so the pops run left to right across the table.
  const inOrder = (chosen: Card[]) => cards.filter((card) => chosen.includes(card));

  const made = (name: HandName, scoring: Card[]): Evaluation => {
    const arranged = arrange(cards, name, scoring);
    // The scoring set is re-read off the arrangement, so it fires in the order
    // the cards are actually lying on the table.
    return { name, scoring: arranged.filter((card) => scoring.includes(card)), arranged };
  };

  if (straight && flush) return made("Straight flush", cards);
  if (groups[0].length === 4) return made("Four of a kind", inOrder(groups[0]));
  if (groups[0].length === 3 && groups[1]?.length === 2) return made("Full house", cards);
  if (flush) return made("Flush", cards);
  if (straight) return made("Straight", cards);
  if (groups[0].length === 3) return made("Three of a kind", inOrder(groups[0]));
  if (groups[0].length === 2 && groups[1]?.length === 2) return made("Two pair", inOrder([...groups[0], ...groups[1]]));
  if (groups[0].length === 2) return made("Pair", inOrder(groups[0]));

  // Nothing made: the single highest card carries the hand on its own.
  const best = [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))[0];
  return made("High card", [best]);
}
