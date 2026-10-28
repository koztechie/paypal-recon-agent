'use client';

// The AG Grid used by every endpoint page. Pages are server components, so the columns they pass
// must be plain data, with no functions. Money columns name the column type below
// (`type: 'money'`), which keeps the formatter here on the client; date columns set the grid's
// built-in `cellDataType: 'dateString'` ('YYYY-MM-DD') or `'dateTimeString'` ('YYYY-MM-DDThh:mm:ssZ').
// Clicking a row opens the detail panel below the grid (stage 82): every field of the row,
// plus a pretty-printed raw payload when the row carries one (webhook events).

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ClientSideRowModelModule,
  ColumnAutoSizeModule,
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
// search box (quick filter), sizing columns to their content, and the row API + row classes
// (detail panel highlight).
const modules = [
  ClientSideRowModelModule,
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

// Money columns hold numbers and format them in the row's `currency`.
const formatMoney = ({ value, data }: ValueFormatterParams<Row>) =>
  typeof value === 'number' && typeof data?.currency === 'string'
    ? value.toLocaleString('en-US', { style: 'currency', currency: data.currency })
    : '';

const columnTypes: ColTypeDefs<Row> = {
  money: { valueFormatter: formatMoney, filter: 'agNumberColumnFilter' },
};

const defaultColDef: ColDef<Row> = { filter: true, sortable: true };
const autoSizeStrategy = { type: 'fitCellContents' } as const;

const displayValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function DataGrid({ rows, columns }: { rows: Row[]; columns: ColDef<Row>[] }) {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Row | null>(null);
  const apiRef = useRef<GridApi<Row> | null>(null);

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
      </div>
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
            enableCellTextSelection
            getRowClass={(p: { data?: Row }) =>
              p.data && p.data === detail ? 'row-detail-selected' : ''
            }
            onGridReady={(e) => (apiRef.current = e.api)}
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
