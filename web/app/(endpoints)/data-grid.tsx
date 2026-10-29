'use client';

// The AG Grid used by every endpoint page. Pages are server components, so the columns they pass
// must be plain data, with no functions. Money columns name the column type below
// (`type: 'money'`), which keeps the formatter here on the client; date columns set the grid's
// built-in `cellDataType: 'dateString'` ('YYYY-MM-DD') or `'dateTimeString'` ('YYYY-MM-DDThh:mm:ssZ').
// Clicking a row opens the detail panel below the grid (stage 82): every field of the row,
// plus a pretty-printed raw payload when the row carries one (webhook events).

import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
  CsvExportModule,
  DateFilterModule,
  enableDevValidations,
  NumberFilterModule,
  QuickFilterModule,
  RowApiModule,
  RowStyleModule,
  TextFilterModule,
  themeQuartz,
  type ColDef,
  type ColTypeDefs,
  type GridApi,
  type RowClickedEvent,
  type ValueFormatterParams,
} from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';

if (process.env.NODE_ENV !== 'production') {
  enableDevValidations();
}

// Only the grid features these pages use: in-memory rows, filters for each column type, the
// search box (quick filter), sizing columns to their content, the row API + row classes
// (detail panel highlight), cell classes (status colours) and CSV export.
const modules = [
  CellStyleModule,
  ClientSideRowModelModule,
  CsvExportModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  QuickFilterModule,
  ColumnAutoSizeModule,
  RowApiModule,
  RowStyleModule,
];

// Same PayPal tokens as the dashboard (app/globals.css).
const theme = themeQuartz.withParams({
  fontFamily: 'var(--pp-font)',
  accentColor: 'var(--pp-blue)',
  foregroundColor: 'var(--pp-ink)',
  borderColor: 'var(--pp-border)',
  headerFontWeight: 600,
  headerTextColor: 'var(--pp-muted)',
  rowHoverColor: 'var(--pp-highlight)',
});

export type Row = Record<string, unknown>;

// Structured filter returned by POST /api/nl (stage 84 ★): the LLM's translation of a
// natural-language question, or the deterministic fallback's answer.
export interface LedgerFilter {
  kind?: string;
  recon?: string;
  status?: string;
  currency?: string;
  amountMin?: number;
  amountMax?: number;
  dateFrom?: string;
  dateTo?: string;
  quick?: string;
}

const textEq = (filter: string) => ({ filterType: 'text', type: 'equals', filter });

// Map the structured filter onto AG Grid's filter model (column ids = field names).
function buildFilterModel(f: LedgerFilter): Record<string, unknown> {
  const model: Record<string, unknown> = {};
  if (f.kind) model.kind = textEq(f.kind);
  if (f.recon) model.recon = textEq(f.recon);
  if (f.status) model.status = textEq(f.status);
  if (f.currency) model.currency = textEq(f.currency);
  if (f.amountMin != null || f.amountMax != null) {
    model.amount = {
      filterType: 'number',
      type:
        f.amountMin != null && f.amountMax != null
          ? 'inRange'
          : f.amountMin != null
            ? 'greaterThanOrEqual'
            : 'lessThanOrEqual',
      ...(f.amountMin != null ? { filter: f.amountMin } : {}),
      ...(f.amountMax != null ? { filterTo: f.amountMax } : {}),
    };
  }
  if (f.dateFrom || f.dateTo) {
    // The `at` column holds ISO strings, where lexicographic order IS chronological.
    model.at = {
      filterType: 'text',
      type:
        f.dateFrom && f.dateTo
          ? 'inRange'
          : f.dateFrom
            ? 'greaterThanOrEqual'
            : 'lessThanOrEqual',
      ...(f.dateFrom ? { filter: f.dateFrom } : {}),
      ...(f.dateTo ? { filterTo: f.dateTo } : {}),
    };
  }
  return model;
}

