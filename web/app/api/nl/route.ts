// Proxy for the agent's natural-language filter endpoint (stage 84 ★). The Ledger
// grid's "Ask the ledger…" box POSTs here; this forwards the query to the agent
// server (POST /api/nl-filter), which turns it into a structured filter via the
// LLM with a deterministic fallback. Keeps the browser talking to one origin.

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Request body must be JSON.' }, { status: 400 });
  }
  if (typeof body.query !== 'string' || !body.query.trim()) {
    return Response.json({ ok: false, error: 'query required.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API}/api/nl-filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: body.query }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(35_000)]),
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { ok: false, error: 'The filter service is unreachable.' },
      { status: 502 },
    );
  }
}
