# Finding H-2 — payment capture events stored with their TRUE status

Date: 2026-11-01 · Finding: `insertPaymentFromEvent` hardcoded `'COMPLETED'` for
anything `startsWith("PAYMENT.")` → `PENDING/DENIED/REFUNDED/REVERSED` captures
became COMPLETED rows → they entered reconciliation (`WHERE p.status='COMPLETED'`)
 → false MATCHED → false "matched" in the tax report (stage 66).

## Design (illegal states impossible at the source)
- **`paymentStatusFromEvent()`** (exported, pure): honest map for the five observed
  capture events; **unknown/foreign events → `null` = store NOTHING** (fail-closed —
  no fake COMPLETED by default).
- **Schema vocabulary enforced**: the table CHECK allows only
  `('PENDING','COMPLETED','FAILED','REFUNDED')` — my first map invented
  `DENIED/REVERSED` and **the DB itself rejected them** (the test caught it before
  shipping): now DENIED/REVERSED → `FAILED` (did not stick ⇒ never reconcilable).
- **Lifecycle upsert**: `ON CONFLICT DO UPDATE` with rank precedence
  `PENDING(0) < FAILED(1) < COMPLETED(2) < REFUNDED(3)` (the old `DO NOTHING` froze
  the first-seen status forever — PENDING would have stayed PENDING even after settle).
- Reconcile needed no change: its `p.status='COMPLETED'` filter is now fed only
  genuinely settled rows.

## TDD
Red: missing export failed `tsc` (TS2339) +6 tests failing for that reason; green
after wiring: mapper (5 true +5 fail-closed cases) + temp-DB integration (PENDING
lands PENDING, DENIED→FAILED/REFUNDED, upgrade PENDING→COMPLETED→REFUNDED, unknown
stores nothing) → suite **46/46**, lint0, build0 (unpiped rcs).

## Live before/after (local server, real webhook POSTs)
| Probe | BEFORE (stale process = the bug in the wild) | AFTER (new process) |
|---|---|---|
| `PAYMENT.CAPTURE.PENDING` | row `COMPLETED` ❌ | **`PENDING`** ✓ |
| `PAYMENT.CAPTURE.DENIED` | row `COMPLETED` ❌ | **`FAILED`** ✓ |
| `PAYMENT.CAPTURE.NONSENSE` | row `COMPLETED` ❌ | **no row** ✓ (fail-closed) |
| `POST /api/recon/run` after | risk of false MATCHED | **no false MATCHED** ✓ |

(The "before" column came for free: the long-running dev server still had old code —
live demonstration of the hole itself. Probe rows removed after the run.)

## Pollution audit
Local book: **0** rows whose raw event was non-COMPLETED but status COMPLETED
(34 COMPLETED rows, all legitimately settled); prod DB is fresh (today's re-seeds
used the invoice-PAID path, whose status is schema-checked). **No backfill needed.**

**H-2 status: FIXED + VERIFIED (unit46/46 + live before/after).**
