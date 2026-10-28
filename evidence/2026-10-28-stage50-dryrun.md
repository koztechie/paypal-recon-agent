# Evidence — stage 50 (dry-run: zero real effects)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: dry-run script without effects — PASS (4/4)
Scenario (npm run stage50, DRY_RUN=true):
  create $120 invoice #9201 -> send -> reminder -> record payment $120
Results:
  ✓ create returned simulated id DRY-* with dry_run: true
  ✓ 4 money actions logged to logs/dryrun.ndjson ([dry-run] BLOCKED lines)
  ✓ sandbox invoice count UNBEFORE==AFTER (no real creation)
  ✓ reminder rate-limit ledger untouched (no DRY- entries)

## Mechanism (src/dryrun.ts)
- withDryRun(tools): Proxy-style wrapper; MONEY_ACTIONS set (create/send/reminder/
  record_payment/refund/cancel/delete/create_order/pay_order/setupReminders) stubbed;
  read-only tools (list/get/search) pass through.
- Every blocked action appended to logs/dryrun.ndjson with ts/mode/action/args.
- DRY_RUN=true env toggle (dev default recommendation documented in evidence).

## Pattern note
- Mirrors the user's KeyCRM "test_dry_run" pattern (dossier: mock data + dry run).
