"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { DECKS, type DeckId, unlockedDecks } from "@/game/decks";
import { HAND_LEVELS, HAND_ORDER } from "@/game/hands";
import { CHAPTERS, WARDENS } from "@/game/seals";
import { SIGILS, TIER_INK } from "@/game/sigils";
import { formatNumber } from "@/game/cards";
import { SigilCard } from "@/components/Card";
import { TopBar } from "@/components/TopBar";
import { finishedDecks } from "@/lib/useRun";

/**
 * The shelf.
 *
 * The cover first, then the bindings, then everything the game will otherwise
 * have to explain mid-run: what each hand is worth, who the wardens are, and
 * what is in the book. A roguelike that hides its tables makes a player learn
 * by losing, and losing is meant to be about the decisions rather than about
 * not having been told.
 */
export default function Shelf() {
  const [finished, setFinished] = useState<DeckId[]>([]);
  const [tab, setTab] = useState<"bindings" | "hands" | "wardens" | "sigils">("bindings");

  // localStorage only exists in the browser, so the shelf starts locked and
  // opens on mount rather than guessing during the server render.
  useEffect(() => setFinished(finishedDecks()), []);
  const open = unlockedDecks(finished);

  return (
    <div className="app">
      <TopBar />

      <main className="stage shelf">
        <section className="cover">
          <div className="cover-copy">
            <span className="cover-kicker poster">A poker run in {CHAPTERS} chapters</span>
            <h1 className="poster cover-title">Grimoire</h1>
            <p>
              Play a hand, score points times mult, break the seal. Spend the ink on sigils and write them into the book — they fire
              left to right, so where a sigil sits is worth as much as which sigil it is. Eight chapters, three seals each, and a
              warden on the last of every one.
            </p>
            <div className="cover-acts">
              <Link className="btn btn-play btn-lg" href="/play?deck=plain&new=1">
                Open the book
              </Link>
              <Link className="btn btn-quiet btn-lg" href="/play">
                Continue
              </Link>
            </div>
            <p className="cover-note">No chips are staked here and none are paid out. Ink is the book&apos;s own, and stays in it.</p>
          </div>
          <div className="cover-art" aria-hidden="true">
            <span className="cover-plate poster">G</span>
            <span className="cover-mark poster">G</span>
          </div>
        </section>

        <nav className="tabs" role="tablist" aria-label="What is in the book">
          {(
            [
              ["bindings", "Bindings"],
              ["hands", "Hands"],
              ["wardens", "Wardens"],
              ["sigils", "Sigils"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "bindings" ? (
          <ul className="bindings">
            {DECKS.map((deck) => {
              const unlocked = open.includes(deck.id);
              const done = finished.includes(deck.id);
              return (
                <li
                  key={deck.id}
                  className={`binding${unlocked ? "" : " is-locked"}`}
                  style={{ "--field": deck.field, "--ink": deck.ink, "--plate": deck.plate } as React.CSSProperties}
                >
                  <span className="binding-spine" aria-hidden="true" />
                  <div className="binding-copy">
                    <span className="binding-name poster">{deck.name}</span>
                    <p>{deck.note}</p>
                    <dl className="binding-stats num">
                      <div>
                        <dt>Hands</dt>
                        <dd>{deck.hands}</dd>
                      </div>
                      <div>
                        <dt>Discards</dt>
                        <dd>{deck.discards}</dd>
                      </div>
                      <div>
                        <dt>Slots</dt>
                        <dd>{deck.slots}</dd>
                      </div>
                      <div>
                        <dt>Ink</dt>
                        <dd>{deck.ink_}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="binding-act">
                    {done ? <span className="binding-done poster">Finished</span> : null}
                    {unlocked ? (
                      <Link className="btn btn-play btn-sm" href={`/play?deck=${deck.id}&new=1`}>
                        Open <ArrowRight size={14} strokeWidth={2.4} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="binding-locked">
                        <Lock size={13} aria-hidden="true" /> Finish {DECKS.find((d) => d.id === deck.after)?.name}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {tab === "hands" ? (
          <table className="book-table">
            <thead>
              <tr>
                <th scope="col">Hand</th>
                <th scope="col" className="num">
                  Points
                </th>
                <th scope="col" className="num">
                  Mult
                </th>
                <th scope="col" className="num">
                  Base
                </th>
              </tr>
            </thead>
            <tbody>
              {HAND_ORDER.map((name) => {
                const level = HAND_LEVELS[name];
                return (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td className="num">{level.points}</td>
                    <td className="num">{level.mult}</td>
                    <td className="num">{formatNumber(level.points * level.mult)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}

        {tab === "wardens" ? (
          <ul className="wardens">
            {WARDENS.map((warden, i) => (
              <li key={warden.id} style={{ "--field": warden.field, "--ink": warden.ink } as React.CSSProperties}>
                <span className="warden-chapter poster">Chapter {i + 1}</span>
                <span className="warden-name poster">{warden.name}</span>
                <p>{warden.note}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "sigils" ? (
          <div className="sigil-shelf">
            {SIGILS.map((sigil) => (
              <div key={sigil.id} className="sigil-entry">
                <SigilCard sigil={sigil} />
                <div>
                  <span className="sigil-entry-name poster">{sigil.name}</span>
                  <span className="sigil-entry-tier poster" style={{ color: TIER_INK[sigil.tier] }}>
                    {sigil.tier} · {sigil.price} ink
                  </span>
                  <p>{sigil.note}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
