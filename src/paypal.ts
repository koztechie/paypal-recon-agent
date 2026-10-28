/**
 * PayPal Agent Toolkit wiring (stage 39, ADR-004).
 *
 * The `actions` whitelist is the primary guardrail (SECURITY.md rule 2,
 * stage 19 table): everything not listed here is unreachable by the agent.
 * Explicitly DISABLED (human-only, red list): refunds, invoice cancel/delete,
 * dispute acceptance, payouts, subscriptions/catalog/shipment.
 */
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";

export function createPaypalToolkit(): PayPalAgentToolkit {
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
	if (!clientId || clientId.startsWith("REPLACE")) {
		throw new Error("PAYPAL_CLIENT_ID is missing (see .env.example)");
	}
	if (!clientSecret || clientSecret.startsWith("REPLACE")) {
		throw new Error("PAYPAL_CLIENT_SECRET is missing (see .env.example)");
	}

	const sandbox =
		(process.env.PAYPAL_ENVIRONMENT ?? "SANDBOX") !== "PRODUCTION";

	return new PayPalAgentToolkit({
		clientId,
		clientSecret,
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
}

export type ToolkitTools = ReturnType<PayPalAgentToolkit["getTools"]>;
