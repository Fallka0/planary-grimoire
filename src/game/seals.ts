/**
 * Chapters, seals, and the wardens that guard the last of each.
 *
 * Eight chapters, three seals apiece. The first two are a number to beat; the
 * third is a number *and* a rule, and the rule is published before you choose
 * whether to open it. A warden that surprised you would just be a dice roll —
 * the game is in rebuilding a book that already works to survive a rule you
 * can see coming.
 *
 * Quotas are a table rather than a formula, because a table can be read and
 * argued with. They roughly double each chapter: a seal you clear on a pair in
 * chapter one is hopeless by chapter four, which is what the shop is for.
 */

import type { Card } from "./cards";
import { isFace, type Suit } from "./cards";

export type SealKind = "lesser" | "greater" | "warden";

export const CHAPTERS = 8;
export const SEAL_ORDER: SealKind[] = ["lesser", "greater", "warden"];

export const SEAL_NAME: Record<SealKind, string> = {
  lesser: "The Lesser Seal",
  greater: "The Greater Seal",
  warden: "The Warden",
};

/**
 * The Lesser Seal's quota in each chapter; the other two are multiples of it.
 *
 * Each chapter has to more than double, or its first seal would ask for less
 * than the warden you just beat — and a chapter that opens easier than the one
 * before it reads as the game losing its nerve.
 */
const CHAPTER_QUOTA = [220, 500, 1150, 2600, 6000, 14000, 32000, 75000];
const KIND_MULTIPLE: Record<SealKind, number> = { lesser: 1, greater: 1.6, warden: 2.2 };

/** Ink paid for breaking a seal, before hands left and interest. */
export const SEAL_REWARD: Record<SealKind, number> = { lesser: 3, greater: 4, warden: 6 };

/**
 * What a warden forbids.
 *
 * Each is one sentence a player can hold in their head while they rebuild. No
 * warden adds arithmetic; every one of them takes something away, which is
 * harder to play around and much easier to understand.
 */
export type WardenId = "pale" | "hollow" | "mute" | "glass" | "weight" | "thief" | "veil" | "ninth";

export interface Warden {
  id: WardenId;
  name: string;
  note: string;
  /** The field this warden's seal is printed in. */
  field: string;
  ink: string;
}

export const WARDENS: Warden[] = [
  { id: "pale", name: "The Pale Warden", note: "Face cards score nothing.", field: "#e8c7a2", ink: "#2a0710" },
  { id: "hollow", name: "The Hollow", note: "Only one suit scores. It is named before you open the seal.", field: "#0e3a36", ink: "#f2ece0" },
  { id: "mute", name: "The Mute", note: "No discards this seal.", field: "#1d2a5c", ink: "#fbf1ea" },
  { id: "glass", name: "The Glass", note: "Marked cards score nothing.", field: "#3b0f5c", ink: "#fbf1ea" },
  { id: "weight", name: "The Weight", note: "Your first hand scores half.", field: "#16100a", ink: "#f7d77e" },
  { id: "thief", name: "The Thief", note: "One fewer hand this seal.", field: "#b3122e", ink: "#fbf1ea" },
  { id: "veil", name: "The Veil", note: "Your sigils stay shut on the first hand.", field: "#1a060e", ink: "#ff2e8a" },
  { id: "ninth", name: "The Ninth Door", note: "Every hand starts at ×1, whatever it is.", field: "#050302", ink: "#fff3c4" },
];

export const WARDEN_BY_ID = new Map(WARDENS.map((w) => [w.id, w]));

/** The rule in force for one seal, with the warden's choices already made. */
export interface WardenRule {
  id: WardenId;
  /** Set only by The Hollow: the single suit that scores. */
  suit?: Suit;
}

export function quotaFor(chapter: number, kind: SealKind): number {
  const base = CHAPTER_QUOTA[Math.min(chapter, CHAPTERS) - 1] ?? CHAPTER_QUOTA[CHAPTERS - 1] * 2 ** (chapter - CHAPTERS);
  return Math.round(base * KIND_MULTIPLE[kind]);
}

/** Which warden guards a given chapter. They come round in order. */
export function wardenFor(chapter: number): Warden {
  return WARDENS[(chapter - 1) % WARDENS.length];
}

/** The warden's full name on the seal, including the suit The Hollow picked. */
export function wardenNote(rule: WardenRule): string {
  const warden = WARDEN_BY_ID.get(rule.id)!;
  if (rule.id === "hollow" && rule.suit) {
    const names: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
    return `Only ${names[rule.suit]} score.`;
  }
  return warden.note;
}

// ── What a rule actually does ─────────────────────────

/** Cards this rule strikes out of the scoring set before anything fires. */
export function scoringUnder(rule: WardenRule | null, scoring: Card[]): Card[] {
  if (!rule) return scoring;
  if (rule.id === "pale") return scoring.filter((card) => !isFace(card.rank));
  if (rule.id === "glass") return scoring.filter((card) => !card.mark);
  if (rule.id === "hollow" && rule.suit) return scoring.filter((card) => card.suit === rule.suit);
  return scoring;
}

export function handsUnder(rule: WardenRule | null, hands: number): number {
  return rule?.id === "thief" ? Math.max(1, hands - 1) : hands;
}

export function discardsUnder(rule: WardenRule | null, discards: number): number {
  return rule?.id === "mute" ? 0 : discards;
}

/** True when the book stays shut for this hand. */
export function sigilsSealed(rule: WardenRule | null, handNumber: number): boolean {
  return rule?.id === "veil" && handNumber === 1;
}

export function baseMultUnder(rule: WardenRule | null, mult: number): number {
  return rule?.id === "ninth" ? 1 : mult;
}

export function totalUnder(rule: WardenRule | null, handNumber: number, total: number): number {
  return rule?.id === "weight" && handNumber === 1 ? Math.floor(total / 2) : total;
}
