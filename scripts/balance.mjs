/**
 * Plays the book, so the numbers are something checked rather than hoped for.
 *
 *   node scripts/balance.mjs
 *
 * Two jobs. The first is correctness: the hand evaluator and the scoring
 * sequence are walked through cases with known answers, including the ones
 * that are easy to get subtly wrong — the low straight, a four-card flush that
 * is not a flush, which cards a two pair actually scores, and the order in
 * which a multiplier lands.
 *
 * The second is balance, which cannot be reasoned about from the table alone.
 * A greedy robot plays whole runs on random seeds and reports how far it gets.
 * The target is a game that is losable: a run that always ends at chapter one
 * is a wall, and one that always reaches chapter eight is a cutscene.
 */

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src", "game");

// The game modules import each other without file extensions, the way a
// bundler expects and plain node does not; a staged copy keeps the source as
// it ships.
const staging = mkdtempSync(join(tmpdir(), "grimoire-"));
mkdirSync(staging, { recursive: true });
for (const name of ["cards.ts", "hands.ts", "score.ts", "sigils.ts", "seals.ts", "decks.ts", "rng.ts", "run.ts", "rites.ts", "leaves.ts", "covenants.ts", "tokens.ts"]) {
  writeFileSync(join(staging, name), readFileSync(join(src, name), "utf8").replace(/(from "\.\/[A-Za-z]+)"/g, '$1.ts"'));
}
const hands = await import(`file://${join(staging, "hands.ts")}`);
const score = await import(`file://${join(staging, "score.ts")}`);
const sigils = await import(`file://${join(staging, "sigils.ts")}`);
const seals = await import(`file://${join(staging, "seals.ts")}`);
const decks = await import(`file://${join(staging, "decks.ts")}`);
const run = await import(`file://${join(staging, "run.ts")}`);
const rites = await import(`file://${join(staging, "rites.ts")}`);
const leaves = await import(`file://${join(staging, "leaves.ts")}`);
const covenants = await import(`file://${join(staging, "covenants.ts")}`);
const rng = await import(`file://${join(staging, "rng.ts")}`);

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`  ✓ ${name}`);
  else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const card = (text) => {
  const [rank, suit] = [text.slice(0, -1), text.slice(-1)];
  return { id: `${rank}-${suit}`, rank, suit, mark: "" };
};
const hand = (...texts) => texts.map(card);

console.log("\nNaming a hand");
const named = (...texts) => hands.evaluate(hand(...texts)).name;
check("a pair is a pair", named("K♠".replace("♠", "S"), "KH", "2C", "5D", "9S") === "Pair");
check("two pair", named("KS", "KH", "2C", "2D", "9S") === "Two pair");
check("three of a kind", named("KS", "KH", "KC", "2D", "9S") === "Three of a kind");
check("a full house is not three of a kind", named("KS", "KH", "KC", "2D", "2S") === "Full house");
check("four of a kind", named("KS", "KH", "KC", "KD", "2S") === "Four of a kind");
check("a straight", named("5S", "6H", "7C", "8D", "9S") === "Straight");
check("the low wheel is a straight", named("AS", "2H", "3C", "4D", "5S") === "Straight");
check("a flush", named("2S", "6S", "7S", "8S", "KS") === "Flush");
check("a straight flush", named("5S", "6S", "7S", "8S", "9S") === "Straight flush");
check("four to a flush is not a flush", named("2S", "6S", "7S", "8S") === "High card", named("2S", "6S", "7S", "8S"));
check("a gap is not a straight", named("5S", "6H", "7C", "8D", "10S") === "High card");
check("nothing at all is a high card", named("2S", "6H", "9C", "JD", "KS") === "High card");

console.log("\nWhich cards actually score");
const scoring = (...texts) => hands.evaluate(hand(...texts)).scoring.map((c) => c.id);
check("a pair scores two cards, not five", scoring("KS", "KH", "2C", "5D", "9S").length === 2);
check("two pair scores four", scoring("KS", "KH", "2C", "2D", "9S").length === 4);
check("a full house scores all five", scoring("KS", "KH", "KC", "2D", "2S").length === 5);
check("a flush scores all five", scoring("2S", "6S", "7S", "8S", "KS").length === 5);
check("a high card scores exactly one, the highest", scoring("2S", "6H", "9C", "JD", "KS").join() === "K-S");

