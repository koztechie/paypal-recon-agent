// Proxy for the agent's on-demand AI explanation endpoint (stage 85). The detail
// panel's "AI" block POSTs { kind, ref } here; this forwards it to the agent server
// (POST /api/explain), which explains WHY the row carries its reconciliation status
// (LLM over database facts, deterministic fallback on timeout/error).

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  let body: { kind?: unknown; ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Request body must be JSON.' }, { status: 400 });
  }
  if (typeof body.kind !== 'string' || typeof body.ref !== 'string' || !body.ref.trim()) {
    return Response.json({ ok: false, error: 'kind and ref required.' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: body.kind, ref: body.ref }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(35_000)]),
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { ok: false, error: 'The explanation service is unreachable.' },
      { status: 502 },
    );
  }
}
