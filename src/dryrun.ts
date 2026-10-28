/**
 * Dry-run mode (stage 50): money-affecting toolkit actions are intercepted,
 * logged, and simulated — nothing reaches PayPal. Read-only tools pass through.
 * Enabled via DRY_RUN=true (dev default recommended in .env.local).
 *
 * Mirrors the user's KeyCRM "test_dry_run" pattern: run the full pipeline on
 * mock execution, verify planned actions, produce zero side effects.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import type { ToolkitTools } from "./paypal.ts";

const MONEY_ACTIONS = new Set([
	"create_invoice",
	"send_invoice",
	"send_invoice_reminder",
	"record_payment_for_invoice",
	"record_refund_for_invoice",
	"cancel_sent_invoice",
	"delete_invoice",
	"create_order",
	"pay_order",
	"create_refund",
	"accept_dispute_claim",
	"setup_invoice_auto_reminders",
]);

export function isDryRun(): boolean {
	return (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
}

function simulateResult(method: string, args: unknown): string {
	const id = `DRY-${Date.now().toString(36).toUpperCase()}`;
	if (method === "create_invoice" || method === "create_order") {
		return JSON.stringify({
			id,
			status: "DRAFT",
			dry_run: true,
			href: `https://api.sandbox.paypal.com/v2/invoicing/invoices/${id}`,
		});
	}
	return JSON.stringify({ success: true, dry_run: true, simulated: method });
}

/** Returns toolkit-like tools with money actions stubbed when DRY_RUN=true. */
export function withDryRun(tools: ToolkitTools): ToolkitTools {
	if (!isDryRun()) return tools;
	mkdirSync("logs", { recursive: true });
	const wrapped: Record<string, unknown> = {};
	for (const [name, tool] of Object.entries(tools)) {
		const t = tool as unknown as {
			description?: string;
			parameters?: unknown;
			execute?: (a: unknown, o: unknown) => Promise<unknown>;
		};
		if (!MONEY_ACTIONS.has(name) || !t.execute) {
			wrapped[name] = tool;
			continue;
		}
		const originalExecute = t.execute;
		wrapped[name] = {
			...t,
			execute: async (args: unknown, opts: unknown) => {
				const entry = {
					ts: new Date().toISOString(),
					mode: "DRY_RUN",
					action: name,
					args,
				};
				appendFileSync("logs/dryrun.ndjson", `${JSON.stringify(entry)}\n`);
				console.log(`[dry-run] BLOCKED ${name} -> simulated`);
				void originalExecute; // never called
				void opts;
				return simulateResult(name, args);
			},
		};
	}
	return wrapped as ToolkitTools;
}
