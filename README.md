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

Each chapter is chosen from a screen that shows all three of its seals at once,
including the warden's rule — published rather than sprung, because the game is
in rebuilding a book to survive a rule you already knew about. The first two
seals of a chapter can be **refused** for a token: you lose the ink that seal
would have paid and gain something the shop cannot sell you. The warden cannot
be refused, which is what stops that being a way to skip the game.

## What the margin sells

Between seals you are in **the margin**, which stocks four kinds of thing:

- **Sigils** along the top — the marks in the book, compared against each other.
- **A covenant**, one a chapter, on the shelf below. Permanent, and every one of
  them buys *room*: another slot, another hand, another card in the fan.
- **Leaves** — sealed pages you buy shut and open for a choice. A **sigil leaf**
  asks what your book should do, a **card leaf** what your deck should be made
  of, and a **rite leaf** which cards deserve the ink. You are always shown more
  than you may keep.
- **Rites** are the one-shot workings inside a rite leaf. A sigil changes how a
  hand is *scored*; a rite changes the cards themselves, once, for the rest of
  the run — marking them, turning them to a suit, or raising their rank. Taking
  one lays your whole deck out to pick from, which is also the only place in the
  game you can see all of it at once.

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
| `src/game/rites.ts` | The one-shot workings that change cards in the deck |
| `src/game/leaves.ts` | Sealed pages, and what is inside each kind |
| `src/game/covenants.ts` | The standing agreements, and every number they move |
| `src/game/tokens.ts` | What walking away from a seal is worth |
| `src/lib/audio.ts` | The sound, synthesised — no audio files anywhere |
| `scripts/balance.mjs` | Plays the book, so the numbers are checked rather than hoped for |

`score.ts` returns a list of events, not a total. The table replays that list
one beat at a time, so a player watching the cards pop is being shown the
arithmetic rather than its answer — which is the only reason the order of the
book is a decision a player can discover and then exploit.

A played hand is also **laid out as the hand it is**: pairs and sets group
together, a straight runs low to high, and whatever does not score is pushed to
the end. Five cards in the order you happened to pick them up say nothing; the
same five grouped say "full house" before you have finished looking.

## Sound

There are no audio files in this repository. Every poster in this casino is
drawn rather than drawn *from* a file, and the sound follows the same rule: an
oscillator and an envelope, in `src/lib/audio.ts`. The music is a slow
generative pad — four notes of a pentatonic set, each a detuned pair of
triangles under a filter sweep, overlapping. There is no loop point because
there is no loop, so it cannot become the thing you are waiting to hear end.

Being synthesised is also what lets a hand *climb*: each scoring card plays a
step higher than the last, so five cards walk up a scale instead of clicking
five times. Nothing starts until the page is touched, and the one control over
it is a mute button that remembers.

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
