"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DECK_BY_ID, type DeckId } from "@/game/decks";
import { CHAPTERS } from "@/game/seals";
import { OpenLeaf } from "@/components/OpenLeaf";
import { Rotate } from "@/components/Rotate";
import { RunSheet } from "@/components/RunSheet";
import { SealSelect } from "@/components/SealSelect";
import { Shop } from "@/components/Shop";
import { Table } from "@/components/Table";
import { TopBar } from "@/components/TopBar";
import { armAudio } from "@/lib/audio";
import { useDevice } from "@/lib/device";
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
  // Browsers refuse to make a sound until the page has been touched; this
  // takes the first touch and then takes itself off.
  useEffect(() => armAudio(), []);
  const asked = params.get("deck");
  const fresh = params.get("new") === "1";
  const deck = (DECK_BY_ID.has(asked as DeckId) ? (asked as DeckId) : "plain") as DeckId;
  const game = useRun(fresh || asked ? { deck, seed: params.get("seed") ?? undefined } : undefined);
  const device = useDevice();
  const [sheet, setSheet] = useState(false);
  const closeSheet = useCallback(() => setSheet(false), []);

  /**
   * Keyboard play.
   *
   * Digits pick cards out of the fan in the order they are lying, which is the
   * order you read them, so the hand can be built without the mouse ever
   * leaving the table.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        setSheet(false);
        if (game.leaf) game.closeLeaf();
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        setSheet((open) => !open);
        return;
      }
      if (sheet || game.leaf) return;

      if (game.phase === "choosing") {
        if (event.key === "Enter") {
          event.preventDefault();
          game.chooseSeal();
        }
        return;
      }
      if (game.phase !== "picking") return;

      if (/^[1-9]$/.test(event.key)) {
        const card = game.inHand[Number(event.key) - 1];
        if (card) {
          event.preventDefault();
          game.toggle(card.id);
        }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        game.play();
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        game.discard();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, sheet]);

  if (device.upright) return <Rotate />;
  if (!game.run) return <div className="loading">Opening the book…</div>;

  return (
    <div className="app">
      <TopBar chapter={game.run.chapter} kind={game.kind} ink={game.run.ink} onRun={() => setSheet(true)} />
      {game.phase === "choosing" ? (
        <main className="stage">
          <SealSelect game={game} />
        </main>
      ) : game.phase === "shop" ? (
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
      {sheet ? <RunSheet game={game} onClose={closeSheet} /> : null}
      {game.leaf ? <OpenLeaf game={game} /> : null}
      {game.note ? (
        <p className="toast" role="status">
          {game.note}
        </p>
      ) : null}
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
