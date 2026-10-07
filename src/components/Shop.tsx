"use client";

import { CHAPTERS, SEAL_NAME } from "@/game/seals";
import { canBuy, type Offer, rerollCost } from "@/game/run";
import type { useRun } from "@/lib/useRun";
import { CardBack, PlayCard, SigilCard } from "./Card";

/*
  The margin — what you do between seals.

  Laid out the way the thing it is modelled on lays it out, because that shape
  is right: the two decisions you make every time (leave, or restock) sit on
  the left where your hand already is, the sigils run along the top where they
  are compared against each other, and the covenant and the leaves sit below on
  their own shelf because they are a different kind of purchase — one is for
  the rest of the run, the others are a surprise you are paying for.
*/

type Run = ReturnType<typeof useRun>;

function Price({ offer, afford }: { offer: Offer; afford: boolean }) {
  if (offer.price === 0) return <span className="ware-price is-free poster">Free</span>;
  return <span className={`tab-price poster${afford ? "" : " is-short"}`}>{offer.price}</span>;
}

/** One thing for sale: its art, its price tab, and what it does. */
function ForSale({ offer, game, wide }: { offer: Offer; game: Run; wide?: boolean }) {
  const run = game.run!;
  const afford = canBuy(run, offer);
  const full = offer.kind === "sigil" && run.sigils.length >= run.slots;

  return (
    <div className={`ware${offer.sold ? " is-sold" : ""}${wide ? " is-wide" : ""}`}>
      <Price offer={offer} afford={afford} />
      <button
        type="button"
        className="ware-art"
        disabled={!afford}
        onClick={() => game.buyOffer(offer)}
        aria-label={`${offer.name}, ${offer.price} ink`}
        title={full ? "The book is full" : offer.note}
      >
        {offer.kind === "sigil" && offer.sigil ? <SigilCard sigil={offer.sigil} muted={offer.sold} /> : null}
        {offer.kind === "leaf" ? (
          <span className={`leaf leaf-${offer.leaf}`}>
            <span className="leaf-label poster">{offer.leaf === "sigil" ? "Sigils" : offer.leaf === "card" ? "Cards" : "Rites"}</span>
            <span className="leaf-seal poster">❧</span>
          </span>
        ) : null}
        {offer.kind === "covenant" && offer.covenant ? (
          <span className="covenant" style={{ "--field": offer.covenant.field, "--ink": offer.covenant.ink, "--plate": offer.covenant.plate } as React.CSSProperties}>
            <span className="covenant-rule" aria-hidden="true" />
            <span className="covenant-name poster">{offer.covenant.name}</span>
          </span>
        ) : null}
      </button>
      <p className="ware-note">{offer.sold ? "Taken." : offer.note}</p>
    </div>
  );
}

export function Shop({ game }: { game: Run }) {
  const { run, shop } = game;
  if (!run || !shop) return null;

  const cost = rerollCost(run, shop);
  const full = run.sigils.length >= run.slots;

  return (
    <div className="margin">
      <aside className="margin-side">
        <div className="margin-sign">
          <span className="poster">The margin</span>
          <span className="margin-sub">Spend it before the next seal</span>
        </div>
        <button type="button" className="btn btn-play margin-next" onClick={game.leaveShop}>
          Next seal
        </button>
        <button type="button" className="btn margin-reroll" onClick={game.again} disabled={run.ink < cost}>
          Restock
          <strong className="poster">{cost === 0 ? "free" : cost}</strong>
        </button>
        <div className="margin-ink">
          <span className="margin-label">Ink</span>
          <span className="poster num">{run.ink}</span>
        </div>
        <p className="margin-where">
          Chapter {run.chapter} of {CHAPTERS} · {SEAL_NAME[game.kind].toLowerCase()} next
        </p>
      </aside>

      <section className="margin-stock">
        <div className="rack rack-sigils">
          {shop.sigils.map((offer) => (
            <ForSale key={offer.key} offer={offer} game={game} />
          ))}
          {full ? <p className="rack-warn">The book is full. Sell one below, or sign for a wider spine.</p> : null}
        </div>

        <div className="rack rack-lower">
          <div className="rack-covenant">
            <span className="rack-label poster">Chapter {run.chapter} covenant</span>
            {shop.covenant ? (
              <ForSale offer={shop.covenant} game={game} wide />
            ) : (
              <p className="rack-none">
                {run.covenants.length ? "One a chapter, and this chapter's is signed." : "Offered at the first shop of a chapter."}
              </p>
            )}
          </div>
          <div className="rack-leaves">
            {shop.leaves.map((offer) => (
              <ForSale key={offer.key} offer={offer} game={game} />
            ))}
          </div>
        </div>
      </section>

      <section className="margin-book">
        <span className="margin-label">
          Your book · {run.sigils.length} of {run.slots} · they fire left to right
        </span>
        <div className="margin-bookrow">
          {game.sigils.map((sigil, i) => (
            <div key={`${sigil.id}-${i}`} className="held">
              <SigilCard sigil={sigil} />
              <div className="held-acts">
                <button type="button" onClick={() => game.moveSigil(i, i - 1)} disabled={i === 0} aria-label={`Move ${sigil.name} earlier`}>
                  ←
                </button>
                <button type="button" onClick={() => game.sellSigil(i)} aria-label={`Sell ${sigil.name}`}>
                  Sell
                </button>
                <button
                  type="button"
                  onClick={() => game.moveSigil(i, i + 1)}
                  disabled={i === game.sigils.length - 1}
                  aria-label={`Move ${sigil.name} later`}
                >
                  →
                </button>
              </div>
            </div>
          ))}
          {game.sigils.length === 0 ? <p className="rack-none">Nothing written yet.</p> : null}
          {run.covenants.length ? (
            <ul className="held-covenants" aria-label="Covenants signed">
              {run.covenants.map((id) => (
                <li key={id} className="poster">
                  {id}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {/* The deck, so a rite's effect on it is never invisible. */}
      <aside className="margin-deck" aria-label={`${run.cards.length} cards in the deck`}>
        <CardBack />
        <span className="margin-deck-count num">{run.cards.length}</span>
      </aside>
    </div>
  );
}

/** A small preview of a card, used inside an opened leaf. */
export function LeafCard({ card }: { card: Parameters<typeof PlayCard>[0]["card"] }) {
  return <PlayCard card={card} />;
}