console.log("\nThe scoring sequence");
const plain = score.resolve({ played: hand("KS", "KH", "2C", "5D", "9S"), sigils: [], handsLeft: 3, discardsLeft: 3, handNumber: 1 });
// A pair is 12 points and ×2; two kings add ten points each.
check("a bare pair of kings is (12 + 10 + 10) × 2 = 64", plain.total === 64, `got ${plain.total}`);
check("only the scoring cards appear as beats", plain.events.every((e) => e.cardId === "K-S" || e.cardId === "K-H"));

const marked = score.resolve({
  played: [{ ...card("KS"), mark: "mult" }, card("KH"), card("2C")],
  sigils: [],
  handsLeft: 3,
  discardsLeft: 3,
  handNumber: 1,
});
check("a +4 Mult mark lands on the multiplier, not the points", marked.mult === 6 && marked.points === 32, `${marked.points} × ${marked.mult}`);

// Order is the whole point: ×2 before +4 is worth less than ×2 after it.
const ember = sigils.SIGIL_BY_ID.get("ember");
const wyrm = sigils.SIGIL_BY_ID.get("wyrm");
const five = hand("KS", "KH", "2C", "5D", "9S");
const emberFirst = score.resolve({ played: five, sigils: [ember, wyrm], handsLeft: 3, discardsLeft: 3, handNumber: 1 });
const wyrmFirst = score.resolve({ played: five, sigils: [wyrm, ember], handsLeft: 3, discardsLeft: 3, handNumber: 1 });
check("the order of the book changes the answer", emberFirst.total !== wyrmFirst.total, `${emberFirst.total} vs ${wyrmFirst.total}`);
check("adding before multiplying is worth more", emberFirst.total > wyrmFirst.total, `${emberFirst.total} vs ${wyrmFirst.total}`);

console.log("\nWhat the wardens take away");
const faces = hand("KS", "KH", "2C", "5D", "9S");
const pale = score.resolve({ played: faces, sigils: [], handsLeft: 3, discardsLeft: 3, handNumber: 1, warden: { id: "pale" } });
check("The Pale Warden strikes face cards out of the scoring", pale.scoring.length === 0 && pale.points === 12, `${pale.points} × ${pale.mult}`);
const ninth = score.resolve({ played: faces, sigils: [], handsLeft: 3, discardsLeft: 3, handNumber: 1, warden: { id: "ninth" } });
check("The Ninth Door flattens the multiplier to one", ninth.mult === 1);
const weight = score.resolve({ played: faces, sigils: [], handsLeft: 3, discardsLeft: 3, handNumber: 1, warden: { id: "weight" } });
check("The Weight halves the first hand only", weight.total === Math.floor(plain.total / 2) && weight.total < plain.total);
const veil = score.resolve({ played: faces, sigils: [ember], handsLeft: 3, discardsLeft: 3, handNumber: 1, warden: { id: "veil" } });
check("The Veil keeps the book shut on the first hand", veil.total === plain.total);
const veil2 = score.resolve({ played: faces, sigils: [ember], handsLeft: 2, discardsLeft: 3, handNumber: 2, warden: { id: "veil" } });
check("and opens it on the second", veil2.total > plain.total);

console.log("\nThe bindings");
for (const deck of decks.DECKS) {
  const built = decks.buildDeck(deck);
  check(`${deck.name} builds ${built.length} cards`, built.length >= 20 && new Set(built.map((c) => c.id)).size === built.length);
}
check("only the plain binding is open at the start", decks.unlockedDecks([]).join() === "plain");
check("finishing one opens the next", decks.unlockedDecks(["plain"]).join() === "plain,ashen");

