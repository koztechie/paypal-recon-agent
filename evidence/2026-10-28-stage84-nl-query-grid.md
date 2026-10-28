# Evidence — stage 84 ★ (natural-language query -> grid filters)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: demo — 3 different queries -> correct filters — PASS (all via LLM, 0.7–0.9 s)

Architecture (anti-fragile, mirrors the agent's actions+fallback pattern):
- src/nl.ts (new): parseLedgerQuery(query) -> { filter, source, ms }.
  Primary: LLM (src/llm.ts chat(), Gemini, temperature 0, strict-JSON prompt),
  bounded by a 14 s deadline. Fallback: deterministic rule parser (unmatched/matched/
  review, payments/invoices/events, over/under $X, currency words, statuses).
  Never throws; always returns a filter object.
- src/server.ts: POST /api/nl-filter { query } -> { ok, filter, source, ms } (CORS *).
- web/app/api/nl/route.ts (new): Next proxy (one origin for the browser).
- web DataGrid: optional `nlApi` prop -> "Ask the ledger…" box; the structured filter
  maps onto AG Grid's filter model (text equals / number range / ISO-date range via
  text comparison) + quick filter for free-text refs. Status line shows the applied
  conditions + source + latency; "Clear" resets everything.
- Ledger amounts/variances converted to numbers + `type: 'money'` (stage-81 finding:
  number filters silently failed on string values — a $10 row survived "over $50").

## Functional demo (browser, /reconciliation, DOM assertions after each query)

| # | Query | Note shown in UI | Rows | Verification | Verdict |
|---|---|---|---|---|---|
| 1 | show unmatched payments over $50 | kind=PAYMENT, recon=UNMATCHED, currency=USD, amount ≥ 50 — via llm · 0.9s | 2 | kinds=[PAYMENT], recon=[UNMATCHED], amounts $55.00/$77.00 ($10 row excluded) | PASS |
| 2 | review payments in EUR | kind=PAYMENT, recon=REVIEW, currency=EUR — via llm · 0.7s | 2 | kinds=[PAYMENT], recon=[REVIEW], currency=[EUR], €60.00/€30.00 | PASS |
| 3 | invoices with status SENT | kind=INVOICE, status=SENT — via llm · 0.9s | 16 | kinds=[INVOICE], status=[SENT] | PASS |

- "Clear" restores the full ledger (26 rendered rows) after each query.
- API-level checks (curl through :3000 and the :3001 proxy): same three filters,
  source=llm, ms 827–1006.

## Incidents (honest log)
1. The :3000 dev server had been restarted WITHOUT the LLM env vars (npm `dev` script
   lacked --env-file), so every NL call silently fell back to rules. Fixed durably:
   package.json dev/start now use `node --env-file-if-exists=.env.local`
   (Render-safe: real env vars there, file optional locally).
2. Number filters silently no-op on string values (amount ≥ 50 let a $10 row through)
   — fixed at the page level (numbers + money formatting); regression covered by
   query 1 above.
3. Screenshot artifact again blocked ("needs a visible tab"); harness auto-captures of
   the rendered page (NL box + filtered grid) appear in the session; DOM assertions
   above are the marker evidence.
