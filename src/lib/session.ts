// Planary sessions without Supabase keys: planary-auth hands us its access token in the URL hash,
// we keep it in this browser and verify it through our own /api/me (which asks auth.planary.ch).
//
// Signing in is optional here, so two things the other games get by insisting on a session are
// done quietly instead: a silent check on the first visit (someone already signed in to Planary
// is recognised without a click), and the refresh token, so a run that outlasts the hour-long
// access token is still recorded when the book closes.

const KEY = "planary.session";
const SSO_CHECKED = "planary.sso-checked";

export interface StoredSession {
  accessToken: string;
  userId: string;
  email: string;
  /** Display name from the Planary account. */
  name: string;
  /** Epoch seconds. */
  expiresAt: number;
  /** Swaps for a fresh pair once the access token runs out; each one works once. */
  refreshToken?: string;
}

function decodeJwt(token: string): { sub?: string; email?: string; name?: string; exp?: number } | null {
  try {
    const payload = token.split(".")[1];
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    // Names can contain any characters, so decode the bytes as UTF-8.
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

function fromToken(accessToken: string, refreshToken?: string | null): StoredSession | null {
  const claims = decodeJwt(accessToken);
  if (!claims?.sub || !claims.exp) return null;
  const email = claims.email ?? "";
  return {
    accessToken,
    userId: claims.sub,
    email,
    name: claims.name || email.split("@")[0] || "Player",
    expiresAt: claims.exp,
    ...(refreshToken ? { refreshToken } : {}),
  };
}

/**
 * Picks up what planary-auth sent back in the hash and cleans the URL: `#access_token=…`
 * after a sign-in, or `#sso=none` when a silent check found nobody signed in.
 */
export function absorbSessionFromHash(): StoredSession | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (!accessToken && !params.has("sso")) return null;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  markSsoChecked();
  if (!accessToken) return null;
  const session = fromToken(accessToken, params.get("refresh_token"));
  if (session) saveSession(session);
  return session;
}

/** Whether this tab has already asked planary-auth who's signed in. Asked once, so it never loops. */
export function ssoChecked(): boolean {
  try {
    return window.sessionStorage.getItem(SSO_CHECKED) === "1";
  } catch {
    return true;
  }
}

export function markSsoChecked() {
  try {
    window.sessionStorage.setItem(SSO_CHECKED, "1");
  } catch {
    // Storage blocked: ssoChecked() already says yes, so nothing loops.
  }
}

function storedSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    return session.name ? session : null;
  } catch {
    return null;
  }
}

/** The session, if its access token is still good. An expired one is kept while it can be refreshed. */
export function loadSession(): StoredSession | null {
  const session = storedSession();
  if (!session) return null;
  // Treat tokens within a minute of expiry as expired.
  if (session.expiresAt * 1000 < Date.now() + 60_000) {
    if (!session.refreshToken) clearSession();
    return null;
  }
  return session;
}

/** A session with a working access token: the stored one, or a refreshed one if it ran out. */
export async function freshSession(): Promise<StoredSession | null> {
  const valid = loadSession();
  if (valid) return valid;
  const stale = storedSession();
  if (!stale?.refreshToken) return null;
  try {
    const res = await fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: stale.refreshToken }),
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { access_token?: string; refresh_token?: string };
      const next = body.access_token ? fromToken(body.access_token, body.refresh_token) : null;
      if (next) {
        saveSession(next);
        return next;
      }
    }
    // Used up or revoked: forget it, and the next visit asks planary-auth again.
    if (res.status === 401 || res.status === 400) clearSession();
  } catch {
    // Offline for a moment: keep the refresh token for the next try.
  }
  return null;
}

export function saveSession(session: StoredSession) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session lasts for this page view only.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Confirms the token with planary-auth (via our own route, which avoids CORS). */
export async function verifySession(session: StoredSession): Promise<boolean> {
  try {
    const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
    if (res.status === 401) return false;
    // Anything else (auth down, network) keeps the locally valid session rather than signing people out.
    return true;
  } catch {
    return true;
  }
}
