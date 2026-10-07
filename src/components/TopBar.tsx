"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { CHAPTERS, SEAL_NAME, type SealKind } from "@/game/seals";
import { sfx } from "@/lib/audio";
import { buildAuthUrl } from "@/lib/auth";
import { absorbSessionFromHash, loadSession } from "@/lib/session";

const CASINO_URL = process.env.NEXT_PUBLIC_CASINO_URL || "https://casino.planary.ch";

/**
 * Who is playing, if anybody.
 *
 * Signing in is optional here and always will be: nothing is staked, so the
 * game owes a stranger a full run. A session only decides whether a finished
 * book is recorded in the casino, so the prompt says that rather than standing
 * in the way.
 */
function Who() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const session = absorbSessionFromHash() ?? loadSession();
    setName(session?.name ?? null);
  }, []);

  if (name) return <span className="who" title="Finished books are recorded in the casino">{name}</span>;
  return (
    <button
      type="button"
      className="who who-signin"
      onClick={() => window.location.assign(buildAuthUrl("login", window.location.href.split("#")[0], true))}
    >
      Sign in to keep the badges
    </button>
  );
}

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

/** The one control over the sound: on, or off, and remembered. */
function Mute() {
  const [muted, setMuted] = useState(false);
  useEffect(() => setMuted(sfx.muted), []);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={muted}
      aria-label={muted ? "Turn the sound on" : "Turn the sound off"}
      title={muted ? "Sound off" : "Sound on"}
      onClick={() => {
        sfx.begin();
        sfx.setMuted(!muted);
        setMuted(!muted);
      }}
    >
      {muted ? <VolumeX size={17} strokeWidth={1.9} aria-hidden="true" /> : <Volume2 size={17} strokeWidth={1.9} aria-hidden="true" />}
    </button>
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
      <Mute />
      <Who />
    </header>
  );
}
