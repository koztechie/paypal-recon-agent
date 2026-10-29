import type { Metadata } from 'next';
import { connection } from 'next/server';
import { EndpointPage } from '../endpoint-page';

export const metadata: Metadata = { title: 'Ledger' };

type LedgerRow = {
  kind: 'PAYMENT' | 'INVOICE' | 'EVENT';
  ref: string;
  status: string;
  recon: string;
  amount: string | number;
  fee: string;
  variance: string | number;
  currency: string;
  at: string;
  note: string;
};

const API = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';

export default async function ReconciliationLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<{ bench?: string }>;
}) {
  await connection();
  const bench = (await searchParams)?.bench;
  const benchParam = bench && /^\d+$/.test(bench) ? `?bench=${bench}` : "";
  const res = await fetch(`${API}/api/recon/rows${benchParam}`, { cache: 'no-store' });
  if (!res.ok) {
    // Surfaced by app/(endpoints)/error.tsx with a retry button.
    throw new Error(`GET /api/recon/rows failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { rows: LedgerRow[] };
  // Amounts arrive as strings; numbers make the grid's NUMBER filters compare
  // numerically (stage 84: "over $50" must drop a $10 row).
  const rows = data.rows.map((r, i) => ({
    id: `${r.kind}-${i}-${r.ref}`,
    ...r,
    amount: r.amount === '' ? '' : Number(r.amount),
    variance: r.variance === '' ? '' : Number(r.variance),
  }));

  return (
    <EndpointPage
      title="Reconciliation ledger"
      calls={['GET /api/recon/rows']}
      source="our own REST endpoint (SQLite: payments + invoices + webhook events)"
      note="The agent's journal: every payment with its reconciliation outcome (status, variance, AI explanation), every locally synced invoice, and every raw webhook event — the data the grid, the agent, and the tax reports all read from."
      rows={rows}
      nlApi="/api/nl"
      explainApi="/api/explain"
      actionApi="/api/action"
      autoFit={false}
      columns={[
        // Explicit widths (stage 90): all nine columns must fit a 1280px judge
        // screen (1216px of content after px-8) with no horizontal scrollbar —
        // auto-fit to content would push Details/Date past the viewport.
        { field: 'kind', headerName: 'Type', width: 105 },
        { field: 'ref', headerName: 'Reference', width: 205 },
        { field: 'status', headerName: 'Status', width: 120 },
        { field: 'recon', headerName: 'Reconciliation', type: 'reconStatus', width: 150 },
        { field: 'amount', headerName: 'Amount', type: 'money', width: 105 },
        { field: 'variance', headerName: 'Variance', type: 'money', width: 105 },
        { field: 'currency', headerName: 'Currency', width: 95 },
        { field: 'at', headerName: 'Date', width: 168 },
        { field: 'note', headerName: 'Details', flex: 1, minWidth: 140, maxWidth: 340 },
      ]}
    />
  );
}
