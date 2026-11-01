# Finding H-5 — the invoice status CHECK now covers PayPal's full vocabulary

Date: 2026-11-01 · Finding: `invoices.status` CHECK allowed7 values while PayPal
emits12 (`SCHEDULED`, `UNPAID`, `PAYMENT_PENDING`, `PARTIALLY_REFUNDED`,
`MARKED_AS_REFUNDED` missing) → `upsertLocalInvoice` (fed LIVE statuses during
reconcile) threw a CHECK error → the reconciliation-record write died.

## Fix (three layers, each pinned by tests)
1. **`schema.sql`**: CHECK widened to the full PayPal set **+ an explicit `UNKNOWN`
   bucket** (future statuses become a visible state instead of an exception).
2. **`normalizeInvoiceStatus()`** (boundary): `upsertLocalInvoice` now maps any
   out-of-set/future value to `UNKNOWN` — the write can never throw.
3. **Runtime migration `migrateInvoiceStatusCheck(db)`** (SQLite cannot ALTER a
   constraint): in-place rebuild with **ids preserved** (child FKs resolve by NAME —
   `payments`/`reconciliation_records` are never touched), status normalized during
   the copy, indexes re-applied by re-executing the schema, pragma FK restored via
   `finally`, idempotent. **Crash-safe state machine** for BOTH interruption windows:
   - invoices missing + scratch present → died between DROP and RENAME → **finish**;
   - invoices present + scratch present → died before DROP → **discard stale scratch**.
   (The live dev db was found in exactly state2 mid-audit — the machine healed it.)

## TDD (red-first → green)
Missing exports (`TS2305`) → then four harness snags fixed honestly: SQL string
literals must be SINGLE-quoted in SQLite (double quotes = identifiers), a test
fixture that never set `invoice_number` it then asserted, DROP with FKs ON needs the
guarded window, `noUncheckedIndexedAccess`. Suite: **60/60** (H-5a–e), lint0, build0.

## Live before/after (real dev db)
| Check | BEFORE (old CHECK) | AFTER (migrated) |
|---|---|---|
| `INSERT status='SCHEDULED'` | **CHECK constraint failed** ❌ | **OK** ✓ |
| the other four named statuses | would throw | **all insert OK** ✓ |
| invoice rows | 26 | **26 intact** (no data loss), scratch table gone |
| product paths | — | `POST /api/recon/run` ok · SCHEDULED webhook **200** · rows **195** |

**H-5 status: FIXED + VERIFIED (unit60/60 + live before/after on the real book).**
