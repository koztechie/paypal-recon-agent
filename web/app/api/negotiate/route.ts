// Proxy for the Module A negotiation endpoint (stage 99). The negotiation window
// POSTs {} here; the agent server runs the two LLM agents (and builds the contract
// when the deal settles) and returns { rounds, settled, agreedMinor, contract }.

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  try {
    const upstream = await fetch(`${API}/api/negotiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
      cache: 'no-store',
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { ok: false, error: 'The negotiation service is unreachable.' },
      { status: 502 },
    );
  }
}
