"use client";

import { Mark } from "./TopBar";

/**
 * Turn your phone.
 *
 * Grimoire is a card table: a fan of eight cards, a panel of running figures
 * and a row of sigils, all of which have to be visible while you decide. That
 * does not fit a 390-pixel column, and a portrait layout that technically
 * rendered would be a worse answer than asking for the five degrees of wrist
 * movement that make it fit properly.
 *
 * It is a gate rather than a nudge for the same reason: half of a card game is
 * worse than a short wait for the whole of it.
 */
export function Rotate() {
  return (
    <div className="rotate" role="dialog" aria-label="Turn your phone sideways">
      <div className="rotate-mark" aria-hidden="true">
        <Mark size={72} />
      </div>
      <svg className="rotate-phone" viewBox="0 0 120 120" width="112" height="112" aria-hidden="true">
        <rect x="42" y="14" width="36" height="64" rx="7" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="55" y="20" width="10" height="2.6" rx="1.3" fill="currentColor" />
        <path d="M30 92a34 34 0 0 0 60 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 7" />
        <path d="M86 84l6 10-11 2z" fill="currentColor" />
      </svg>
      <h1 className="poster">Turn your phone</h1>
      <p>
        Grimoire is dealt across the table — eight cards, your book and the figures, all at once. It wants the long edge of your screen.
      </p>
    </div>
  );
}
