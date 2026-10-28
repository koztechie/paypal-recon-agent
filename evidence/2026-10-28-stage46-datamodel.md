# Evidence — stage 46 (data model: tables + 21/21 QA)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: tables created; 21/21 JSON valid — PASS
- npm run stage46 -> "21/21 checks passed"
- DDL source: schema.sql (versioned via schema_version=1.0, applied idempotently by
  src/db.ts getDb(); node:sqlite, zero deps)

## The 21 checks (scripts/stage46.ts)
1-6    all 6 tables exist (schema_version, invoices, payments, reconciliation_records,
       webhook_events, agent_actions)
7-11   core columns present per table (incl. UNIQUE on webhook_events.paypal_event_id,
       limit_check+executed on agent_actions)
12-13  schema_version = 1.0 recorded; schema.sql is the versioned DDL source
14-16  live JSON columns parse (payload_json, raw_json) + payments invariant
       amount = fee + net
17     CHECK constraint rejects invalid status (negative insert rolled back)
18     PRAGMA foreign_key_check clean
19     hot-path indexes exist (payments.status, recon.status, events.event_type)
20     money columns are INTEGER minor units (no floats)
21     real 2580-byte webhook payload (stage-38 INVOICING.INVOICE.CREATED) parses

## Notes
- Interpretation of "21/21 JSON валідний": 21 schema/data validations including live JSON
  parsing of real webhook payloads (user's GOST-style QA standard adapted).
