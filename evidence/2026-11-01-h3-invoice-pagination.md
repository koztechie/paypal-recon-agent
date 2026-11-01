# Finding H-3 — reconciliation sees every invoice (full pagination)

Date: 2026-11-01 · Finding: `listAllInvoices` (reconcile.ts) and the reminder-agent
list call both hardcoded `{page:1, page_size:20, total_required:true}` — invoices
beyond page1 were invisible → payments against them became false `UNMATCHED`;
`runReminderAgent` silently skipped older SENT invoices (missed reminders).

## Premise verification
- Both call sites confirmed at `page:1, page_size:20` (grep count now **0/0**).
- **The hole was live**: the sandbox holds **75 invoices** — the old code saw20.
- The API DOES report `total_pages`/`total_items` with `total_required:true`
  (the data for a correct loop was there all along; web's `listAll` already used it).

## Fix (one pager, one decision, one place)
- **`listAllInvoices(tools, pageSize=100)` in `src/paypal.ts`**: loops on
  `total_pages`, **also stops on a short page** (defense if the API omits it), and a
  **hard cap of 50 pages** so a lying/malformed API can never hang the product.
- `reconcile.ts`: local helper renamed honestly (`listInvoicesLite` — fetch+map now
  delegates to the pager); `agent-actions.ts`: uses the same pager, its sort/priority
  logic untouched (now fed the FULL list), and the dead `parseToolResultLocal` +
  unused import were removed (subtract).

## TDD
Red: missing export (`TS2305`) → green:4 tests (total_pages loop, short-page stop,
empty first page, never-ending full pages hit the50-page cap and terminate) →
suite **50/50**, lint0, build0 (unpiped).

## Live proofs (real server, real API — server restarted first: stale processes
## have bitten twice already in this audit)
| Check | Result |
|---|---|
| Pager vs old view | old: **20** items → new: **75** items (every invoice) |
| `POST /api/recon/run` before/after | `reconciled:0`, distribution unchanged — **no regressions** |
| COMPLETED-but-UNMATCHED audit | exactly3: `QA-P5`/`QA-X4` = intentional fixtures (their explanations say "no invoice exists"; the video SHOWS them red) and `12670908EV615762J` has **no invoice with that amount at all** → all three GENUINE → **zero stale false-UNMATCHED** in the book |
| `npm run stage65` (runReminderAgent path) | **5/5** — chain chose REMIND, executed, ledger/audit/protected-invoices all correct |

## Scope note
The QA scripts' own `page_size:100` find (stage-144 fix) is documented separately:
sandbox invoices are ~75; the scripts fail loudly (duplicate-number crash) rather
than producing wrong data, and their cap is recorded in stage144's evidence.

**H-3 status: FIXED + VERIFIED (unit50/50 + live pager/recon/reminder proofs).**
