/**
 * Leaves — sealed pages you buy shut and open for a choice.
 *
 * Three kinds, and the difference between them is what the choice is *about*:
 * a sigil leaf asks what your book should do, a card leaf asks what your deck
 * should be made of, and a rite leaf asks which cards deserve the ink. You are
 * always shown more than you may keep, because the interesting part is what
 * you leave behind.
 */

import { type Card, cardId, RANKS, type Rank, SUITS, type Suit } from "./cards";
import type { Rng } from "./rng";
import { RITES, type Rite } from "./rites";
import { SIGILS, type Sigil, TIER_WEIGHT } from "./sigils";

export type LeafKind = "sigil" | "card" | "rite";

export interface LeafKindSpec {
  kind: LeafKind;
  name: string;
  note: string;
  price: number;
  /** How many are shown, and how many may be kept. */
  shown: number;
  keep: number;
  field: string;
  ink: string;
  plate: string;
}

export const LEAF_KINDS: LeafKindSpec[] = [
  {
    kind: "sigil",
    name: "A sigil leaf",
    note: "Two sigils. Keep one.",
    price: 5,
    shown: 2,
    keep: 1,
    field: "#1d1846",
    ink: "#fbf1ea",
    plate: "#ff3d6e",
  },
  {
    kind: "card",
    name: "A card leaf",
    note: "Three cards. Keep one, and it joins your deck.",
    price: 4,
    shown: 3,
    keep: 1,
    field: "#b3122e",
    ink: "#fbf1ea",
    plate: "#ff5a78",
  },
  {
    kind: "rite",
    name: "A rite leaf",
    note: "Three rites. Keep one and work it now.",
    price: 5,
    shown: 3,
    keep: 1,
    field: "#3b0f5c",
    ink: "#fbf1ea",
    plate: "#c58bff",
  },
];

export const LEAF_BY_KIND = new Map(LEAF_KINDS.map((leaf) => [leaf.kind, leaf]));

/** What is actually inside a leaf, drawn from the run's own stream. */
export interface LeafContents {
  kind: LeafKind;
  sigils?: Sigil[];
  cards?: Card[];
  rites?: Rite[];
}

/**
 * Fills a leaf.
 *
 * Sigils already in the book are kept out of it — a leaf that offers you what
 * you own is a leaf you stop opening. Cards come out marked more often than
 * the deck is, because an unmarked extra card is barely worth the page.
 */
export function fillLeaf(kind: LeafKind, rng: Rng, held: readonly string[]): LeafContents {
  const spec = LEAF_BY_KIND.get(kind)!;

  if (kind === "sigil") {
    const pool = SIGILS.filter((sigil) => !held.includes(sigil.id));
    const picked: Sigil[] = [];
    const left = [...pool];
    for (let i = 0; i < spec.shown && left.length; i++) {
      const sigil = rng.weighted(left, (s) => TIER_WEIGHT[s.tier]);
      picked.push(sigil);
      left.splice(left.indexOf(sigil), 1);
    }
    return { kind, sigils: picked };
  }

  if (kind === "rite") {
    return { kind, rites: rng.sample(RITES, spec.shown) };
  }

  const cards: Card[] = Array.from({ length: spec.shown }, () => {
    const rank = rng.pick(RANKS) as Rank;
    const suit = rng.pick(SUITS) as Suit;
    // A little over half come inked; the rest are a plain card you still might
    // want, because what a deck is short of is not always a multiplier.
    const roll = rng.float();
    const mark = roll < 0.22 ? "bonus" : roll < 0.42 ? "mult" : roll < 0.52 ? "holo" : roll < 0.58 ? "steel" : "";
    return { id: cardId(rank, suit), rank, suit, mark };
  });
  return { kind, cards };
}
