import Link from 'next/link';
import { TopNav } from './components/top-nav';

const dashboard = { href: '/dashboard', label: 'Dashboard', detail: 'AG Studio reports over all of the data' };

// One page per PayPal endpoint the demo calls, each in app/(endpoints).
const endpoints = [
  { href: '/products', label: 'Catalog products', detail: 'GET /v1/catalogs/products' },
  { href: '/plans', label: 'Billing plans', detail: 'GET /v1/billing/plans' },
  { href: '/invoices', label: 'Invoices', detail: 'GET /v2/invoicing/invoices' },
  { href: '/transactions', label: 'Transactions', detail: 'GET /v1/reporting/transactions' },
  { href: '/balances', label: 'Balances', detail: 'GET /v1/reporting/balances' },
];

function PageLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <li>
      <Link href={href} className="flex items-baseline justify-between gap-4 py-3 hover:text-pp-blue">
        <span className="font-semibold">{label} →</span>
        <code className="text-sm text-pp-muted">{detail}</code>
      </Link>
    </li>
  );
}

// The 5-second homepage (stage 103 ★): ONE scenario — see the product, open the
// Ledger (the working seller tool). Everything else lives below the fold.
export default function Home() {
  return (
    <main className="min-h-dvh bg-pp-canvas px-8 py-6 font-paypal text-pp-ink">
      <div className="mx-auto max-w-3xl">
        {/* app chrome (stage 106: same nav on every screen) */}
        <TopNav />

        {/* trust line */}
        <p className="text-xs font-semibold uppercase tracking-wider text-pp-muted">
          PayPal sandbox · AG Grid + AG Studio · live data
        </p>

        {/* hero */}
        <h1 className="mt-6 text-[40px] font-semibold leading-tight text-pp-navy">
          Cross-Border Reconciliation Agent
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-pp-muted">
          The seller&apos;s AI agent that reconciles every PayPal payment, explains every
          mismatch, and acts — inside hard guardrails.
        </p>

        {/* primary CTA + secondaries */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/reconciliation"
            className="h-12 rounded bg-pp-blue px-7 text-base font-semibold text-white hover:bg-pp-blue-dark"
          >
            Open the Ledger →
          </Link>
          <Link href="/negotiation" className="text-sm font-semibold text-pp-blue-dark hover:underline">
            Negotiation demo →
          </Link>
          <Link href="/dashboard" className="text-sm font-semibold text-pp-blue-dark hover:underline">
            AG Studio dashboard →
          </Link>
        </div>

        {/* proof chips — evidence-backed facts, not hype */}
        <ul className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-pp-navy">
          {['139 live rows', 'AI explains every mismatch', 'Audited guardrails'].map((chip) => (
            <li key={chip} className="rounded-full border border-pp-border bg-white px-3 py-1">
              {chip}
            </li>
          ))}
        </ul>

        {/* below the fold: the boilerplate API surface, kept for exploration */}
        <h2 className="mt-14 text-sm font-semibold uppercase tracking-wider text-pp-muted">
          PayPal API surface
        </h2>
        <ul className="mt-2 divide-y divide-pp-border border-y border-pp-border">
          <PageLink {...dashboard} />
          {endpoints.map((page) => (
            <PageLink key={page.href} {...page} />
          ))}
        </ul>
      </div>
    </main>
  );
}
