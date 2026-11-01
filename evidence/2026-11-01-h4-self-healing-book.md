# Finding H-4 — ephemeral disk: the book now self-heals

Date: 2026-11-01 · Finding: `data/recon.db` on Render free's ephemeral disk dies on
every deploy/restart — systemic data loss for a reconciliation product (this audit
alone forced **seven manual re-seeds** after the C/H-series deploys).

## Premise verification
- `render.yaml`: `plan: free`, no disk → ephemeral confirmed; `db.ts` honors
  `DB_PATH` env (the paid-disk path needed NO code change).
- The operational pain was already documented (stage118/125) with a MANUAL remedy
  (E2E re-seed cycle per deploy) — the fix turns it into an automatic one.

## Fix (self-healing, commit-the-book)
- **`src/book.ts`**: `exportBook(db)` → sanitized snapshot of the five book tables
  (explicit column lists = single source of truth for export+restore; emails masked
  via the SAME `maskEmails` the public API uses (C-3); original ids kept so FKs
  `reconciliation_records → payments` survive) and `restoreBookIfEmpty(db, snap)`:
  runs **only on an empty book**, `INSERT OR IGNORE` → idempotent, never clobbers
  live data, empty snapshot refused.
- **`npm run book:export`** → `seed/book-snapshot.json` (committed; `data/` stays
  gitignored): **640 KB,136 masked…@ forms,0 raw emails** (scripted scan).
- **Boot wiring** (`src/server.ts`): before listening, restore-or-log — a corrupt or
  missing snapshot logs LOUDLY and the server still starts (availability first).
- **`render.yaml`**: documents the free-plan limitation + the optional TRUE-persistence
  upgrade (user action, billing): Add Disk `/var/data` + `DB_PATH=/var/data/recon.db`
  on a paid instance — code already ready (ADR-020).

## TDD
Red: missing module (`TS2307`) → green:5 tests (counts+masking+ids, FK join after
restore, double-restore idempotent, non-empty never clobbered, empty snapshot
refused) → suite **55/55**, lint0, build0 (unpiped). (Two harness snags fixed
honestly: null-prototype rows vs deepEqual; noUncheckedIndexedAccess.)

## Live proofs
| Check | Result |
|---|---|
| Fresh empty DB (`DB_PATH=/tmp/h4-live.db PORT=3999`) → boot | log `[server] book snapshot restore: restored`; `rows?count=1` = **194** immediately; **31 MATCHED payments** — zero manual action |
| Snapshot hygiene | **0** raw emails (masked `…@domain` ×136), FK-restorable ids |
| Prod after the deploy from this commit | see the follow-up verification below |

**H-4 status: FIXED + VERIFIED LOCALLY; prod proof follows the deploy.**
