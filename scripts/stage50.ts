/**
 * Stage 50 marker: dry-run — full pipeline with ZERO real effects.
 * Scenario: create $120 invoice #9201 -> send -> reminder -> record payment.
 * With DRY_RUN=true every money action must be stubbed; sandbox state unchanged.
 * Run: npm run dryrun
 */
import { existsSync, readFileSync } from "node:fs";
import { withDryRun } from "../src/dryrun.ts";
import { sendInvoice } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

process.env.DRY_RUN = "true";

// Baseline: sandbox invoice count before the dry-run.
const realTools = createPaypalToolkit().getTools();
const before = JSON.parse(
	await (
		realTools.list_invoices as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute(
		{ page: 1, page_size: 20, total_required: true },
		{ toolCallId: "before", messages: [] },
	),
) as { total_items?: number };

const tools = withDryRun(createPaypalToolkit().getTools());

// 1) create invoice (stubbed)
const created = JSON.parse(
	await (
		tools.create_invoice as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute(
		{
			currency_code: "USD",
			invoice_number: "9201",
			note: "dry-run scenario",
			primary_recipients: [
				{ billing_info: { email_address: process.env.SANDBOX_BUYER_EMAIL } },
			],
			items: [
				{
					name: "Dry-run retainer",
					quantity: "1",
					unit_amount: { currency_code: "USD", value: "120.00" },
				},
			],
		},
		{ toolCallId: "dry-create", messages: [] },
	),
) as { id?: string; dry_run?: boolean };
console.log("create ->", created.id, "| dry_run:", created.dry_run);

// 2) send via the same helper used in production (tools injected)
await sendInvoice(tools, created.id ?? "DRY-UNKNOWN", "dry-run send");
console.log("send -> simulated ✓");

// 3) reminder (stubbed; rate-limit ledger must NOT be touched by dry runs)
await (
	tools.send_invoice_reminder as unknown as {
		execute: (a: unknown, o: unknown) => Promise<string>;
	}
).execute(
	{ invoice_id: created.id },
	{ toolCallId: "dry-reminder", messages: [] },
);
console.log("reminder -> simulated ✓");

// 4) record payment (stubbed)
await (
	tools.record_payment_for_invoice as unknown as {
		execute: (a: unknown, o: unknown) => Promise<string>;
	}
).execute(
	{
		invoice_id: created.id,
		payment_date: "2026-10-28",
		method: "CASH",
		amount: { currency_code: "USD", value: "120.00" },
	},
	{ toolCallId: "dry-record", messages: [] },
);
console.log("record_payment -> simulated ✓");

// 5) verify: sandbox unchanged.
const after = JSON.parse(
	await (
		realTools.list_invoices as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute(
		{ page: 1, page_size: 20, total_required: true },
		{ toolCallId: "after", messages: [] },
	),
) as { total_items?: number };

const blocked = readFileSync("logs/dryrun.ndjson", "utf8")
	.trim()
	.split("\n")
	.filter((l) => l.includes('"mode":"DRY_RUN"'));

const checks: Array<[string, boolean]> = [
	["dry-run result flagged (dry_run: true)", created.dry_run === true],
	["4 money actions logged to logs/dryrun.ndjson", blocked.length >= 4],
	["sandbox invoice count unchanged", before.total_items === after.total_items],
	[
		"reminder rate-limit ledger untouched",
		!existsSync("logs/reminders.json") ||
			!readFileSync("logs/reminders.json", "utf8").includes("DRY-"),
	],
];

let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} dry-run checks passed`);
if (pass !== checks.length)
	throw new Error(`DRY-RUN QA FAILED: ${pass}/${checks.length}`);
console.log("STAGE 50 OK: dry-run executed with zero real effects");
