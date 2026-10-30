import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { TopNav } from '../components/top-nav';

export const metadata: Metadata = { title: 'Settings' };

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

type Config = {
  mode: string;
  llm: { provider: string; model: string; fallback: string };
  limits: Record<string, number>;
  defaults: Record<string, number>;
  source: string;
};

// The Settings screen (stage 104): the configuration the agent actually runs with —
// read-only facts from the agent server (.env.local + SECURITY constants). No secrets.
export default async function SettingsPage() {
  await connection();
  const res = await fetch(`${API}/api/app-config`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET /api/app-config failed: HTTP ${res.status}`);
  const cfg = (await res.json()) as Config;

  const groups: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: 'Runtime',
      rows: [
        ['Mode', cfg.mode],
        ['LLM provider', cfg.llm.provider],
        ['LLM model', cfg.llm.model],
        ['LLM fallback', cfg.llm.fallback],
      ],
    },
    {
      title: 'Guardrails',
      rows: [
        ['Invoice auto-limit', `$${cfg.limits.create_invoice_usd}`],
        ['Reminders per 24 h', String(cfg.limits.reminders_per_24h)],
        ['Reminders lifetime', String(cfg.limits.reminders_lifetime)],
        ['Negotiation max rounds', String(cfg.limits.negotiation_max_rounds)],
        ['NL deadline', `${(cfg.limits.nl_deadline_ms / 1000).toFixed(0)} s`],
      ],
    },
    {
      title: 'Defaults',
      rows: [
        ['Payment terms', `net ${cfg.defaults.payment_days} days`],
        ['Config source', cfg.source],
      ],
    },
  ];

  return (
    <main className="flex h-dvh flex-col bg-pp-canvas px-8 py-6 font-paypal text-pp-ink">
      <div className="flex items-center justify-between gap-4">
        <TopNav />
        <Link href="/" className="text-sm font-semibold text-pp-blue-dark hover:underline">
          ← All pages
        </Link>
      </div>
      <h1 className="mt-3 text-[28px] font-semibold text-pp-navy">Settings</h1>
      <p className="mt-2 max-w-4xl text-sm text-pp-muted">
        What the agent actually runs with — read-only. Values come from{' '}
        <code className="rounded bg-pp-highlight px-1">.env.local</code> and the SECURITY
        constants; no secrets are ever shown or stored in the repo.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <section key={g.title} className="rounded border border-pp-border bg-white p-4">
            <h2 className="text-sm font-semibold text-pp-navy">{g.title}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {g.rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="text-pp-muted">{k}</dt>
                  <dd className="text-right font-semibold text-pp-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </main>
  );
}
