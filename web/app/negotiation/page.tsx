'use client';

// Stage 99: the negotiation window — buyer agent | seller agent in two columns,
// a "Run negotiation" action, and a "Settled" button that reveals the contract
// JSON built from the deal. Fully data-driven from POST /api/negotiate (stage 99
// endpoint) — the same negotiate() + buildContract() the console scripts use.

import Link from 'next/link';
import { TopNav } from '../components/top-nav';
import { useEffect, useRef, useState } from 'react';

type Round = { round: number; agent: 'buyer' | 'seller'; message: string; priceMinor: number };
type Contract = {
  id: string;
  status: string;
  subject: { item: string; quantity: number; currency: string };
  price: { total_minor: number; unit_minor: number };
  terms: { type: string; days: number };
  summary: string;
  parties: { buyer_email?: string };
  negotiation: { rounds: number };
};
type RunResult = { rounds: Round[]; settled: boolean; agreedMinor: number | null; contract: Contract | null; reason?: string };

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;
const moneyFull = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

export default function NegotiationWindow() {
  const [status, setStatus] = useState<'idle' | 'running' | 'revealing' | 'ready' | 'locked' | 'error'>('idle');
  const [result, setResult] = useState<RunResult | null>(null);
  const [visible, setVisible] = useState(0); // progressively revealed rounds
  const [error, setError] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const run = async () => {
    setStatus('running');
    setError('');
    setResult(null);
    setVisible(0);
    try {
      const res = await fetch('/api/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(55_000),
      });
      const data = (await res.json()) as RunResult & { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'negotiation failed');
      setResult(data);
      setStatus('revealing');
      // Reveal rounds one by one so the two columns fill like a live conversation.
      data.rounds.forEach((_, i) => {
        timers.current.push(setTimeout(() => setVisible(i + 1), (i + 1) * 750));
      });
      timers.current.push(setTimeout(() => setStatus('ready'), (data.rounds.length + 1) * 750));
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const lock = () => setStatus('locked');

  const buyerRounds = (result?.rounds ?? []).slice(0, visible).filter((r) => r.agent === 'buyer');
  const sellerRounds = (result?.rounds ?? []).slice(0, visible).filter((r) => r.agent === 'seller');
  const canSettle = status === 'ready' && !!result?.settled;
  const c = status === 'locked' ? result?.contract : null;

  return (
    <main className="min-h-dvh bg-pp-canvas px-8 py-6 font-paypal text-pp-ink">
      <div className="flex items-center justify-between gap-4">
        <TopNav />
        <Link href="/" className="text-sm font-semibold text-pp-blue-dark hover:underline">
          ← All pages
        </Link>
      </div>
      <h1 className="mt-3 text-[28px] font-semibold text-pp-navy">Negotiation window</h1>
      <p className="mt-2 text-sm text-pp-muted">
        Two LLM agents haggle over one batch order — buyer authorization $460, seller floor $450,
        hard cap 10 rounds. No action without a settled contract.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={status === 'running' || status === 'revealing'}
          className="h-10 rounded bg-pp-blue px-5 text-sm font-semibold text-white hover:bg-pp-blue-dark disabled:opacity-50"
        >
          {status === 'running' || status === 'revealing' ? 'Negotiating…' : 'Run negotiation'}
        </button>
        <button
          type="button"
          onClick={lock}
          disabled={!canSettle}
          aria-label="Settled"
          className={`h-10 rounded px-5 text-sm font-semibold ${
            canSettle || status === 'locked'
              ? 'bg-pp-success text-white hover:opacity-90'
              : 'border border-pp-border bg-white text-pp-muted opacity-60'
          }`}
        >
          {status === 'locked'
            ? `Settled ✓ ${result?.agreedMinor != null ? money(result.agreedMinor) : ''}`
            : canSettle && result?.agreedMinor != null
              ? `Settled — ${money(result.agreedMinor)}`
              : 'Settled'}
        </button>
        <span role="status" aria-live="polite" className="text-xs text-pp-muted">
          {status === 'idle' && 'Idle — press "Run negotiation".'}
          {status === 'running' && 'Both agents are thinking…'}
          {status === 'revealing' && 'Exchanging offers…'}
          {status === 'ready' && (result?.settled ? 'Deal reached — press "Settled" to lock it.' : `Not settled: ${result?.reason ?? ''}`)}
          {status === 'locked' && 'Agreement locked — contract JSON below.'}
          {status === 'error' && `Error: ${error}`}
        </span>
      </div>

      {/* two columns: buyer | seller */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section aria-label="Buyer agent" className="rounded border border-pp-border bg-white p-4">
          <h2 className="text-sm font-semibold text-pp-navy">Buyer agent <span className="font-normal text-pp-muted">— budget open $400, max $460</span></h2>
          <ul className="mt-3 space-y-2">
            {buyerRounds.map((r) => (
              <li key={r.round} className="rounded bg-pp-highlight px-3 py-2 text-sm">
                <span className="mr-2 font-semibold text-pp-blue">R{r.round}</span>
                {r.message}
                <span className="ml-2 text-xs text-pp-muted">({money(r.priceMinor)})</span>
              </li>
            ))}
            {buyerRounds.length === 0 && <li className="text-sm text-pp-muted">—</li>}
          </ul>
        </section>
        <section aria-label="Seller agent" className="rounded border border-pp-border bg-white p-4">
          <h2 className="text-sm font-semibold text-pp-navy">Seller agent <span className="font-normal text-pp-muted">— floor $450</span></h2>
          <ul className="mt-3 space-y-2">
            {sellerRounds.map((r) => (
              <li key={r.round} className="rounded bg-pp-canvas px-3 py-2 text-sm">
                <span className="mr-2 font-semibold text-pp-success">R{r.round}</span>
                {r.message}
                <span className="ml-2 text-xs text-pp-muted">({money(r.priceMinor)})</span>
              </li>
            ))}
            {sellerRounds.length === 0 && <li className="text-sm text-pp-muted">—</li>}
          </ul>
        </section>
      </div>

      {c && (
        <section aria-label="Contract" className="mt-4 rounded border border-pp-border bg-white p-4">
          <h2 className="text-sm font-semibold text-pp-navy">Contract {c.id} <span className="font-normal text-pp-success">— settled</span></h2>
          <dl className="mt-2 grid grid-cols-[minmax(90px,auto)_1fr] gap-x-5 gap-y-1 text-sm">
            <dt className="font-semibold text-pp-muted">subject</dt>
            <dd>
              {c.subject.quantity} × {c.subject.item}
            </dd>
            <dt className="font-semibold text-pp-muted">total</dt>
            <dd data-testid="contract-total">
              {moneyFull(c.price.total_minor, c.subject.currency)} (unit {moneyFull(c.price.unit_minor, c.subject.currency)})
            </dd>
            <dt className="font-semibold text-pp-muted">terms</dt>
            <dd>
              {c.terms.type} {c.terms.days} days
            </dd>
            <dt className="font-semibold text-pp-muted">buyer</dt>
            <dd>{c.parties.buyer_email ?? '—'}</dd>
            <dt className="font-semibold text-pp-muted">summary</dt>
            <dd>{c.summary}</dd>
          </dl>
        </section>
      )}
    </main>
  );
}
