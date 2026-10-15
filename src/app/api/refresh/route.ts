const AUTH_API = process.env.AUTH_API_URL || "https://auth.planary.ch";

// Server-side hop to planary-auth's refresh, like /api/me: swaps a refresh token for a fresh
// pair without the browser having to talk to auth.planary.ch across origins.
export async function POST(request: Request) {
  const body = await request.text();
  try {
    const res = await fetch(`${AUTH_API}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
    });
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "auth unavailable" }, { status: 502 });
  }
}