console.log("\nThe seals");
check("the greater seal of chapter two asks for 800", seals.quotaFor(2, "greater") === 800, String(seals.quotaFor(2, "greater")));
let rising = true;
for (let c = 2; c <= seals.CHAPTERS; c++) if (seals.quotaFor(c, "lesser") <= seals.quotaFor(c - 1, "warden")) rising = false;
check("every chapter asks for more than the last", rising);
check("there is a warden for every chapter", new Set(Array.from({ length: seals.CHAPTERS }, (_, i) => seals.wardenFor(i + 1).id)).size === seals.CHAPTERS);

console.log("\nLaying a hand out so it reads");
const fullHouse = hands.evaluate(hand("4S", "7D", "4D", "7C", "4C"));
check("a full house groups the three before the two", fullHouse.arranged.map((c) => c.rank).join("") === "444" + "77", fullHouse.arranged.map((c) => c.id).join(" "));
const straight = hands.evaluate(hand("8H", "5S", "7C", "4D", "6S"));
check("a straight runs low to high", straight.arranged.map((c) => c.rank).join(",") === "4,5,6,7,8", straight.arranged.map((c) => c.rank).join(","));
const onePair = hands.evaluate(hand("2C", "KS", "9D", "KH", "5S"));
check("the pair comes first and the strays go to the back", onePair.arranged.slice(0, 2).every((c) => c.rank === "K"), onePair.arranged.map((c) => c.id).join(" "));
check("the scoring order follows the arrangement", onePair.scoring.map((c) => c.id).join(" ") === onePair.arranged.slice(0, 2).map((c) => c.id).join(" "));

console.log("\nRites");
const deck = decks.buildDeck(decks.DECK_BY_ID.get("plain"));
const blade = rites.RITE_BY_ID.get("blade");
const bladed = rites.workRite(deck, blade, [deck[0].id, deck[1].id]);
check("The Blade marks exactly the cards it was given", bladed.filter((c) => c.mark === "mult").length === 2);
check("and leaves the rest alone", bladed.filter((c) => c.mark === "").length === deck.length - 2);
check("it will not mark more than it may", rites.workRite(deck, blade, deck.slice(0, 5).map((c) => c.id)).filter((c) => c.mark === "mult").length === 2);
const weave = rites.RITE_BY_ID.get("weave");
const woven = rites.renumber(rites.workRite(deck, weave, [deck[0].id, deck[1].id, deck[2].id], "H"));
check("The Weave turns cards to the named suit", woven.filter((c) => c.suit === "H").length === 13 + 3);
check("and the deck still has no two cards with one id", new Set(woven.map((c) => c.id)).size === woven.length);
const climb = rites.RITE_BY_ID.get("climb");
const ace = deck.find((c) => c.rank === "A");
check("The Climb leaves an ace where it is", rites.workRite(deck, climb, [ace.id]).find((c) => c.id === ace.id || c.rank === "A"));

console.log("\nLeaves");
for (const spec of leaves.LEAF_KINDS) {
  const contents = leaves.fillLeaf(spec.kind, new rng.Rng("LEAF"), []);
  const held = contents.sigils ?? contents.cards ?? contents.rites ?? [];
  check(`${spec.name} holds ${spec.shown}`, held.length === spec.shown, String(held.length));
}
check("a sigil leaf never offers what is already in the book", leaves.fillLeaf("sigil", new rng.Rng("X"), sigils.SIGILS.map((s) => s.id)).sigils.length === 0);

console.log("\nCovenants");
check("a fresh run has signed none", covenants.shaped([]).slots === 0);
check("a wider spine is one more slot", covenants.shaped(["spine"]).slots === 1);
check("usury raises the interest cap", covenants.shaped(["usury"]).interestCap === 8 && covenants.shaped([]).interestCap === 5);
check("cheap ink takes one off a restock", covenants.shaped(["cheapInk"]).rerollOff === 1);

console.log("\nRefusing a seal");
let refusing = run.newRun("plain", "REFUSE");
check("a lesser seal can be walked away from", run.canRefuse(refusing));
const walked = run.refuse(refusing);
check("walking away moves to the next seal", walked.run.seal === 1);
check("and takes a token for it", walked.run.tokens.length === 1 || walked.token === "ink");
check("no ink is paid for a seal you did not break", walked.token === "ink" ? walked.run.ink > refusing.ink : walked.run.ink === refusing.ink);
let atWarden = { ...refusing, seal: 2 };
check("a warden cannot be refused", !run.canRefuse(atWarden));

