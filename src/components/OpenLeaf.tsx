"use client";

import { useState } from "react";
import { prettyCard, SUITS, type Suit, SUIT_NAMES } from "@/game/cards";
import { LEAF_BY_KIND } from "@/game/leaves";
import type { useRun } from "@/lib/useRun";
import { PlayCard, SigilCard } from "./Card";

/*
  An opened leaf.

  You are always shown more than you may keep, because the decision is the
  thing you bought. A rite is the one that does not end here: picking it only
  decides *what* is about to happen, and the cards it happens to are chosen
  from the deck on the next screen — which is also the only place in the game
  where the whole deck is laid out, so it doubles as somewhere to look.
*/

type Run = ReturnType<typeof useRun>;

export function OpenLeaf({ game }: { game: Run }) {
  const { leaf, run } = game;
  const [picked, setPicked] = useState<string[]>([]);
  const [suit, setSuit] = useState<Suit>("H");

  if (!leaf || !run) return null;
  const spec = LEAF_BY_KIND.get(leaf.contents.kind)!;

  // ── A rite, waiting for the cards it works on ──
  if (leaf.rite) {
    const rite = leaf.rite;
    const enough = picked.length > 0;
    return (
      <div className="veil">
        <div className="sheet sheet-wide">
          <div className="sheet-head">
            <h2 className="poster">{rite.name}</h2>
            <span className="sheet-sub">{rite.note}</span>
          </div>

          {rite.needsSuit ? (
            <div className="suit-pick" role="group" aria-label="Which suit">
              {SUITS.map((option) => (
                <button key={option} type="button" aria-pressed={suit === option} onClick={() => setSuit(option)}>
                  {SUIT_NAMES[option]}
                </button>
              ))}
            </div>
          ) : null}

          <p className="sheet-note">
            Pick up to {rite.cards} card{rite.cards === 1 ? "" : "s"} from your deck. {picked.length} chosen.
          </p>

          <div className="deck-grid">
            {run.cards.map((card) => {
              const on = picked.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`deck-cell${on ? " is-picked" : ""}`}
                  aria-pressed={on}
                  aria-label={prettyCard(card)}
                  onClick={() =>
                    setPicked((current) =>
                      current.includes(card.id)
                        ? current.filter((id) => id !== card.id)
                        : current.length < rite.cards
                          ? [...current, card.id]
                          : current,
                    )
                  }
                >
                  <PlayCard card={card} />
                </button>
              );
            })}
          </div>

          <div className="sheet-acts">
            <button type="button" className="btn btn-quiet" onClick={game.closeLeaf}>
              Put it back
            </button>
            <button type="button" className="btn btn-play" disabled={!enough} onClick={() => game.applyRite(picked, suit)}>
              Work it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── A leaf, open, waiting for a choice ────────
  return (
    <div className="veil">
      <div className="sheet sheet-wide">
        <div className="sheet-head">
          <h2 className="poster">{spec.name}</h2>
          <span className="sheet-sub">{spec.note}</span>
        </div>

        <div className="leaf-choices">
          {leaf.contents.sigils?.map((sigil) => (
            <button key={sigil.id} type="button" className="leaf-choice" onClick={() => game.keepFromLeaf({ sigil })}>
              <SigilCard sigil={sigil} />
              <span className="leaf-choice-note">{sigil.note}</span>
            </button>
          ))}

          {leaf.contents.cards?.map((card, i) => (
            <button key={`${card.id}-${i}`} type="button" className="leaf-choice" onClick={() => game.keepFromLeaf({ card })}>
              <PlayCard card={card} />
              <span className="leaf-choice-note">{card.mark ? `${prettyCard(card)}, marked` : prettyCard(card)}</span>
            </button>
          ))}

          {leaf.contents.rites?.map((rite) => (
            <button key={rite.id} type="button" className="leaf-choice" onClick={() => game.keepFromLeaf({ rite })}>
              <span className="rite-card" style={{ "--field": rite.field, "--ink": rite.ink, "--plate": rite.plate } as React.CSSProperties}>
                <span className="rite-glyph poster">{rite.glyph}</span>
                <span className="rite-name poster">{rite.name}</span>
              </span>
              <span className="leaf-choice-note">{rite.note}</span>
            </button>
          ))}
        </div>

        <div className="sheet-acts">
          <button type="button" className="btn btn-quiet" onClick={game.closeLeaf}>
            Keep none
          </button>
        </div>
      </div>
    </div>
  );
}
