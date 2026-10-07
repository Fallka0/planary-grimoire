/**
 * One hand, resolved in a fixed and readable order.
 *
 * The output is not a number; it is the *sequence* that produces the number.
 * The table replays that sequence one beat at a time, so a player watching the
 * cards pop is being shown the arithmetic rather than its answer. That is the
 * whole reason this is a list of events and not a sum: a score you cannot
 * follow is a score you have to take on trust, and nothing in this casino asks
 * for that.
 *
 * ── The order, which never changes ──────────────────────────────────
 *   1. The hand's base points and base multiplier.
 *   2. Each scoring card, left to right: its rank's points, then its mark.
 *   3. Sigils hooked to `card`, after the card they fired on.
 *   4. Sigils hooked to `hand`, left to right along the book.
 *   5. Points × multiplier, rounded down.
 *
 * Because multiplication lands last within each step and sigils fire in book
 * order, moving a ×-sigil to the right of a +-sigil is worth real points. That
 * is a deliberate decision a player can discover and then exploit.
 */

import { type Card, MARKS, pointsOf } from "./cards";
import { evaluate, HAND_LEVELS, type HandName } from "./hands";
import { baseMultUnder, scoringUnder, sigilsSealed, totalUnder, type WardenRule } from "./seals";
import type { Effect, FireContext, Sigil } from "./sigils";

export interface ScoreEvent {
  /** What moves on screen when this beat plays. */
  source: "card" | "sigil";
  cardId?: string;
  sigilId?: string;
  /** What floats up off it: "+11", "+4 Mult", "×2 Mult". */
  label: string;
  kind: "points" | "mult" | "times";
  /** The running figures after this beat, so the panel can be read mid-sequence. */
  points: number;
  mult: number;
}

export interface Resolution {
  hand: HandName;
  /** Every played card, laid out so the hand reads as what it is. */
  arranged: Card[];
  scoring: Card[];
  events: ScoreEvent[];
  points: number;
  mult: number;
  /** Points × mult, rounded down. What the round score gains. */
  total: number;
}

/** A multiplier is kept to one decimal, so ×1.5 twice reads as 2.3 and not 2.2500000001. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface ScoreInput {
  played: Card[];
  sigils: Sigil[];
  handsLeft: number;
  discardsLeft: number;
  /** Which hand of the round this is, counting from one. */
  handNumber: number;
  /** The warden's rule, when one is in force. */
  warden?: WardenRule | null;
}

export function resolve(input: ScoreInput): Resolution | null {
  const evaluation = evaluate(input.played);
  if (!evaluation) return null;

  const rule = input.warden ?? null;
  // The warden strikes cards out before anything fires, so a struck card never
  // pops and never shows a figure — it simply does not take part.
  const scoring = scoringUnder(rule, evaluation.scoring);
  const sealed = sigilsSealed(rule, input.handNumber);

  const level = HAND_LEVELS[evaluation.name];
  let points = level.points;
  let mult = baseMultUnder(rule, level.mult);
  const events: ScoreEvent[] = [];

  const ctx: FireContext = {
    played: input.played,
    scoring,
    hand: evaluation.name,
    handsLeft: input.handsLeft,
    discardsLeft: input.discardsLeft,
    sigilCount: input.sigils.length,
    handNumber: input.handNumber,
  };

  const apply = (effect: Effect, event: Omit<ScoreEvent, "points" | "mult">) => {
    if (effect.points) points += effect.points;
    if (effect.mult) mult += effect.mult;
    if (effect.times) mult = round1(mult * effect.times);
    events.push({ ...event, points, mult });
  };

  /** Everything one card contributes on its own: its rank, then its mark. */
  const fireCard = (card: Card) => {
    apply({ points: pointsOf(card.rank) }, { source: "card", cardId: card.id, kind: "points", label: `+${pointsOf(card.rank)}` });
    if (card.mark) {
      const mark = MARKS[card.mark];
      const effect: Effect =
        card.mark === "bonus"
          ? { points: 30 }
          : card.mark === "mult"
            ? { mult: 4 }
            : card.mark === "holo"
              ? { mult: 10 }
              : { times: 1.5 };
      apply(effect, {
        source: "card",
        cardId: card.id,
        kind: card.mark === "steel" ? "times" : card.mark === "bonus" ? "points" : "mult",
        label: mark.label.replace(" Points", "").replace(" Mult", " Mult"),
      });
    }
  };

  for (const card of scoring) {
    fireCard(card);

    for (const sigil of sealed ? [] : input.sigils) {
      if (sigil.at !== "card") continue;
      const effect = sigil.fire(ctx, card);
      if (!effect) continue;
      // Mirror and its kind return nothing of their own: they say "again".
      if (!effect.points && !effect.mult && !effect.times) {
        fireCard(card);
        events[events.length - 1] = { ...events[events.length - 1], sigilId: sigil.id };
        continue;
      }
      apply(effect, { source: "sigil", sigilId: sigil.id, cardId: card.id, kind: effect.times ? "times" : effect.mult ? "mult" : "points", label: labelOf(effect) });
    }
  }

  for (const sigil of sealed ? [] : input.sigils) {
    if (sigil.at !== "hand") continue;
    const effect = sigil.fire(ctx);
    if (!effect || (!effect.points && !effect.mult && !effect.times)) continue;
    apply(effect, { source: "sigil", sigilId: sigil.id, kind: effect.times ? "times" : effect.mult ? "mult" : "points", label: labelOf(effect) });
  }

  const total = totalUnder(rule, input.handNumber, Math.floor(points * mult));
  return { hand: evaluation.name, arranged: evaluation.arranged, scoring, events, points, mult, total };
}

function labelOf(effect: Effect): string {
  if (effect.times) return `×${Number.isInteger(effect.times) ? effect.times : effect.times.toFixed(1)} Mult`;
  if (effect.mult) return `+${effect.mult} Mult`;
  return `+${effect.points}`;
}

/**
 * What a selection would score if it were played now.
 *
 * Used for the live preview under the hand, so the figures move as cards are
 * picked up and put down. It is the same function the real play uses, which is
 * the only way the preview can be trusted to agree with the result.
 */
export function preview(input: ScoreInput): { hand: HandName; points: number; mult: number } | null {
  const resolution = resolve(input);
  if (!resolution) return null;
  const level = HAND_LEVELS[resolution.hand];
  // The preview shows the hand's own figures, not the full sequence: the cards
  // have not been played, so nothing has fired yet. The warden's flattening of
  // the multiplier is shown, though, because that is true before you play.
  return { hand: resolution.hand, points: level.points, mult: baseMultUnder(input.warden ?? null, level.mult) };
}
