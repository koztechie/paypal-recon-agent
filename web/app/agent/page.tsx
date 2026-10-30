import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { TopNav } from '../components/top-nav';

export const metadata: Metadata = { title: 'Agent' };

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

type Action = {
  id: number;
  action: string;
  limit_check: string;
  target_ref: string | null;
  executed: number;
  executed_at: string | null;
  llm_decision: string | null;
};

// The Agent screen (stage 104): what the agent IS (runtime) and what it DID
// (the append-only audit trail from agent_actions — blocked attempts included).
export default async function AgentPage() {
  await connection();
  const res = await fetch(`${API}/api/agent-summary`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/agent-summary failed: HTTP ${res.status}`);
  const data = (await res.json()) as {
    actions: Action[];
    totals: { total: number; blocked: number; executed: number };
    llm: { provider: string; model: string };
  };

  const stats = [
    { label: 'Actions logged', value: data.totals.total },
    { label: 'Executed', value: data.totals.executed },
    { label: 'Blocked by guardrails', value: data.totals.blocked },
    { label: 'Model', value: `${data.llm.provider} / ${data.llm.model}` },
  ];

  return (
    <main className="flex h-dvh flex-col bg-pp-canvas px-8 py-6 font-paypal text-pp-ink">
      <div className="flex items-center justify-between gap-4">
        <TopNav />
        <Link href="/" className="text-sm font-semibold text-pp-blue hover:underline">
          ← All pages
        </Link>
      </div>
      <h1 className="mt-3 text-[28px] font-semibold text-pp-navy">Agent</h1>
      <p className="mt-2 max-w-4xl text-sm text-pp-muted">
        The reconciliation agent&apos;s runtime and its append-only audit trail: every action
        attempt is recorded, blocked attempts included (SECURITY rule 3).
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded border border-pp-border bg-white p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-pp-muted">{s.label}</dt>
            <dd className={`mt-1 font-semibold text-pp-navy ${String(s.value).length > 12 ? 'text-sm' : 'text-2xl'}`}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 min-h-0 flex-1 overflow-auto rounded border border-pp-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-pp-canvas text-xs uppercase tracking-wider text-pp-muted">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Limit</th>
              <th className="px-4 py-2">Executed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pp-border">
            {data.actions.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-pp-muted">{a.executed_at ?? '—'}</td>
                <td className="px-4 py-2 font-semibold">{a.action}</td>
                <td className="max-w-[16rem] truncate px-4 py-2 text-xs">{a.target_ref ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      a.limit_check === 'BLOCKED' ? 'bg-pp-danger/10 text-pp-danger' : 'bg-pp-success/10 text-pp-success'
                    }`}
                  >
                    {a.limit_check}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">{a.executed ? 'yes' : 'no'}</td>
              </tr>
            ))}
            {data.actions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-pp-muted">
                  No actions yet — run <code className="rounded bg-pp-canvas px-1">npm run demo</code>{' '}
                  (negotiate → invoice → payment) and the agent&apos;s trail fills up here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
