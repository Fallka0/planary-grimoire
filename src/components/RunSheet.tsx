"use client";

import { useMemo, useState } from "react";
import { prettyCard } from "@/game/cards";
import { COVENANT_BY_ID } from "@/game/covenants";
import { DECK_BY_ID } from "@/game/decks";
import { HAND_ORDER, levelled, levelOf } from "@/game/hands";
import { CHAPTERS } from "@/game/seals";
import { TOKEN_BY_ID } from "@/game/tokens";
import type { useRun } from "@/lib/useRun";
import { PlayCard, SigilCard } from "./Card";

/*
  Everything about the run, in one place.

  Before this existed, a player could see their deck only by buying a rite and
  their sigils' rules only by hovering one — which on a phone meant not at all.
  Both are things you need in order to make the next decision, so both are a
  button away at any moment, including mid-hand.

  It is deliberately a reference rather than a dashboard: no advice, no "best
  hand" suggestion, nothing that plays the game for you. Just what is true.
*/

type Run = ReturnType<typeof useRun>;
type Tab = "deck" | "book" | "hands";

export function RunSheet({ game, onClose }: { game: Run; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("deck");
  const run = game.run;
  const round = game.round;

  /** What is left to draw, and what has already gone, for the seal in play. */
  const standing = useMemo(() => {
    if (!run) return null;
    if (!round) return { left: run.cards.length, drawn: 0, gone: 0 };
    const zones = run.cards.map((card) => round.zone[card.id] ?? "deck");
    return {
      left: zones.filter((z) => z === "deck").length,
      drawn: zones.filter((z) => z === "hand").length,
      gone: zones.filter((z) => z === "gone" || z === "play").length,
    };
  }, [run, round]);

  if (!run) return null;
  const binding = DECK_BY_ID.get(run.deck)!;
  const marked = run.cards.filter((card) => card.mark).length;

  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet sheet-wide run-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="This run">
        <div className="run-head">
          <div>
            <h2 className="poster">{binding.name}</h2>
            <span className="sheet-sub">
              Chapter {run.chapter} of {CHAPTERS} · seed <b className="num">{run.seed}</b> · <b className="num">{run.ink}</b> ink
            </span>
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <nav className="run-tabs" role="tablist">
          {(
            [
              ["deck", `Deck · ${run.cards.length}`],
              ["book", `Book · ${run.sigils.length}`],
              ["hands", "Hands"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="run-tab" onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "deck" ? (
          <>
            <p className="sheet-note">
              {standing ? (
                <>
                  <b className="num">{standing.left}</b> still to draw this seal, <b className="num">{standing.drawn}</b> in hand,{" "}
                  <b className="num">{standing.gone}</b> spent. <b className="num">{marked}</b> of the {run.cards.length} carry a mark.
                </>
              ) : (
                <>
                  <b className="num">{run.cards.length}</b> cards, <b className="num">{marked}</b> of them marked.
                </>
              )}
            </p>
            <div className="deck-grid">
              {run.cards.map((card) => {
                const where = round?.zone[card.id] ?? "deck";
                return (
                  <span key={card.id} className={`deck-cell is-${where}`} title={`${prettyCard(card)}${card.mark ? ` · ${card.mark}` : ""}`}>
                    <PlayCard card={card} dim={where === "gone"} />
                  </span>
                );
              })}
            </div>
          </>
        ) : null}

        {tab === "book" ? (
          <>
            <p className="sheet-note">Sigils fire left to right. Where one sits is worth as much as which one it is.</p>
            <div className="run-book">
              {game.sigils.length ? (
                game.sigils.map((sigil, i) => (
                  <div key={`${sigil.id}-${i}`} className="run-sigil">
                    <SigilCard sigil={sigil} />
                    <div>
                      <span className="run-sigil-name poster">
                        {i + 1}. {sigil.name}
                      </span>
                      <p>{sigil.note}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rack-none">Nothing written yet.</p>
              )}
            </div>
            {run.covenants.length || run.tokens.length ? (
              <div className="run-extras">
                {run.covenants.map((id) => {
                  const covenant = COVENANT_BY_ID.get(id);
                  return covenant ? (
                    <span key={id} className="run-extra">
                      <b>{covenant.name}</b> — {covenant.note}
                    </span>
                  ) : null;
                })}
                {run.tokens.map((id, i) => {
                  const token = TOKEN_BY_ID.get(id);
                  return token ? (
                    <span key={`${id}-${i}`} className="run-extra">
                      <b>{token.name}</b> — {token.note}
                    </span>
                  ) : null;
                })}
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "hands" ? (
          <>
            <p className="sheet-note">A verse raises one of these for the rest of the run. The figures are what it pays before any card or sigil.</p>
            <table className="run-hands">
              <thead>
                <tr>
                  <th scope="col">Hand</th>
                  <th scope="col" className="num">
                    Level
                  </th>
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
                  const level = levelOf(run.levels, name);
                  const at = levelled(name, level);
                  return (
                    <tr key={name} data-raised={level > 1 || undefined}>
                      <th scope="row">{name}</th>
                      <td className="num">{level}</td>
                      <td className="num">{at.points}</td>
                      <td className="num">{at.mult}</td>
                      <td className="num">{at.points * at.mult}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </div>
  );
}
