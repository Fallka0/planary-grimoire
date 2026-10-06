"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CHAPTERS, SEAL_NAME, type SealKind } from "@/game/seals";

const CASINO_URL = process.env.NEXT_PUBLIC_CASINO_URL || "https://casino.planary.ch";

/** The house chip, in this game's letter. Flat, two inks, as everywhere. */
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="var(--cherry)" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="var(--paper)" strokeWidth="4" strokeDasharray="6.1 6.1" />
      <circle cx="20" cy="20" r="10.5" fill="var(--paper)" />
      <text x="20" y="26.2" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="var(--font-poster)" fill="var(--cherry)">
        G
      </text>
    </svg>
  );
}

export function TopBar({ chapter, kind, ink }: { chapter?: number; kind?: SealKind; ink?: number }) {
  return (
    <header className="topbar">
      <a href={CASINO_URL} className="back" aria-label="Back to Planary Casino">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      </a>
      <Link href="/" className="brand" aria-label="Grimoire">
        <Mark />
        <span className="brand-copy">
          <span className="brand-name poster">Grimoire</span>
          <span className="brand-sub">Planary Casino</span>
        </span>
      </Link>

      {chapter ? (
        <div className="topbar-mid">
          <span className="pill-solid poster">{kind ? SEAL_NAME[kind] : ""}</span>
          <span className="pill-quiet num">
            Chapter {chapter} of {CHAPTERS}
          </span>
        </div>
      ) : null}

      {typeof ink === "number" ? (
        <span className="ink" title="Ink buys sigils between seals">
          <svg viewBox="0 0 40 40" width="20" height="20" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="var(--paper)" />
            <circle cx="20" cy="20" r="15.5" fill="none" stroke="#2a0710" strokeWidth="4" strokeDasharray="6.1 6.1" />
            <circle cx="20" cy="20" r="10.5" fill="#2a0710" />
            <circle cx="20" cy="20" r="6.5" fill="var(--paper)" />
          </svg>
          <strong className="num">{ink}</strong>
          <span className="ink-label">ink</span>
        </span>
      ) : null}
    </header>
  );
}
