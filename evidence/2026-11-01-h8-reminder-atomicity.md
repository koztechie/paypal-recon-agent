# Finding H-8 — reminder limit: atomic DB reserve, one choke point, file demoted to a projection

Date: 2026-11-01 · Findings: (1) `checkReminderAllowed → PayPal → writeFileSync` is a
TOCTOU race — two parallel requests both passed and sent2 reminders/24h; (2) the JSON
file has no transactions and cannot work beyond one instance / survives no deploy.

## Design
- **`src/reminder-ledger.ts`** — the ledger moves into SQLite (`reminder_ledger`,
  `UNIQUE(invoice_id, sent_date)`):
  - `reserveReminderSlot()` = **synchronous critical section** (no `await` inside →
    the event loop serializes it) + the UNIQUE backstop for cross-process twins;
    reserved **before** the external call, **released when the call fails**
    (the old post-success-write semantics preserved);
  - `checkReminderAllowed()` stays a read-only pre-check — reason strings are
    **byte-identical** to the stage-64 contract (`BLOCKED: 24h limit reached (1/day)`,
    `BLOCKED: lifetime limit reached (3)`);
- **One choke point**: `withReminderLedger()` wraps the toolkit's
  `send_invoice_reminder` (outermost, outside dry-run so stage-50's DRY stamps keep
  flowing) → covers the invoicing wrapper, **raw script calls (stage52)**, the
  row-action UI, the reminder agent AND the agent loop (which previously CHECKED but
  never WROTE — a silent bypass).
- The wrapper slimmed: audit PASS row is logged only **after** a successful send
  (no orphan rows if the envelope denies — H-7 invariant kept).
- `logs/reminders.json` → **legacy projection** regenerated from the DB (stage64/50/52
  read it directly); guards added: never overwrite a populated legacy file from an
  empty table; first-use sync (`imported` OR `already` → refresh).

## TDD (red-first)
`tests/reminder-ledger.test.ts`: **H-8a THE race test** — `Promise.all` two sends →
PayPal mock called **EXACTLY once** (red before: twice); daily reason string;
lifetime across three days; failed attempt releases its slot; sync double-reserve
denied; JSON→DB migration idempotent. Suite: **71/71**, lint0, build0.

## Honest incident: legacy data loss + restore (caught by the compat suite)
The FIRST migrate version had no per-row catch: the legacy file legitimately held
**two same-day stamps for INV2-CXQ5** (pre-history), the day-unique index rejected
the second, and the aborted import + mirror regeneration dropped CXQ5 from the file
(`logs/` is gitignored — no history). **Caught by stage52's `reminder was executed
(ledger)` check.** Repaired from this session's own premise-check transcript (the
original values were printed verbatim there): `2026-10-28T09:55:00.000Z` re-inserted;
mirror resynced. Hardened: per-row import catch (already), migration flag set only
after a COMPLETE attempt (failed imports retry), mirror-destructive-path guard,
first-use mirror sync. **Normalization rule (documented):** same-day multiples
collapse to the earliest stamp on import — the table is strictly ≤1/day, stricter
than the file ever was; CXQ5 is PAID, so lifetime-count drift is operationally void.
Prod topology: the server is the SINGLE writer (scripts run local-only) → the
cross-process race is a local-dev theoretical; the sync section covers the process.

## Live proofs
| Suite | Result |
|---|---|
| stage64 (rate-limit suite, reads the JSON projection) | **8/8** — `ledger after 1st reminder: 1`, second attempt `BLOCKED: 24h limit reached (1/day)` WITHOUT a PayPal call (PayPal now also rejects DRAFT-reminders itself — added a send-first step to the script; behavior change external, documented) |
| stage52 (raw-tool path) | **5/5** (its ledger check re-passed after the restore) |
| stage65 (wrapper + agent path) | **5/5** |

**H-8 status: FIXED + VERIFIED (suite71/71 + three live suites).**
