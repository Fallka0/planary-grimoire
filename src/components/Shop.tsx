"use client";

import { useState } from "react";
import { CHAPTERS, SEAL_NAME } from "@/game/seals";
import type { Sigil } from "@/game/sigils";
import { canBuy, type Offer, rerollCost } from "@/game/run";
import type { useRun } from "@/lib/useRun";
import { CardBack, SigilCard } from "./Card";

/*
  Between seals.

  The shop is printed on the same field as the table, because it is the same
  place — you have not left the book, you are deciding what to write in it. The
  only thing that reads as chrome is the ink you have left, and it sits where
  the eye lands first, because every price below is meaningless without it.
*/

type Run = ReturnType<typeof useRun>;

function Price({ ink, afford }: { ink: number; afford: boolean }) {
  return <span className={`price num${afford ? "" : " is-short"}`}>{ink} ink</span>;
}

export function Shop({ game }: { game: Run }) {
  const { run, shop } = game;
  const [opening, setOpening] = useState<Offer | null>(null);
  if (!run || !shop) return null;

  const full = run.sigils.length >= run.slots;
  const cost = rerollCost(shop);

  return (
    <div className="shop">
      <div className="shop-head">
        <div>
          <h2 className="poster">The margin</h2>
          <p>
            Chapter {run.chapter} of {CHAPTERS} · {SEAL_NAME[game.kind].toLowerCase()} next
          </p>
        </div>
        <span className="shop-ink poster num">{run.ink} ink</span>
      </div>

      {full ? <p className="shop-warn">The book is full. Sell a sigil below, or buy a wider spine.</p> : null}

      <div className="shop-rows">
        {shop.offers.map((offer) => {
          const afford = canBuy(run, offer);
          return (
            <div key={offer.key} className={`offer${offer.sold ? " is-sold" : ""}`}>
              <div className="offer-art">
                {offer.kind === "sigil" && offer.sigil ? <SigilCard sigil={offer.sigil} muted={offer.sold} /> : null}
                {offer.kind === "pack" ? (
                  <span className="pack">
                    <CardBack field="#1d1846" dot="#2d2766" />
                    <CardBack field="#1d1846" dot="#2d2766" />
                  </span>
                ) : null}
                {offer.kind === "voucher" ? <span className="voucher poster">+1</span> : null}
              </div>
              <div className="offer-copy">
                <span className="offer-name poster">{offer.name}</span>
                <p>{offer.note}</p>
                <div className="offer-foot">
                  <Price ink={offer.price} afford={afford} />
                  {offer.sold ? (
                    <span className="offer-sold poster">Taken</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-play btn-sm"
                      disabled={!afford}
                      onClick={() => (offer.kind === "pack" ? setOpening(offer) : game.purchase(offer))}
                    >
                      {offer.kind === "pack" ? "Open" : "Take it"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shop-book">
        <span className="panel-label">
          Your book · {run.sigils.length} of {run.slots}
        </span>
        <div className="shop-bookrow">
          {game.sigils.map((sigil, i) => (
            <div key={`${sigil.id}-${i}`} className="shop-held">
              <SigilCard sigil={sigil} />
              <div className="shop-held-acts">
                <button type="button" onClick={() => game.moveSigil(i, i - 1)} disabled={i === 0} aria-label={`Move ${sigil.name} left`}>
                  ←
                </button>
                <button type="button" onClick={() => game.sellSigil(i)} aria-label={`Sell ${sigil.name}`}>
                  Sell
                </button>
                <button
                  type="button"
                  onClick={() => game.moveSigil(i, i + 1)}
                  disabled={i === game.sigils.length - 1}
                  aria-label={`Move ${sigil.name} right`}
                >
                  →
                </button>
              </div>
            </div>
          ))}
          {game.sigils.length === 0 ? <p className="shop-empty">Nothing written yet. Sigils fire left to right.</p> : null}
        </div>
      </div>

      <div className="shop-acts">
        <button type="button" className="btn btn-quiet" onClick={game.again} disabled={run.ink < cost}>
          Restock · {cost} ink
        </button>
        <button type="button" className="btn btn-play" onClick={game.leaveShop}>
          Break the next seal
        </button>
      </div>

      {opening ? (
        <div className="veil" onClick={() => setOpening(null)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <h2 className="poster">{opening.name}</h2>
            <p>Keep one. The rest go back in the leaf.</p>
            <div className="pack-choices">
              {(opening.choices ?? []).map((sigil: Sigil) => (
                <button
                  key={sigil.id}
                  type="button"
                  className="pack-choice"
                  onClick={() => {
                    game.purchase(opening, sigil);
                    setOpening(null);
                  }}
                >
                  <SigilCard sigil={sigil} />
                  <span className="pack-choice-note">{sigil.note}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
