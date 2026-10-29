// Proxy for the agent's guarded row-action endpoint (stage 86). The detail panel's
// action buttons POST { action, kind, ref } here; this forwards it to the agent
// server (POST /api/action): "send_reminder" is a real (guarded) PayPal call,
// "mark_matched" is the human REVIEW->MATCHED resolution. The UI receives
// { ok, action, message } — refusals included (ok:false).

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  let body: { action?: unknown; kind?: unknown; ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Request body must be JSON.' }, { status: 400 });
  }
  if (
    typeof body.action !== 'string' ||
    typeof body.kind !== 'string' ||
    typeof body.ref !== 'string' ||
    !body.ref.trim()
  ) {
    return Response.json(
      { ok: false, error: 'action, kind and ref are required.' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${API}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: body.action, kind: body.kind, ref: body.ref }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { ok: false, error: 'The action service is unreachable.' },
      { status: 502 },
    );
  }
}
