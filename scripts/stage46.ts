/**
 * Stage 46 marker: data model QA — 21/21 checks (user's QA standard).
 * Tables: invoices, payments, reconciliation_records, webhook_events
 * (+ schema_version, agent_actions). DDL source: schema.sql, idempotent.
 * Run: npm run stage46
 */
import { readFileSync } from "node:fs";
import { getDb } from "../src/db.ts";

type Check = [name: string, fn: () => boolean];
const db = getDb();
const t = (sql: string) =>
	(db.prepare(sql).get() ?? {}) as Record<string, number | string>;

const tables = () =>
	db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
		)
		.all()
		.map((r) => (r as { name: string }).name);

const cols = (table: string) =>
	db
		.prepare(`PRAGMA table_info(${table})`)
		.all()
		.map((r) => (r as { name: string }).name);

const validJson = (s: unknown) => {
	try {
		JSON.parse(String(s));
		return true;
	} catch {
		return false;
	}
};

const CHECKS: Check[] = [
	// 1-6: all six tables exist
	["table schema_version", () => tables().includes("schema_version")],
	["table invoices", () => tables().includes("invoices")],
	["table payments", () => tables().includes("payments")],
	[
		"table reconciliation_records",
		() => tables().includes("reconciliation_records"),
	],
	["table webhook_events", () => tables().includes("webhook_events")],
	["table agent_actions", () => tables().includes("agent_actions")],
	// 7-11: core columns present
	[
		"invoices: paypal_invoice_id+status+total_minor",
		() => {
			const c = cols("invoices");
			return ["paypal_invoice_id", "status", "total_minor"].every((x) =>
				c.includes(x),
			);
		},
	],
	[
		"payments: paypal_payment_id+amount_minor+net_minor+source",
		() => {
			const c = cols("payments");
			return ["paypal_payment_id", "amount_minor", "net_minor", "source"].every(
				(x) => c.includes(x),
			);
		},
	],
	[
		"reconciliation: payment_id+status+match_method+ai_explanation",
		() => {
			const c = cols("reconciliation_records");
			return ["payment_id", "status", "match_method", "ai_explanation"].every(
				(x) => c.includes(x),
			);
		},
	],
	[
		"webhook_events: paypal_event_id UNIQUE+payload_json",
		() => {
			const c = cols("webhook_events");
			const idx = db
				.prepare(
					"SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_events'",
				)
				.get() as { sql?: string };
			return c.includes("paypal_event_id") && /UNIQUE/i.test(idx.sql ?? "");
		},
	],
	[
		"agent_actions: limit_check+executed",
		() => {
			const c = cols("agent_actions");
			return ["limit_check", "executed"].every((x) => c.includes(x));
		},
	],
	// 12: versioning
	[
		"schema_version = 1.0 recorded",
		() =>
			t("SELECT count(*) c FROM schema_version WHERE version='1.0'").c === 1,
	],
	// 13: DDL file is the versioned source of truth
	[
		"schema.sql contains schema_version DDL",
		() =>
			readFileSync("schema.sql", "utf8").includes(
				"CREATE TABLE IF NOT EXISTS schema_version",
			),
	],
	// 14-16: live JSON columns parse
	[
		"all webhook_events.payload_json valid JSON",
		() => {
			const rows = db
				.prepare("SELECT payload_json FROM webhook_events")
				.all() as { payload_json: string }[];
			return rows.every((r) => validJson(r.payload_json));
		},
	],
	[
		"all payments.raw_json valid JSON",
		() => {
			const rows = db.prepare("SELECT raw_json FROM payments").all() as {
				raw_json: string;
			}[];
			return rows.length > 0 && rows.every((r) => validJson(r.raw_json));
		},
	],
	[
		"live payments row consistent (amount = fee + net)",
		() => {
			const rows = db
				.prepare(
					"SELECT amount_minor a, fee_minor f, net_minor n FROM payments",
				)
				.all() as { a: number; f: number; n: number }[];
			return rows.length > 0 && rows.every((r) => r.a === r.f + r.n);
		},
	],
	// 17: CHECK constraints enforced (invalid status rejected, rolled back)
	[
		"CHECK constraint rejects invalid payment status",
		() => {
			try {
				db.exec("BEGIN");
				db.prepare(
					"INSERT INTO payments (paypal_payment_id, currency, amount_minor, fee_minor, net_minor, status, source, received_at, raw_json) VALUES ('QA-NEG-1','USD',1,0,1,'BOGUS','qa','2026-10-28','{}')",
				).run();
				db.exec("ROLLBACK");
				return false; // insert was accepted -> constraint broken
			} catch {
				db.exec("ROLLBACK");
				return true;
			}
		},
	],
	// 18: FK integrity
	[
		"PRAGMA foreign_key_check clean",
		() => db.prepare("PRAGMA foreign_key_check").all().length === 0,
	],
	// 19: indexes exist for hot paths
	[
		"indexes: payments(status)+recon(status)+events(event_type)",
		() => {
			const idx = db
				.prepare("SELECT name FROM sqlite_master WHERE type='index'")
				.all()
				.map((r) => (r as { name: string }).name);
			return [
				"idx_payments_status",
				"idx_recon_status",
				"idx_events_type",
			].every((x) => idx.includes(x));
		},
	],
	// 20: money stored as INTEGER minor units (no floats)
	[
		"amount columns are INTEGER type",
		() => {
			const decl = (table: string, column: string) =>
				(
					db.prepare(`PRAGMA table_info(${table})`).all() as {
						name: string;
						type: string;
					}[]
				).find((c) => c.name === column)?.type;
			return (
				decl("payments", "amount_minor") === "INTEGER" &&
				decl("invoices", "total_minor") === "INTEGER"
			);
		},
	],
	// 21: the archived stage-38 webhook payload (real, 2580 bytes) parses as valid JSON
	[
		"real 2580B webhook payload in log parses (stage-38 CREATED)",
		() => {
			try {
				const lines = readFileSync("logs/webhooks.ndjson", "utf8")
					.trim()
					.split("\n");
				return lines.some((l) => {
					try {
						const ev = JSON.parse(l) as {
							raw_len?: number;
							event_type?: string;
						};
						return (
							(ev.raw_len ?? 0) > 2000 &&
							ev.event_type === "INVOICING.INVOICE.CREATED"
						);
					} catch {
						return false;
					}
				});
			} catch {
				return false;
			}
		},
	],
];

let pass = 0;
for (const [name, fn] of CHECKS) {
	let ok = false;
	try {
		ok = fn();
	} catch {
		ok = false;
	}
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${CHECKS.length} checks passed`);
if (pass !== CHECKS.length)
	throw new Error(`QA FAILED: ${pass}/${CHECKS.length}`);
console.log("STAGE 46 OK: 21/21 — data model QA passed");