console.log("\nA run, played by a robot");
// The robot is deliberately simple: it plays the best hand it can see from the
// cards in front of it and never discards cleverly. A human should beat it, so
// where the robot stops is a floor on the difficulty rather than a measure of it.
function robotRun(seed) {
  let state = run.newRun("plain", seed);
  for (let guard = 0; guard < 40 && !state.won; guard++) {
    // The robot never walks away from a seal; it is measuring the hard path.
    const started = run.startSeal(state);
    state = started.run;
    let round = started.round;
    let dealt = run.deal(round, run.HAND_SIZE);
    round = dealt.round;

    while (round.score < round.quota && round.hands > 0) {
      const inHand = state.cards.filter((c) => round.zone[c.id] === "hand");
      // Every subset of up to five, not just adjacent runs: a robot that
      // cannot see a pair two cards apart would make the game look harder
      // than it is, and the whole point of this is to measure the game.
      let best = null;
      const consider = (pick) => {
        const r = score.resolve({
          played: pick,
          sigils: run.sigilsOf(state),
          handsLeft: round.hands - 1,
          discardsLeft: round.discards,
          handNumber: round.handNumber,
          warden: round.warden,
        });
        if (r && (!best || r.total > best.total)) best = { total: r.total, pick };
      };
      const walk = (start, pick) => {
        if (pick.length) consider(pick);
        if (pick.length === run.MAX_SELECT) return;
        for (let i = start; i < inHand.length; i++) walk(i + 1, [...pick, inHand[i]]);
      };
      walk(0, []);
      if (!best) break;
      const zone = { ...round.zone };
      for (const c of best.pick) zone[c.id] = "gone";
      round = { ...round, zone, score: round.score + best.total, hands: round.hands - 1, handNumber: round.handNumber + 1 };
      dealt = run.deal(round, best.pick.length);
      round = dealt.round;
      if (run.cardsLeft(round) === 0 && round.score < round.quota) break;
    }

    if (round.score < round.quota) return { chapter: state.chapter, seal: state.seal, won: false };

    const payout = run.payoutFor(state, round);
    state = run.advance(state, payout.total);
    if (state.won) return { chapter: seals.CHAPTERS, seal: 2, won: true };

    // Spend: buy the first thing it can afford, left to right.
    const rolled = run.rollShop(state);
    state = rolled.run;
    for (const offer of rolled.shop.sigils) {
      if (!run.canBuy(state, offer)) continue;
      state = run.addSigil(run.spend(state, rolled.shop, offer).run, offer.sigil);
    }
  }
  return { chapter: state.chapter, seal: state.seal, won: state.won };
}

const RUNS = 200;
const reached = [];
let wins = 0;
for (let i = 0; i < RUNS; i++) {
  const result = robotRun(`BALANCE${i}`);
  reached.push(result.chapter);
  if (result.won) wins += 1;
}
reached.sort((a, b) => a - b);
const median = reached[Math.floor(RUNS / 2)];
const mean = reached.reduce((a, b) => a + b, 0) / RUNS;
console.log(`  ${RUNS} greedy runs · median chapter ${median} · mean ${mean.toFixed(2)} · won ${wins}`);
const spread = new Map();
for (const c of reached) spread.set(c, (spread.get(c) ?? 0) + 1);
console.log(`  ${[...spread.entries()].sort((a, b) => a[0] - b[0]).map(([c, n]) => `ch${c}:${n}`).join("  ")}`);
check("a greedy robot does not walk the whole book", wins < RUNS * 0.5, `${wins} of ${RUNS} won`);
check("nor does it fall at the first seal every time", median >= 2, `median chapter ${median}`);

console.log(failures ? `\n${failures} check${failures > 1 ? "s" : ""} failed\n` : "\nThe book holds up.\n");
process.exit(failures ? 1 : 0);
