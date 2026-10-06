"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { DECK_BY_ID, type DeckId } from "@/game/decks";
import { CHAPTERS } from "@/game/seals";
import { Shop } from "@/components/Shop";
import { Table } from "@/components/Table";
import { TopBar } from "@/components/TopBar";
import { useRun } from "@/lib/useRun";

/**
 * One run, from the first seal to the last.
 *
 * The route carries only which binding to open; everything after that is the
 * seed, and the seed is the run. A reload resumes from the saved position
 * rather than reshuffling, because a roguelike that forgets what you built
 * when the tab closes is a roguelike nobody finishes.
 */
function Run() {
  const params = useSearchParams();
  const asked = params.get("deck");
  const fresh = params.get("new") === "1";
  const deck = (DECK_BY_ID.has(asked as DeckId) ? (asked as DeckId) : "plain") as DeckId;
  const game = useRun(fresh || asked ? { deck, seed: params.get("seed") ?? undefined } : undefined);

  if (!game.run) return <div className="loading">Opening the book…</div>;

  return (
    <div className="app">
      <TopBar chapter={game.run.chapter} kind={game.kind} ink={game.run.ink} />
      {game.phase === "shop" ? (
        <main className="stage">
          <Shop game={game} />
        </main>
      ) : game.phase === "won" ? (
        <main className="stage">
          <div className="finished">
            <span className="finished-kicker poster">All {CHAPTERS} chapters</span>
            <h1 className="poster">The book is finished</h1>
            <p>
              You closed {DECK_BY_ID.get(game.run.deck)!.name} on seed <b className="num">{game.run.seed}</b>. The next binding is open.
            </p>
            {game.unlocked.length ? (
              <ul className="unlocked">
                {game.unlocked.map((badge) => (
                  <li key={badge.id}>{badge.name}</li>
                ))}
              </ul>
            ) : null}
            <div className="finished-acts">
              <Link className="btn btn-play" href="/">
                Back to the shelf
              </Link>
            </div>
          </div>
        </main>
      ) : (
        <main className="stage">
          <Table game={game} />
        </main>
      )}
    </div>
  );
}

export function Floor() {
  return (
    <Suspense fallback={<div className="loading">Opening the book…</div>}>
      <Run />
    </Suspense>
  );
}
