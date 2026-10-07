"use client";

import { useState } from "react";
import { formatMult, formatNumber } from "@/game/cards";
import { SEAL_NAME, wardenNote } from "@/game/seals";
import type { Sigil } from "@/game/sigils";
import { MAX_SELECT } from "@/game/run";
import type { useRun } from "@/lib/useRun";
import { CardBack, PlayCard, SigilCard } from "./Card";

/*
  The playing field, printed as this game's own cover.

  The field is one flat ultramarine, the seal's quota is set enormous behind
  the play in two plates slightly out of register, and the halftone fades in
  toward the foot — the same press as every poster in the casino, turned into
  a place you sit at rather than a picture you look at.

  Everything that costs you something sits low and central. Everything that
  explains the position sits in the panel on the left. Nothing floats over the
  cards except the figures they are producing.
*/

type Run = ReturnType<typeof useRun>;

/** A figure floating off a card or a sigil as it fires. */
function Pop({ label, kind }: { label: string; kind: "points" | "mult" | "times" }) {
  return (
    <span className={`pop pop-${kind} poster`} role="status">
      {label}
    </span>
  );
}

function Book({ game }: { game: Run }) {
  const [open, setOpen] = useState<number | null>(null);
  const run = game.run!;
  const firing = game.beat?.event.sigilId;

  return (
    <div className="book" aria-label="Your sigils">
      {game.sigils.map((sigil, i) => (
        <div
          key={`${sigil.id}-${i}`}
          className={`book-slot${firing === sigil.id ? " is-firing" : ""}`}
          onMouseEnter={() => setOpen(i)}
          onMouseLeave={() => setOpen((current) => (current === i ? null : current))}
        >
          {/* Tappable as well as hoverable: without a mouse there is otherwise
              no way at all to read what your own sigils do. */}
          <button
            type="button"
            className="book-press"
            aria-expanded={open === i}
            aria-label={`${sigil.name}: ${sigil.note}`}
            onClick={() => setOpen((current) => (current === i ? null : i))}
          >
            <SigilCard sigil={sigil} />
          </button>
          {firing === sigil.id && game.beat ? <Pop label={game.beat.event.label} kind={game.beat.event.kind} /> : null}
          {open === i ? <SigilNote sigil={sigil} /> : null}
        </div>
      ))}
      {Array.from({ length: Math.max(0, run.slots - game.sigils.length) }, (_, i) => (
        <div key={`empty-${i}`} className="book-empty" aria-hidden="true" />
      ))}
    </div>
  );
}

function SigilNote({ sigil }: { sigil: Sigil }) {
  return (
    <div className="sigil-note">
      <div className="sigil-note-head">
        <span className="poster">{sigil.name}</span>
        <span className="poster sigil-note-tier">{sigil.tier}</span>
      </div>
      <p>{sigil.note}</p>
    </div>
  );
}

