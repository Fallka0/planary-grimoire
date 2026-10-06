"use client";

import type { DeckId } from "@/game/decks";
import { loadSession } from "./session";

export const CASINO_API = process.env.NEXT_PUBLIC_CASINO_API || "https://planary-casino-api.planary.workers.dev";

/**
 * Telling the casino a book was finished.
 *
 * Grimoire stakes nothing and pays nothing, so there is no wallet in the loop
 * and no reason for a server to sit between the player and the cards. The one
 * thing that does leave this app is the fact of a finished run, because that
 * is what unlocks a title and a card back back in the lobby.
 *
 * ── What this is worth, stated plainly ──────────────────────────────
 * The claim is made by the browser, and the casino takes it at its word. That
 * is fine for a cosmetic: the worst a forged claim buys is a title nobody else
 * can tell you did not earn. It would not be fine for chips, which is exactly
 * why no chips are involved. The run's seed and binding go with the claim, so
 * a later version could replay the run server-side and check it — the engine
 * is deterministic from the seed, so the proof is already possible. It simply
 * is not demanded yet, and saying so is cheaper than implying otherwise.
 */
export interface RunReport {
  deck: DeckId;
  seed: string;
  /** How far the book got: 8 means it was finished. */
  chapter: number;
  won: boolean;
  /** The sigils in the book at the end, in firing order. */
  sigils: string[];
}

export interface Unlocked {
  id: string;
  name: string;
}

/** Posts a finished run. Quiet on failure: a lost unlock must not cost the win. */
export async function reportRun(report: RunReport): Promise<Unlocked[]> {
  const session = loadSession();
  if (!session) return [];
  try {
    const res = await fetch(`${CASINO_API}/v1/grimoire/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { unlocked?: Unlocked[] };
    return body.unlocked ?? [];
  } catch {
    return [];
  }
}

/** Whether anybody is signed in. The game is playable either way. */
export function signedIn(): boolean {
  return Boolean(loadSession());
}
