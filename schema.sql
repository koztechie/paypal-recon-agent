-- ============================================================================
-- schema.sql — Cross-Border Reconciliation Agent (PayPal AI Hackathon)
-- Dialect: SQLite 3
-- Schema version: 1.0 (2026-10-27)
-- ADR ref: ADR-004 (stack), ADR-005 (core = C)
-- Convention: all monetary amounts are stored in MINOR units (cents) as
--             INTEGER, never FLOAT. Currency is stored separately (ISO 4217).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 0. Schema versioning (changelog: append-only, v1.0 -> v1.1 -> ...)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    version     TEXT PRIMARY KEY,          -- e.g. '1.0'
    applied_at  TEXT NOT NULL DEFAULT (datetime('now')),
    note        TEXT
);

INSERT OR IGNORE INTO schema_version (version, note)
VALUES ('1.0', 'Initial schema: invoices, payments, reconciliation, webhook_events');

-- ----------------------------------------------------------------------------
-- 1. Invoices (PayPal Invoicing via Agent Toolkit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    paypal_invoice_id   TEXT NOT NULL UNIQUE,   -- PayPal invoice id
    invoice_number      TEXT UNIQUE,            -- merchant invoice number
    buyer_email         TEXT,
    buyer_name          TEXT,
    currency            TEXT NOT NULL,          -- ISO 4217, e.g. 'USD'
    subtotal_minor      INTEGER NOT NULL CHECK (subtotal_minor >= 0),
    fee_minor           INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
    total_minor         INTEGER NOT NULL CHECK (total_minor >= 0),
    status              TEXT NOT NULL           -- DRAFT|SENT|PARTIALLY_PAID|PAID|
                            CHECK (status IN
                            ('DRAFT','SENT','PARTIALLY_PAID','PAID',
                             'CANCELLED','REFUNDED','MARKED_AS_PAID')),
    issued_at           TEXT,
    due_at              TEXT,
    paid_at             TEXT,
    memo                TEXT,                   -- invoice note / line description
    source              TEXT NOT NULL DEFAULT 'agent',  -- agent|human|recurring
    raw_json            TEXT NOT NULL,          -- last PayPal payload (audit)
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_buyer      ON invoices(buyer_email);
CREATE INDEX IF NOT EXISTS idx_invoices_due        ON invoices(due_at);

-- ----------------------------------------------------------------------------
-- 2. Payments (captures / external records fed into reconciliation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    paypal_payment_id   TEXT UNIQUE,            -- capture/transaction id
    invoice_id          INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    payer_email         TEXT,
    currency            TEXT NOT NULL,
    amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 0),
    fee_minor           INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
    net_minor           INTEGER NOT NULL,       -- amount_minor - fee_minor
    status              TEXT NOT NULL           -- PENDING|COMPLETED|FAILED|REFUNDED
                            CHECK (status IN
                            ('PENDING','COMPLETED','FAILED','REFUNDED')),
    source              TEXT NOT NULL DEFAULT 'webhook', -- webhook|manual_import
    received_at         TEXT NOT NULL,          -- PayPal create_time
    stored_at           TEXT NOT NULL DEFAULT (datetime('now')),
    raw_json            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_received ON payments(received_at);
CREATE INDEX IF NOT EXISTS idx_payments_payer    ON payments(payer_email);

-- ----------------------------------------------------------------------------
-- 3. Reconciliation records (the product's core output)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_records (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id          INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id          INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    status              TEXT NOT NULL           -- MATCHED|UNMATCHED|REVIEW
                            CHECK (status IN ('MATCHED','UNMATCHED','REVIEW')),
    match_method        TEXT                    -- exact|number+amount|amount+buyer|manual
                            CHECK (match_method IS NULL OR match_method IN
                            ('exact','number_amount','amount_buyer','manual')),
    variance_minor      INTEGER NOT NULL DEFAULT 0,  -- payment - invoice total
    currency            TEXT NOT NULL,
    reason              TEXT,                   -- why UNMATCHED/REVIEW
    ai_explanation      TEXT,                   -- LLM rationale (auditable)
    decided_by          TEXT NOT NULL DEFAULT 'agent'  -- agent|human
                            CHECK (decided_by IN ('agent','human')),
    resolution          TEXT,                   -- for REVIEW: resolved how
    detected_at         TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at         TEXT,
    CHECK (invoice_id IS NOT NULL OR status = 'UNMATCHED')
);

CREATE INDEX IF NOT EXISTS idx_recon_status  ON reconciliation_records(status);
CREATE INDEX IF NOT EXISTS idx_recon_payment ON reconciliation_records(payment_id);

-- ----------------------------------------------------------------------------
-- 4. Webhook events (raw, append-only, never mutated)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    paypal_event_id     TEXT NOT NULL UNIQUE,   -- dedupe guard
    event_type          TEXT NOT NULL,          -- e.g. INVOICE.PAID
    payload_json        TEXT NOT NULL,          -- raw body as received
    received_at         TEXT NOT NULL DEFAULT (datetime('now')),
    process_status      TEXT NOT NULL DEFAULT 'received'
                            CHECK (process_status IN
                            ('received','processed','error','skipped')),
    processed_at        TEXT,
    error               TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_type   ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_status ON webhook_events(process_status);

-- ----------------------------------------------------------------------------
-- 5. Agent action log (guardrails: ADR-006, stage 68)
--    Every LLM-driven decision is logged with limits and outcome.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_actions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    action              TEXT NOT NULL,          -- send_reminder|record_payment|...
    llm_decision        TEXT NOT NULL,          -- raw model output / tool call
    limit_check         TEXT NOT NULL,          -- PASS|BLOCKED (amount/frequency)
    target_ref          TEXT,                   -- invoice/payment id if any
    executed            INTEGER NOT NULL DEFAULT 0 CHECK (executed IN (0,1)),
    executed_at         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_actions_name ON agent_actions(action);

-- ----------------------------------------------------------------------------
-- Bootstrap check (stage 46 marker: 21/21 valid objects)
--   6 objects: schema_version, invoices, payments,
--              reconciliation_records, webhook_events, agent_actions
-- ----------------------------------------------------------------------------
-- SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';
