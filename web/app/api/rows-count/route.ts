// Server-side count for the landing chip (stage 113). Kept as an API route so the
// page itself stays statically prerendered (Lighthouse criterion, stage 109).

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${API}/api/recon/rows?count=1`, { cache: 'no-store' });
    if (!res.ok) return Response.json({ error: `upstream ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { count?: number };
    return Response.json({ count: data.count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'agent API unreachable' }, { status: 502 });
  }
}