function describeFilter(f: LedgerFilter): string {
  const parts: string[] = [];
  if (f.kind) parts.push(`kind=${f.kind}`);
  if (f.recon) parts.push(`recon=${f.recon}`);
  if (f.status) parts.push(`status=${f.status}`);
  if (f.currency) parts.push(`currency=${f.currency}`);
  if (f.amountMin != null) parts.push(`amount ≥ ${f.amountMin}`);
  if (f.amountMax != null) parts.push(`amount ≤ ${f.amountMax}`);
  if (f.dateFrom) parts.push(`at ≥ ${f.dateFrom}`);
  if (f.dateTo) parts.push(`at ≤ ${f.dateTo}`);
  if (f.quick) parts.push(`text contains "${f.quick}"`);
  return parts.length ? parts.join(', ') : 'no conditions — showing everything';
}

// Money columns hold numbers and format them in the row's `currency`.
const formatMoney = ({ value, data }: ValueFormatterParams<Row>) =>
  typeof value === 'number' && typeof data?.currency === 'string'
    ? value.toLocaleString('en-US', { style: 'currency', currency: data.currency })
    : '';

// Reconciliation statuses colour their cell (stage 83). Pages opt in with `type: 'reconStatus'`;
// the colours live in globals.css so the grid and the detail panel share the palette.
const reconStatusClasses: Record<string, string> = {
  MATCHED: 'pp-st-matched',
  UNMATCHED: 'pp-st-unmatched',
  REVIEW: 'pp-st-review',
  PENDING: 'pp-st-pending',
};

const columnTypes: ColTypeDefs<Row> = {
  money: { valueFormatter: formatMoney, filter: 'agNumberColumnFilter' },
  reconStatus: {
    filter: 'agTextColumnFilter',
    cellClass: (p) =>
      typeof p.value === 'string' ? (reconStatusClasses[p.value] ?? '') : '',
  },
};

const defaultColDef: ColDef<Row> = { filter: true, sortable: true };
const autoSizeStrategy = { type: 'fitCellContents' } as const;

const displayValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function DataGrid({
  rows,
  columns,
  nlApi,
  explainApi,
  actionApi,
}: {
  rows: Row[];
  columns: ColDef<Row>[];
  /** Endpoint that turns { query } into { ok, filter, source, ms } — enables the "Ask the ledger" box. */
  nlApi?: string;
  /** Endpoint that turns { kind, ref } into { ok, explanation, source, ms } — enables the panel's AI block. */
  explainApi?: string;
  /** Endpoint that turns { action, kind, ref } into { ok, message } — enables the panel's action buttons. */
  actionApi?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const [nlQuery, setNlQuery] = useState('');
  const [nlBusy, setNlBusy] = useState(false);
  const [nlNote, setNlNote] = useState<{ text: string; isError: boolean } | null>(null);
  const [explain, setExplain] = useState<{
    status: 'loading' | 'done' | 'error';
    text?: string;
    source?: string;
    ms?: number;
    at?: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<{ text: string; isError: boolean } | null>(null);

  // Row actions (stage 86): guarded PayPal call / human resolution, then refresh the
  // server-rendered grid so the new status shows up immediately.
  const runAction = async (action: 'send_reminder' | 'mark_matched', kind: string, ref: string) => {
    if (!actionApi || actionBusy) return;
    setActionBusy(action);
    setActionNote(null);
    try {
      const res = await fetch(actionApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, kind, ref }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      setActionNote({
        text: data.ok ? (data.message ?? 'Done.') : (data.message ?? data.error ?? 'Refused.'),
        isError: !data.ok,
      });
      if (data.ok) router.refresh(); // pull fresh rows: the status column updates
    } catch (err) {
      setActionNote({
        text: err instanceof Error ? err.message : String(err),
        isError: true,
      });
    } finally {
      setActionBusy(null);
    }
  };

  // Keep the open panel in sync when refreshed rows arrive (e.g. after an action).
  useEffect(() => {
    if (!detail) return;
    const key = `${String(detail.kind)}:${String(detail.ref)}`;
    const found = rows.find((r) => `${String(r.kind)}:${String(r.ref)}` === key);
    if (found && found !== detail) setDetail(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const apiRef = useRef<GridApi<Row> | null>(null);
  // Guards against a stale answer: if the user clicks another row while one is
  // loading, the late response must not land on the new row's panel.
  const explainForRef = useRef<string | null>(null);

  // AI explanation of the selected row (stage 85): automatic for payments/invoices.
  const loadExplain = async (kind: string, ref: string) => {
    if (!explainApi) return;
    const key = `${kind}:${ref}`;
    explainForRef.current = key;
    setExplain({ status: 'loading' });
    try {
      const res = await fetch(explainApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ref }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        explanation?: string;
        source?: string;
        ms?: number;
      };
      if (explainForRef.current !== key) return; // the user moved on
      if (!data.ok || !data.explanation) throw new Error(data.error ?? 'no explanation');
      setExplain({
        status: 'done',
        text: data.explanation,
        source: data.source,
        ms: data.ms,
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      });
    } catch (err) {
      if (explainForRef.current !== key) return;
      setExplain({
        status: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    }
  };

  useEffect(() => {
    const kind = typeof detail?.kind === 'string' ? detail.kind : '';
    const ref = typeof detail?.ref === 'string' ? detail.ref : '';
    if (explainApi && (kind === 'PAYMENT' || kind === 'INVOICE') && ref) {
      void loadExplain(kind, ref);
    } else {
      setExplain(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, explainApi]);

  // Natural language -> grid filters (stage 84 ★).
  const askLedger = async (e: FormEvent) => {
    e.preventDefault();
    const query = nlQuery.trim();
    if (!query || !nlApi || nlBusy) return;
    setNlBusy(true);
    setNlNote(null);
    try {
      const res = await fetch(nlApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(40_000),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        filter?: LedgerFilter;
        source?: string;
        ms?: number;
      };
      if (!data.ok || !data.filter) throw new Error(data.error ?? 'no filter returned');
      const model = buildFilterModel(data.filter);
      apiRef.current?.setFilterModel(Object.keys(model).length ? (model as never) : null);
      setSearch(data.filter.quick ?? '');
      setNlNote({
        text: `${describeFilter(data.filter)} — via ${data.source ?? 'llm'} · ${((data.ms ?? 0) / 1000).toFixed(1)}s`,
        isError: false,
      });
    } catch (err) {
      setNlNote({
        text: `Could not parse the query: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      });
    } finally {
      setNlBusy(false);
    }
  };

  const clearAll = () => {
    apiRef.current?.setFilterModel(null);
    setSearch('');
    setNlNote(null);
  };

  // CSV export (stage 87, AG Grid community): exports what the user currently sees —
  // the active filters and sort order are respected.
  const exportCsv = () => {
    const page = (document.title.split(/[·|]/)[0] ?? 'grid').trim().toLowerCase() || 'grid';
    const fileName = `${page.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'grid'}.csv`;
    apiRef.current?.exportDataAsCsv({ fileName, exportedRows: 'filteredAndSorted' });
  };

  // Click a row to open its details; click the same row again to close the panel.
  const onRowClicked = (e: RowClickedEvent<Row>) => {
    setDetail((prev) => (prev && prev === e.data ? null : (e.data ?? null)));
  };

  // Row classes are evaluated at draw time, so re-draw when the selection changes
  // (after the state has committed — a bare requestAnimationFrame races the render).
  useEffect(() => {
    apiRef.current?.redrawRows();
  }, [detail]);

  // Escape closes the detail panel.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  const detailFields = detail
    ? Object.entries(detail).filter(([k, v]) => k !== 'id' && k !== 'payload' && v !== '')
    : [];
  const rawPayload = typeof detail?.payload === 'string' ? detail.payload : '';
  let payloadPretty = '';
  if (rawPayload) {
    try {
      payloadPretty = JSON.stringify(JSON.parse(rawPayload), null, 2);
    } catch {
      payloadPretty = rawPayload;
    }
  }

  // Empty state (stage 88): no data at all (fresh ledger) — a friendly card instead
  // of an empty grid.
  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-lg rounded border border-pp-border bg-pp-surface p-8 text-center">
          <h2 className="text-lg font-semibold text-pp-navy">No rows yet</h2>
          <p className="mt-2 text-sm text-pp-muted">
            The ledger fills up as PayPal webhooks arrive — send a sandbox payment or create an
            invoice and it will appear here within seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all columns…"
          aria-label="Search all columns"
          className="h-10 w-72 rounded border border-pp-border px-3 text-sm outline-none focus:border-pp-blue"
        />
        <span className="text-xs text-pp-muted">Click a row to see its details</span>
        <button
          type="button"
          onClick={exportCsv}
          aria-label="Export CSV"
          className="ml-auto h-9 rounded border border-pp-border px-3 text-sm font-semibold text-pp-navy hover:bg-pp-highlight"
        >
          Export CSV
        </button>
      </div>
      {nlApi && (
        <form onSubmit={askLedger} role="search" className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            placeholder='Ask the ledger… e.g. "show unmatched payments over $50"'
            aria-label="Ask the ledger in plain English"
            className="h-10 w-[28rem] max-w-full rounded border border-pp-border px-3 text-sm outline-none focus:border-pp-blue"
          />
          <button
            type="submit"
            disabled={nlBusy || !nlQuery.trim()}
            className="h-10 rounded bg-pp-blue px-4 text-sm font-semibold text-white hover:bg-pp-blue-dark disabled:opacity-50"
          >
            {nlBusy ? 'Thinking…' : 'Filter'}
          </button>
          {nlNote && (
            <span
              role="status"
              aria-live="polite"
              className={nlNote.isError ? 'text-xs text-pp-danger' : 'text-xs text-pp-muted'}
            >
              {nlNote.text}
            </span>
          )}
          {nlNote && !nlNote.isError && (
            <button type="button" onClick={clearAll} className="text-xs text-pp-blue hover:underline">
              Clear
            </button>
          )}
        </form>
      )}
      <div className="min-h-0 flex-1">
        <AgGridProvider modules={modules}>
          <AgGridReact
            theme={theme}
            rowData={rows}
            columnDefs={columns}
            columnTypes={columnTypes}
            defaultColDef={defaultColDef}
            quickFilterText={search}
            autoSizeStrategy={autoSizeStrategy}
            overlayNoRowsTemplate='<span class="text-sm text-pp-muted">No rows match the current filters — clear them to see the ledger.</span>'
            enableCellTextSelection
            getRowClass={(p: { data?: Row }) =>
              p.data && p.data === detail ? 'row-detail-selected' : ''
            }
            onGridReady={(e) => {
              apiRef.current = e.api;
              // Bench/debug hook (stage 89): lets the console and the perf test drive
              // the grid directly (setGridOption etc.). Harmless in production.
              (window as { __ledgerGrid?: GridApi<Row> }).__ledgerGrid = e.api;
            }}
            onRowClicked={onRowClicked}
          />
        </AgGridProvider>
      </div>
      {detail && (
        <section
          role="region"
          aria-label="Row details"
          className="max-h-[42%] overflow-auto rounded border border-pp-border bg-pp-surface p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-pp-navy">
              {displayValue(detail.kind ?? 'Row')}
              {detail.ref ? ` · ${String(detail.ref)}` : ''}
            </h2>
            <button
              type="button"
              onClick={() => setDetail(null)}
              aria-label="Close details"
              className="rounded px-2 py-0.5 text-lg leading-none text-pp-muted hover:bg-pp-highlight hover:text-pp-ink"
            >
              ×
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-[minmax(90px,_auto)_1fr] gap-x-5 gap-y-1 text-sm">
            {detailFields.map(([k, v]) => (
              <Fragment key={k}>
                <dt className="font-semibold text-pp-muted">{k}</dt>
                <dd className="whitespace-pre-wrap break-words text-pp-ink">
                  {displayValue(v)}
                </dd>
              </Fragment>
            ))}
          </dl>
          {explainApi && (detail.kind === 'PAYMENT' || detail.kind === 'INVOICE') && (
            <div className="mt-3 border-t border-pp-border pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-pp-muted">AI</h3>
                {explain?.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => loadExplain(String(detail.kind), String(detail.ref))}
                    aria-label="Regenerate AI explanation"
                    className="rounded px-1.5 text-sm text-pp-muted hover:bg-pp-highlight hover:text-pp-ink"
                    title="Ask the AI again"
                  >
                    ↻
                  </button>
                )}
              </div>
              {explain?.status === 'loading' && (
                <p className="mt-1 text-sm text-pp-muted" role="status">
                  Explaining…
                </p>
              )}
              {explain?.status === 'error' && (
                <p role="alert" className="mt-1 text-sm text-pp-danger">
                  Explanation failed: {explain.text}{' '}
                  <button
                    type="button"
                    onClick={() => loadExplain(String(detail.kind), String(detail.ref))}
                    className="text-pp-blue underline"
                  >
                    retry
                  </button>
                </p>
              )}
              {explain?.status === 'done' && (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-pp-ink">{explain.text}</p>
                  <p className="mt-1 text-xs text-pp-muted">
                    {explain.at} · via {explain.source} · {((explain.ms ?? 0) / 1000).toFixed(1)}s
                  </p>
                </>
              )}
            </div>
          )}
          {actionApi &&
            ((detail.kind === 'INVOICE' && detail.status === 'SENT') ||
              (detail.kind === 'PAYMENT' && detail.recon === 'REVIEW')) && (
              <div className="mt-3 border-t border-pp-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {detail.kind === 'INVOICE' && detail.status === 'SENT' && (
                    <button
                      type="button"
                      onClick={() => runAction('send_reminder', 'INVOICE', String(detail.ref))}
                      disabled={actionBusy !== null}
                      className="h-9 rounded bg-pp-blue px-3 text-sm font-semibold text-white hover:bg-pp-blue-dark disabled:opacity-50"
                    >
                      {actionBusy === 'send_reminder' ? 'Sending…' : 'Send reminder'}
                    </button>
                  )}
                  {detail.kind === 'PAYMENT' && detail.recon === 'REVIEW' && (
                    <button
                      type="button"
                      onClick={() => runAction('mark_matched', 'PAYMENT', String(detail.ref))}
                      disabled={actionBusy !== null}
                      className="h-9 rounded border border-pp-blue px-3 text-sm font-semibold text-pp-blue hover:bg-pp-highlight disabled:opacity-50"
                    >
                      {actionBusy === 'mark_matched' ? 'Marking…' : 'Mark matched'}
                    </button>
                  )}
                  {actionNote && (
                    <span
                      role="status"
                      aria-live="polite"
                      className={actionNote.isError ? 'text-xs text-pp-danger' : 'text-xs text-pp-success'}
                    >
                      {actionNote.text}
                    </span>
                  )}
                </div>
              </div>
            )}
          {payloadPretty && (
            <>
              <h3 className="mt-3 text-sm font-semibold text-pp-muted">Raw webhook payload</h3>
              <pre className="mt-1 max-h-56 overflow-auto rounded bg-pp-canvas p-3 text-xs text-pp-ink">
                {payloadPretty}
              </pre>
            </>
          )}
        </section>
      )}
    </div>
  );
}