export function Table({ game }: { game: Run }) {
  const { run, round, phase } = game;
  const [sort, setSort] = useState<"rank" | "suit">("rank");
  if (!run || !round) return <div className="loading">Opening the book…</div>;

  const hand = [...game.inHand].sort(
    sort === "suit"
      ? (a, b) => "SHDC".indexOf(a.suit) - "SHDC".indexOf(b.suit) || "23456789⁠".length + 0
      : () => 0,
  );
  // Sorting by rank is the default; by suit groups them and keeps rank order inside.
  const ranked = [...game.inHand].sort((a, b) => rankOf(b) - rankOf(a) || "SHDC".indexOf(a.suit) - "SHDC".indexOf(b.suit));
  const suited = [...game.inHand].sort((a, b) => "SHDC".indexOf(a.suit) - "SHDC".indexOf(b.suit) || rankOf(b) - rankOf(a));
  const shown = sort === "suit" ? suited : ranked;
  void hand;

  // Only while they are still in play: the ids stay on the round so the tally
  // can name them, but a card that has gone to the discard must leave the felt.
  const playing = round.playing
    .filter((id) => round.zone[id] === "play")
    .map((id) => run.cards.find((card) => card.id === id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));
  // Both figures come off the same preview, which already knows what level the
  // run has raised this hand to. Reading points from the unlevelled table and
  // mult from the preview is how they came to disagree.
  const points = game.running?.points ?? game.look?.points ?? 0;
  const mult = game.running?.mult ?? game.look?.mult ?? 0;
  const level = game.tally?.level ?? game.look?.level ?? 1;
  const progress = Math.min(100, (round.score / round.quota) * 100);
  const scoringIds = new Set((game.tally?.scoring ?? []).map((card) => card.id));

  return (
    <div className="floor">
      <aside className="panel">
        <div className="panel-head">
          <h2 className="poster">{SEAL_NAME[game.kind]}</h2>
          <span className="pill-quiet">Pays {game.payout?.seal ?? 0} ink</span>
        </div>
        <p className="panel-ask">
          Score at least <strong className="poster num">{formatNumber(round.quota)}</strong>
        </p>

        {round.warden ? <p className="warden-note">{wardenNote(round.warden)}</p> : null}

        <div className="panel-score">
          <span className="panel-label">Round score</span>
          <span className="poster num panel-total">{formatNumber(round.score)}</span>
          <span className="panel-bar">
            <i style={{ width: `${progress}%` }} />
          </span>
        </div>

        <div className="panel-hand">
          <span className="panel-handname">
            {game.tally?.hand ?? game.look?.hand ?? " "}
            {(game.tally || game.look) && level > 1 ? <em className="hand-level poster">Lvl {level}</em> : null}
          </span>
          <div className="panel-figures">
            <span className="figure figure-points poster num">{formatNumber(points)}</span>
            <span className="figure-times poster">×</span>
            <span className="figure figure-mult poster num">{formatMult(mult)}</span>
          </div>
          <div className="panel-figurelabels">
            <span>Points</span>
            <span>Mult</span>
          </div>
        </div>

        <div className="panel-counts">
          <div>
            <span className="panel-label">Hands</span>
            <span className="poster num">{round.hands}</span>
          </div>
          <div>
            <span className="panel-label">Discards</span>
            <span className="poster num">{round.discards}</span>
          </div>
        </div>
      </aside>

      <section className="table">
        <div className="table-print" aria-hidden="true">
          <span className="table-quota table-quota-plate poster num">{formatNumber(round.quota)}</span>
          <span className="table-quota poster num">{formatNumber(round.quota)}</span>
        </div>
        <span className="table-halftone" aria-hidden="true" />

        <span className="table-label poster">
          Sigils {game.sigils.length} / {run.slots}
        </span>
        <Book game={game} />

        <div className="played">
          {playing.map((card) => {
            const firing = game.beat?.event.cardId === card.id && game.beat.event.source === "card";
            const dim = phase === "tallied" && scoringIds.size > 0 && !scoringIds.has(card.id);
            return (
              <div key={card.id} className={`played-card${firing ? " is-firing" : ""}`}>
                <PlayCard card={card} dim={dim} />
                {firing && game.beat ? <Pop label={game.beat.event.label} kind={game.beat.event.kind} /> : null}
              </div>
            );
          })}
        </div>

        {game.tally ? (
          <div className="readout">
            <span className="readout-total poster num">
              <span className="readout-plate">{formatNumber(game.tally.total)}</span>
              <span>{formatNumber(game.tally.total)}</span>
            </span>
            <span className="readout-sum num">
              {formatNumber(game.tally.points)} points × {formatMult(game.tally.mult)} mult
            </span>
          </div>
        ) : null}

        <div className="hand" style={{ "--count": shown.length } as React.CSSProperties}>
          {shown.map((card, i) => {
            const offset = i - (shown.length - 1) / 2;
            const picked = round.selected.includes(card.id);
            const delay = game.dealt[card.id];
            return (
              <button
                key={card.id}
                type="button"
                className={`hand-card${picked ? " is-picked" : ""}${delay !== undefined ? " is-dealing" : ""}`}
                style={
                  {
                    // The curve is kept unitless so the stylesheet can flatten
                    // the fan on a short screen, where cards hanging below the
                    // row would sit on top of the controls.
                    "--curve": offset * offset,
                    "--turn": `${offset * 2}deg`,
                    "--delay": `${delay ?? 0}ms`,
                    zIndex: 20 + i,
                  } as React.CSSProperties
                }
                onClick={() => game.toggle(card.id)}
                aria-pressed={picked}
                aria-label={`${card.rank} of ${card.suit}`}
                disabled={phase !== "picking"}
              >
                <PlayCard card={card} />
              </button>
            );
          })}
        </div>

        <div className="deck-stack" aria-label={`${game.deckLeft} cards left`}>
          <CardBack />
          <CardBack />
          <CardBack />
          <span className="deck-count num">
            {game.deckLeft} / {run.cards.length}
          </span>
        </div>

        <div className="controls">
          <button type="button" className="btn btn-play" onClick={game.play} disabled={phase !== "picking" || !round.selected.length || round.hands <= 0}>
            Play hand
          </button>
          <div className="sorter" role="group" aria-label="Sort your hand">
            <span>Sort</span>
            <button type="button" aria-pressed={sort === "rank"} onClick={() => setSort("rank")}>
              Rank
            </button>
            <button type="button" aria-pressed={sort === "suit"} onClick={() => setSort("suit")}>
              Suit
            </button>
          </div>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={game.discard}
            disabled={phase !== "picking" || !round.selected.length || round.discards <= 0}
          >
            Discard
          </button>
          <span className="controls-note num">
            {round.selected.length} / {MAX_SELECT}
          </span>
        </div>

        {phase === "broken" && game.payout ? (
          <div className="veil">
            <div className="sheet">
              <h2 className="poster">Seal broken</h2>
              <p>
                {formatNumber(round.score)} of {formatNumber(round.quota)}, with {round.hands} hand
                {round.hands === 1 ? "" : "s"} to spare.
              </p>
              <dl className="sheet-rows">
                <div>
                  <dt>The seal</dt>
                  <dd className="num">{game.payout.seal} ink</dd>
                </div>
                <div>
                  <dt>Hands left, one each</dt>
                  <dd className="num">{game.payout.hands} ink</dd>
                </div>
                <div>
                  <dt>Interest, one per five kept</dt>
                  <dd className="num">{game.payout.interest} ink</dd>
                </div>
              </dl>
              <button type="button" className="btn btn-play" onClick={game.collect}>
                Take {game.payout.total} ink
              </button>
            </div>
          </div>
        ) : null}

        {phase === "over" ? (
          <div className="veil">
            <div className="sheet">
              <h2 className="poster">The book closes</h2>
              <p>
                {formatNumber(round.score)} of {formatNumber(round.quota)}. Chapter {run.chapter}, {SEAL_NAME[game.kind].toLowerCase()}.
              </p>
              <button type="button" className="btn btn-play" onClick={() => game.restart(run.deck)}>
                Open it again
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function rankOf(card: { rank: string }): number {
  return ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].indexOf(card.rank) + 2;
}
