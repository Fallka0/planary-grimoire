"use client";

import { formatNumber } from "@/game/cards";
import { CHAPTERS, quotaFor, SEAL_NAME, SEAL_ORDER, type SealKind, wardenFor } from "@/game/seals";
import { SEAL_REWARD } from "@/game/seals";
import { TOKEN_BY_ID } from "@/game/tokens";
import type { useRun } from "@/lib/useRun";

/*
  Choosing the next seal.

  All three of the chapter are on the table at once, in order, and the one you
  are on is the only one lit — what is behind you is spent, what is ahead is
  printed so you can see it coming. The warden's rule is published here rather
  than sprung at the table, because the game is in rebuilding a book to survive
  a rule you already knew about.

  Refusing is the other half. The first two seals can be walked away from for a
  token; the warden cannot, which is what stops the whole thing being a way to
  skip the game.
*/

type Run = ReturnType<typeof useRun>;

/** The disc on a seal, printed like a chip and coloured by rank. */
function Disc({ kind, label }: { kind: SealKind; label: string }) {
  const ink = kind === "lesser" ? "#8ea4ff" : kind === "greater" ? "#f7d77e" : "#ff5a78";
  const deep = kind === "lesser" ? "#1d2a5c" : kind === "greater" ? "#16100a" : "#1a060e";
  return (
    <span className="seal-disc" style={{ "--disc": ink, "--disc-deep": deep } as React.CSSProperties}>
      <span className="poster">{label}</span>
    </span>
  );
}

function reward(kind: SealKind): string {
  return "$".repeat(SEAL_REWARD[kind]);
}

export function SealSelect({ game }: { game: Run }) {
  const run = game.run;
  if (!run) return null;

  const warden = wardenFor(run.chapter);
  const tokens = run.tokens.map((id) => TOKEN_BY_ID.get(id)).filter(Boolean);

  return (
    <div className="choose">
      <div className="choose-head">
        <h1 className="poster">
          Choose your
          <br />
          next seal
        </h1>
        <p>
          Chapter {run.chapter} of {CHAPTERS}. Each is broken in order; the first two can be refused for a token, the warden cannot.
        </p>
        {tokens.length ? (
          <ul className="choose-tokens" aria-label="Tokens waiting for the next shop">
            {tokens.map((token, i) => (
              <li key={`${token!.id}-${i}`} style={{ "--field": token!.field, "--ink": token!.ink } as React.CSSProperties}>
                <span className="poster">{token!.glyph}</span>
                {token!.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ol className="seals">
        {SEAL_ORDER.map((kind, index) => {
          const state = index < run.seal ? (run.refused.includes(index) ? "refused" : "done") : index === run.seal ? "now" : "ahead";
          const quota = quotaFor(run.chapter, kind);
          return (
            <li key={kind} className={`seal is-${state}`}>
              <span className="seal-state poster">
                {state === "done" ? "Broken" : state === "refused" ? "Refused" : state === "now" ? "Now" : "Ahead"}
              </span>

              {state === "now" ? (
                <button type="button" className="btn btn-play seal-select" onClick={game.chooseSeal}>
                  Break it
                </button>
              ) : null}

              <span className="seal-name poster">{kind === "warden" ? warden.name : SEAL_NAME[kind]}</span>
              <Disc kind={kind} label={kind === "lesser" ? "I" : kind === "greater" ? "II" : "III"} />

              <span className="seal-ask">
                Score at least
                <strong className="poster num">{formatNumber(quota)}</strong>
              </span>
              <span className="seal-reward num">Pays {reward(kind)}</span>

              {kind === "warden" ? <span className="seal-rule">{warden.note}</span> : null}

              {state === "now" && game.canRefuse ? (
                <>
                  <span className="seal-or">or</span>
                  <button type="button" className="btn btn-quiet btn-sm seal-refuse" onClick={game.refuseSeal}>
                    Walk away
                  </button>
                  <span className="seal-refuse-note">No ink, but a token for the next shop.</span>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
