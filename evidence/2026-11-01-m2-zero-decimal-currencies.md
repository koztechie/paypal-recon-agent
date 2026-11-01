# Finding M-2 — zero-decimal currencies (JPY/KRW/VND) + currency-converted limit

Date: 2026-11-01 · Finding: `*100` is wrong for zero-decimal ISO 4217 currencies
(systemic for a cross-border product); the $500 limit compared raw minor units
without conversion → false blocks (€600, ¥50000).

## Premise verification — half of it was ALREADY fixed in H-9
| Claim | Status |
|---|---|
| limit compared without currency conversion → false €600/¥50000 blocks | **FIXED in H-9** (ECB conversion live): €600 ≈ $668 → blocked **correctly**; ¥50000 ≈ $349.13 → **passes correctly** (the old RAW compare blocked both) |
| `*100` wrong for zero-decimal | **TRUE for formatting/outbound**: internal storage is a uniform pseudo-cent (see ADR-022) but human/API strings showed "500.00" for ¥500 and `contract.ts` would send `"500.00"` to PayPal for JPY (PayPal rejects decimal JPY) |

## Model adopted (ADR-022): uniform pseudo-cent storage + per-currency boundaries
- **Storage**: everything ×100 at entry (one scale for matching, variance, FX).
  H-9's FX math is scale-invariant (×100 commutes with the linear cross-rate), so
  USD-equivalents are TRUE for both decimal and zero-decimal inputs — pinned by test.
- **Formatting boundary** (`src/money-format.ts`): `ZERO_DECIMAL_CURRENCIES` (ISO set
  incl. JPY/KRW/VND/CLP/UGX/PYG/…) + `formatMinorUnits(minor, ccy)` → `"500"` / `"43.50"`.
- **Outbound**: `contract.ts` invoice `amount` (the one place that serializes
  minor→decimal for the PayPal API) now formats by currency — ¥500 travels as `"500"`.
- **Applied to every human-readable amount**: ledger rows API, `explain.ts` money()
  (the AI insight text), `fallback.ts` reasons/explanations (9 sites), contract summary.
- **Web grid: no change needed** — its Intl `style: currency` formatter already knows
  each currency's digit count (pinned by test: Intl renders ¥500 without cents).

## TDD (red-first: module/export missing)
`tests/money-format.test.ts`: zero-decimal set sanity · formatter pairs
(JPY/KRW/VND whole units, USD/EUR cents, edge zeros) · Intl web pin · **systemic
end-to-end proof**: `¥50000 → storage → H-9 FX → true USD cents ($349 band) → inside
the $500 limit` (and ¥60000 ≈ $419 passes — both were blocked by the old raw compare).
Suite: **86/86**, lint0, build0, web tsc0.

## Live proof (real server)
| Probe | Result |
|---|---|
| synthetic webhook `JPY "500"` | row shows **`amount: "500"`** (was "500.00") ✓ |
| USD rows | still `"30.00"` / `"35.00"` ✓ |
| `npm run demo` (USD E2E) | **PROVEN** (34.6s) |

**M-2 status: FIXED + VERIFIED (limit half already closed by H-9; formatting/outbound
closed here; suite86/86 + live JPY).**
