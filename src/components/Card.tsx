import type { Card as PlayingCard, Mark } from "@/game/cards";
import { isRed, MARKS } from "@/game/cards";
import type { Sigil } from "@/game/sigils";

/*
  A card, screen-printed.

  120 × 168 on cream paper, with a halftone that fades in toward the foot and
  the suit printed twice — once in a pale plate, once in ink, about six pixels
  off register. That misprint is the whole trick: it is what stops a flat SVG
  from reading as a flat SVG. Nothing here is glossy, bevelled or lit, because
  nothing anywhere in this casino is.
*/

const SUIT_PATHS: Record<string, string> = {
  H: "M50 90C22 68 6 50 6 31 6 16 17 6 31 6c9 0 16 5 19 12 3-7 10-12 19-12 14 0 25 10 25 25 0 19-16 37-44 59z",
  D: "M50 3 88 50 50 97 12 50z",
  S: "M50 4C36 24 8 39 8 60c0 13 10 22 22 22 7 0 13-3 16-8l-5 22h18l-5-22c3 5 9 8 16 8 12 0 22-9 22-22C92 39 64 24 50 4z",
  C: "M50 8a19 19 0 0 1 17 28 19 19 0 1 1-8 36l5 24H36l5-24a19 19 0 1 1-8-36A19 19 0 0 1 50 8z",
};

/** The short form printed in a card's corner when it carries a mark. */
const STAMP: Record<Exclude<Mark, "">, string> = { bonus: "+30", mult: "+4 Mult", holo: "Holo", steel: "×1.5" };

export function PlayCard({ card, dim }: { card: PlayingCard; dim?: boolean }) {
  const path = SUIT_PATHS[card.suit];
  const ink = isRed(card.suit) ? "#b3122e" : "#22060e";
  const plate = isRed(card.suit) ? "#ff5a78" : "rgba(34,6,14,0.16)";

  return (
    <div className={`card card-play${dim ? " is-dim" : ""}${card.mark === "holo" ? " is-holo" : ""}`}>
      <span className="card-halftone" aria-hidden="true" />
      {/* The second plate, printed first and slightly out of line. */}
      <svg className="card-pip card-pip-plate" viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
        <path d={path} fill={plate} />
      </svg>
      <svg className="card-pip card-pip-ink" viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
        <path d={path} fill={ink} />
      </svg>
      <span className="card-corner" style={{ color: ink }}>
        <span className="card-rank poster">{card.rank}</span>
        <svg viewBox="0 0 100 100" width="17" height="17" aria-hidden="true">
          <path d={path} fill={ink} />
        </svg>
      </span>
      {card.mark ? (
        <span className="card-stamp poster" style={{ color: MARKS[card.mark].ink }}>
          {STAMP[card.mark]}
        </span>
      ) : null}
    </div>
  );
}

/** The art printed in a sigil's window. Flat shapes, two inks, nothing else. */
function SigilArt({ sigil }: { sigil: Sigil }) {
  const { art, ink, plate, big } = sigil;
  if (art === "num")
    return (
      <span className="sigil-num poster">
        <span className="sigil-num-plate" style={{ color: plate }}>
          {big}
        </span>
        <span style={{ color: ink }}>{big}</span>
      </span>
    );
  if (art === "chip")
    return (
      <svg viewBox="0 0 40 40" width="74" height="74" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill={plate} />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke={ink} strokeWidth="4" strokeDasharray="6.1 6.1" />
        <circle cx="20" cy="20" r="10.5" fill={ink} />
        <circle cx="20" cy="20" r="6.5" fill={plate} />
      </svg>
    );
  if (art === "stack")
    return (
      <span className="sigil-stack">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} style={{ background: i % 2 ? ink : plate }} />
        ))}
      </span>
    );
  if (art === "backs")
    return (
      <span className="sigil-backs">
        <i style={{ background: plate, boxShadow: `inset 0 0 0 3px ${sigil.field}, inset 0 0 0 4.5px ${ink}` }} />
        <i style={{ background: plate, boxShadow: `inset 0 0 0 3px ${sigil.field}, inset 0 0 0 4.5px ${ink}` }} />
        <i style={{ background: ink }} />
      </span>
    );
  if (art === "rings")
    return (
      <span className="sigil-rings">
        <i style={{ border: `5px solid ${ink}` }} />
        <i style={{ border: `5px solid ${plate}` }} />
        <i style={{ background: ink }} />
      </span>
    );
  if (art === "moon")
    return (
      <svg viewBox="0 0 100 100" width="78" height="78" aria-hidden="true">
        <circle cx="50" cy="50" r="38" fill={plate} />
        <circle cx="66" cy="42" r="32" fill={sigil.field} />
        <circle cx="30" cy="36" r="4" fill={ink} />
        <circle cx="24" cy="56" r="3" fill={ink} />
      </svg>
    );
  if (art === "eye")
    return (
      <svg viewBox="0 0 100 100" width="84" height="84" aria-hidden="true">
        <path d="M6 50C22 26 78 26 94 50 78 74 22 74 6 50z" fill={plate} />
        <circle cx="50" cy="50" r="17" fill={ink} />
        <circle cx="44" cy="44" r="5" fill={sigil.field} />
      </svg>
    );
  // key
  return (
    <svg viewBox="0 0 100 100" width="78" height="78" aria-hidden="true">
      <circle cx="36" cy="36" r="22" fill="none" stroke={ink} strokeWidth="9" />
      <path d="M50 50 86 86" stroke={ink} strokeWidth="9" strokeLinecap="round" />
      <path d="M70 70 84 56M80 80 92 68" stroke={plate} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function SigilCard({ sigil, muted }: { sigil: Sigil; muted?: boolean }) {
  return (
    <div
      className={`card card-sigil${muted ? " is-dim" : ""}`}
      style={{ "--field": sigil.field, "--ink": sigil.ink, "--plate": sigil.plate } as React.CSSProperties}
    >
      <span className="sigil-window">
        <span className="card-halftone is-sigil" aria-hidden="true" />
        <span className="sigil-art">
          <SigilArt sigil={sigil} />
        </span>
      </span>
      <span className="sigil-copy">
        <span className="sigil-name poster">{sigil.name}</span>
        <span className="sigil-tier poster">{sigil.tier}</span>
      </span>
    </div>
  );
}

/** The back of a card: the house chip on the deck's own field. */
export function CardBack({ field = "#b3122e", dot = "#7e0c22" }: { field?: string; dot?: string }) {
  return (
    <div className="card card-back" style={{ "--field": field, "--dot": dot } as React.CSSProperties}>
      <span className="card-back-rule" aria-hidden="true" />
      <svg viewBox="0 0 40 40" width="46" height="46" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill="#f6eee4" />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke={field} strokeWidth="4" strokeDasharray="6.1 6.1" />
        <circle cx="20" cy="20" r="10.5" fill={field} />
        <text x="20" y="26.2" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="var(--font-poster)" fill="#f6eee4">
          G
        </text>
      </svg>
    </div>
  );
}
