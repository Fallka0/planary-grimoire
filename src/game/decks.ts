/**
 * The bindings — six books to run with, and what each one costs you.
 *
 * Every binding past the first is a trade, never an upgrade: more ink for
 * fewer hands, an extra sigil slot for a thinner deck. A binding that was
 * simply better would end the choice, and the choice is the reason to come
 * back once a run is finished.
 *
 * Bindings are also the game's long arc. Each is unlocked by finishing a run
 * with the one before it, so the set is a ladder you climb by playing rather
 * than a menu you pick from — and the casino records each as an achievement
 * (see the run report in run.ts).
 */

import type { Card, Mark } from "./cards";
import { isFace, orderedDeck } from "./cards";

export type DeckId = "plain" | "ashen" | "gilded" | "hollow" | "crimson" | "leaden";

export interface Deck {
  id: DeckId;
  name: string;
  note: string;
  /** What the cover is printed in. */
  field: string;
  ink: string;
  plate: string;
  /** Changes to the opening position. */
  hands: number;
  discards: number;
  slots: number;
  ink_: number;
  /** Which binding must be finished before this one can be opened. Null = always. */
  after: DeckId | null;
  /** Reshapes the fifty-two before the run starts. */
  build?: (cards: Card[]) => Card[];
}

const START = { hands: 4, discards: 3, slots: 5, ink: 4 };

function mark(cards: Card[], pick: (card: Card) => Mark): Card[] {
  return cards.map((card) => ({ ...card, mark: pick(card) }));
}

export const DECKS: Deck[] = [
  {
    id: "plain",
    name: "The Plain Binding",
    note: "Fifty-two cards and nothing written in the margins.",
    field: "#b3122e",
    ink: "#fbf1ea",
    plate: "#ff5a78",
    hands: START.hands,
    discards: START.discards,
    slots: START.slots,
    ink_: START.ink,
    after: null,
  },
  {
    id: "ashen",
    name: "The Ashen Binding",
    note: "Two more discards. One fewer hand.",
    field: "#2a0915",
    ink: "#f8ecee",
    plate: "#ff2e55",
    hands: START.hands - 1,
    discards: START.discards + 2,
    slots: START.slots,
    ink_: START.ink,
    after: "plain",
  },
  {
    id: "gilded",
    name: "The Gilded Binding",
    note: "Eight ink to open with. The first seal is worth nothing.",
    field: "#16100a",
    ink: "#f7d77e",
    plate: "#b8761c",
    hands: START.hands,
    discards: START.discards,
    slots: START.slots,
    ink_: START.ink + 8,
    after: "ashen",
  },
  {
    id: "hollow",
    name: "The Hollow Binding",
    note: "No face cards at all. Forty in the deck, and a sixth slot in the book.",
    field: "#0e3a36",
    ink: "#f2ece0",
    plate: "#3ef0c4",
    hands: START.hands,
    discards: START.discards,
    slots: START.slots + 1,
    ink_: START.ink,
    after: "gilded",
    build: (cards) => cards.filter((card) => !isFace(card.rank)),
  },
  {
    id: "crimson",
    name: "The Crimson Binding",
    note: "Every heart is marked for mult. Every spade scores nothing at all.",
    field: "#cc1259",
    ink: "#fbf1ea",
    plate: "#ffb3cf",
    hands: START.hands,
    discards: START.discards - 1,
    slots: START.slots,
    ink_: START.ink,
    after: "hollow",
    build: (cards) => mark(cards.filter((card) => card.suit !== "S"), (card) => (card.suit === "H" ? "mult" : "")),
  },
  {
    id: "leaden",
    name: "The Leaden Binding",
    note: "Every card is steel. One hand a seal, and one slot in the book.",
    field: "#050302",
    ink: "#fff3c4",
    plate: "#ff2e8a",
    hands: 1,
    discards: START.discards + 1,
    slots: 1,
    ink_: START.ink + 4,
    after: "crimson",
    build: (cards) => mark(cards, () => "steel"),
  },
];

export const DECK_BY_ID = new Map(DECKS.map((deck) => [deck.id, deck]));

/** The fifty-two as this binding lays them out, before anyone shuffles. */
export function buildDeck(deck: Deck): Card[] {
  const cards = orderedDeck();
  return deck.build ? deck.build(cards) : cards;
}

/** Which bindings are open, given the ones already finished. */
export function unlockedDecks(finished: readonly DeckId[]): DeckId[] {
  return DECKS.filter((deck) => deck.after === null || finished.includes(deck.after)).map((deck) => deck.id);
}
