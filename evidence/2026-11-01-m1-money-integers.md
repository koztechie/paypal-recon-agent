# Finding M-1 — money is validated integer minor units (everywhere)

Date: 2026-11-01 · Finding: `dollarsToMinor = Math.round(parseFloat(...))` had no
validation (`NaN → NOT NULL/CHECK violations`); web `amountOf = Number()` leaked NaN.
Contradicted the docs' exact-cents ledger claims.

## Premise verification → the defect class was WIDER than the two named sites
| Site | Problem found |
|---|---|
| `src/db.ts` `dollarsToMinor` (6 call sites) | `"abc" → NaN` → live-observed `NOT NULL constraint failed: payments.amount_minor` (event silently lost) |
| `src/invoicing.ts` create + record (**policy inputs!**) | `NaN > limit` is **false** → garbage amount PASSED the $500 policy |
| `src/reconcile.ts` invoice total | NaN total → `NaN !== NaN` → exact-match impossible → **false UNMATCHED / NaN variance writes** |
| `web/lib/paypal.ts` `amountOf` | `Number("abc") → NaN` in grid displays/filters |
| `src/agent.ts` moneyMinorOf | already fail-closed (H-1) ✓ · `src/negotiation.ts` price parse | already `Number.isFinite` validated ✓ · `server.ts` bench generator | internal deterministic fixture ✓ |

## Fix — ONE validated parser + honest boundaries
- **`dollarsToMinor` (exported, db.ts)**: trim → strict decimal grammar `/^\d+(\.\d+)?$/`
  (rejects `1e3`, `0x10`, negatives, `NaN`, `Infinity`) → `Math.round(x*100)` →
  **`Number.isSafeInteger` guard** (true integer cents, no float leakage) →
  **throws `invalid money value`** otherwise; missing stays `0` (documented optional
  fee/net semantics). Invalid money never reaches a policy decision or a NOT NULL column.
- invoicing create/record now parse through it (garbage throws BEFORE `enforceActionPolicy`
  — pinned: no PayPal call, **no audit PASS row** for rejected inputs).
- reconcile: unparseable invoice total → the invoice is **excluded from candidates**
  (NaN matching eliminated) via `map-to-null + filter`.
- web display path extracted to pure **`web/lib/money.ts`** (`amountOf`: malformed→0,
  true negatives kept for refund rows; `paypal.ts` re-exports — consumers unchanged).
  The extraction also unblocked the test runner: `web/lib/paypal.ts` uses class
  parameter properties, which Node's strip-only TS cannot load.

## TDD (red-first: export missing → TS2459)
`tests/money-integer.test.ts`: valid cents (incl. the `0.1 → 10` float artifact) ·
missing→0 · **8 malformed/unsafe inputs throw** (`abc, NaN, Infinity, -5, 1e999, 0x10,
1e3, out-of-safe-range`) · web amountOf (malformed→0, negative kept) · policy purity
(create+record garbage → throw, **0 tool calls,0 audit rows**). Suite: **82/82**,
lint0, build0 (root) + web tsc/build0.

## Live before/after (real server)
| Probe | BEFORE (old code, observed live) | AFTER (new code) |
|---|---|---|
| webhook `amount:"abc"` | `NOT NULL constraint failed` (raw SQLite error),0 rows | **`TypeError: invalid money value: "abc"`** at `dollarsToMinor`, **0 rows** |
| webhook `amount:"12.34"` | — | `amount_minor = 1234` exact ✓ |
| `npm run demo` (dry E2E) | — | **PROVEN** (35.3s) |
| `POST /api/recon/run` | — | `ok:true` |

**M-1 status: FIXED + VERIFIED (suite82/82 + live before/after).**
