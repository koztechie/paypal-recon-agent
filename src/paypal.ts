/**
 * PayPal Agent Toolkit wiring (stage 39, ADR-004).
 *
 * The `actions` whitelist is the primary guardrail (SECURITY.md rule 2,
 * stage 19 table): everything not listed here is unreachable by the agent.
 * Explicitly DISABLED (human-only, red list): refunds, invoice cancel/delete,
 * dispute acceptance, payouts, subscriptions/catalog/shipment.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { isDryRun, withDryRun } from "./dryrun.ts";
import { logLine } from "./log.ts";

export function createPaypalToolkit(): PayPalAgentToolkit {
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
	const missing = (v?: string) => !v || v.startsWith("REPLACE");
	if (missing(clientId) || missing(clientSecret)) {
		if (!isDryRun()) {
			throw new Error("PAYPAL_CLIENT_ID is missing (see .env.example)");
		}
		// Stage 123: keyless fresh-machine demo — money actions are stubbed by
		// withDryRun anyway, so placeholder credentials can never leave the process.
		logLine(
			"[dry-run] PayPal credentials absent — placeholder mode, no real calls",
		);
	}

	const sandbox =
		(process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX") !== "PRODUCTION";

	// Narrow for the constructor: missing+dry-run already logged above.
	const id = missing(clientId)
		? "DRY-RUN-PLACEHOLDER-CLIENT"
		: (clientId as string);
	const secret = missing(clientSecret)
		? "DRY-RUN-PLACEHOLDER-SECRET"
		: (clientSecret as string);
	const toolkit = new PayPalAgentToolkit({
		clientId: id,
		clientSecret: secret,
		configuration: {
			context: { sandbox },
			actions: {
				// Stage 19 actions 1-5: read-everything, remind within limits,
				// record only webhook-confirmed payments.
				invoices: {
					create: true,
					list: true,
					get: true,
					send: true,
					sendReminder: true,
					search: true,
					update: true,
					generateInvoiceNumber: true,
					cancelReminders: true,
					createConditionalRules: true,
					recordPayment: true,
					setupReminders: true, // auto reminders (ADR-012, stage 42)
					// RED LIST (human-only): cancel, delete, recordRefund
				},
				orders: {
					create: true,
					get: true,
					capture: true, // pay_order (process payment for an authorized order)
					// RED LIST: create_refund (payments.createRefund)
				},
				transactions: {
					list: true,
					// get_merchant_insights lives under `insights.get` and THROWS in
					// sandbox mode ("not supported in sandbox") -> disabled;
					// daily summary (stage 66) uses list_transactions instead.
				},
				disputes: {
					list: true,
					get: true,
					// RED LIST: accept
				},
				// Out of scope per DECISIONS stage-18 table: products,
				// shipment, subscriptionPlans (all default to disabled).
			},
		},
	});
	// Stage 123: the ONE place where DRY_RUN applies — every consumer of getTools()
	// gets stubbed money actions in dry-run mode (keyless demos stay side-effect-free).
	return {
		getTools: () => withDryRun(toolkit.getTools()),
	} as unknown as PayPalAgentToolkit;
}

export type ToolkitTools = ReturnType<PayPalAgentToolkit["getTools"]>;

/**
 * H-3: full pagination over the invoice list — reconciliation and the reminder
 * agent must see EVERY invoice, not just page1 (the sandbox already outgrew the
 * old hardcoded20). `total_required: true` reports `total_pages`; the loop ALSO
 * stops on a short page (defense) and has a hard page cap so a malformed API
 * can never hang the product.
 */
export async function listAllInvoices(
	tools: ToolkitTools,
	pageSize = 100,
): Promise<Array<Record<string, unknown>>> {
	const execute = (
		tools.list_invoices as unknown as {
			execute: (a: unknown, o: unknown) => Promise<unknown>;
		}
	).execute;
	const items: Array<Record<string, unknown>> = [];
	const MAX_PAGES = 50; // hard safety cap: 50 * 100 = 5000 invoices
	for (let page = 1; page <= MAX_PAGES; page++) {
		const raw = await execute(
			{ page, page_size: pageSize, total_required: true },
			{ toolCallId: `list-all-${page}`, messages: [] },
		);
		const data = JSON.parse(String(raw)) as {
			items?: Array<Record<string, unknown>>;
			total_pages?: number;
		};
		const batch = data.items ?? [];
		items.push(...batch);
		if (typeof data.total_pages === "number" && page >= data.total_pages) break;
		if (batch.length < pageSize) break;
	}
	return items;
}
