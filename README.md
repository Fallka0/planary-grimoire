# Grimoire

A poker run in eight chapters, for [Planary Casino](https://casino.planary.ch),
at `grimoire.planary.ch`.

Play a hand, score **points × mult**, break the seal. Spend the ink on sigils
and write them into the book — they fire left to right, so *where* a sigil sits
is worth as much as *which* sigil it is. Eight chapters, three seals each, and
a warden on the last of every one.

No Planary Chips are staked here and none are paid out. Ink is the book's own
currency and stays in it. What leaves the book is a finished run, which unlocks
badges and cosmetics back in the casino.

## The shape of a run

| | |
| --- | --- |
| **Chapters** | 8, each with a Lesser Seal, a Greater Seal and a Warden |
| **A seal** | A number to beat, in 4 hands with 3 discards |
| **A hand** | Up to 5 cards; the hand's name sets the base points and mult |
| **Scoring** | Base → each scoring card and its mark → sigils, left to right |
| **Ink** | 3–6 for a seal, 1 per hand left, 1 per 5 kept (capped at 5) |

The quota table is in [`src/game/seals.ts`](src/game/seals.ts) and runs
220 → 500 → 1'150 → … → 75'000 for the Lesser Seal, with the Greater at 1.6×
and the Warden at 2.2×. Each chapter has to more than double, or its first seal
would ask for less than the warden you just beat.

## The eight wardens

Every warden takes something away rather than adding arithmetic, and every one
is published before you choose to open the seal. Face cards score nothing; only
one suit scores; no discards; marked cards score nothing; your first hand scores
half; one fewer hand; your sigils stay shut on the first hand; every hand starts
at ×1.

## The six bindings

Each is a trade, never an upgrade, and each is unlocked by finishing the one
before it — The Plain Binding, then Ashen (two more discards, one fewer hand),
Gilded (eight ink to open with), Hollow (no face cards, a sixth slot), Crimson
(hearts marked for mult, no spades at all) and Leaden (every card steel, one
hand a seal, one slot in the book).

Finishing with each unlocks an achievement in the casino, and three of them
carry cosmetics: the **Bookbinder** title, the **Sigil** card back, and the
**Grimoire** banner for all six.

## Shape of the code

| Path | What it holds |
| --- | --- |
| `src/game/cards.ts` | The deck, and the marks a card can carry |
| `src/game/hands.ts` | What a handful is named, and which cards actually score |
| `src/game/score.ts` | One hand resolved into the *sequence* that produces its number |
| `src/game/sigils.ts` | The roster, and the two moments a sigil can fire at |
| `src/game/seals.ts` | Chapters, quotas, and what each warden forbids |
| `src/game/decks.ts` | The six bindings and their unlock ladder |
| `src/game/run.ts` | The run, the shop, and what a broken seal pays |
| `src/lib/useRun.ts` | The clock that walks a resolved hand one beat at a time |
| `scripts/balance.mjs` | Plays the book, so the numbers are checked rather than hoped for |

`score.ts` returns a list of events, not a total. The table replays that list
one beat at a time, so a player watching the cards pop is being shown the
arithmetic rather than its answer — which is the only reason the order of the
book is a decision a player can discover and then exploit.

## Running it

```
npm install
npm run dev        # http://localhost:3007
```

```
npm run balance    # the evaluator, the sequence, the wardens, and 200 robot runs
```

`npm run balance` does two jobs. It walks the hand evaluator through cases with
known answers — the low straight, a four-card flush that is not a flush, which
cards a two pair actually scores — and then plays 200 whole runs with a greedy
robot and reports how far it gets. A robot that never discards reaches chapter
four and wins none of them, which is the floor the difficulty is set against.

A run is one seed, drawn from the platform's cryptographic generator. Everything
after it — the shuffle, what the shop stocks, which suit The Hollow names —
comes out of that one stream, so a seed replays exactly and two players on the
same seed are playing the same book.
