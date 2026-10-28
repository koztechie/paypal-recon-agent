/**
 * Agent action chain (stage 65): LLM sees REAL unpaid invoices, decides,
 * the guarded tool executes — no manual step anywhere.
 * Protected invoices (stage-42 subjects) are excluded by design.
 */
import { decideReminder } from "./actions.ts";
import {
	checkReminderAllowed,
	type InvoiceResult,
	sendInvoiceReminder,
} from "./invoicing.ts";
import type { ToolkitTools } from "./paypal.ts";

/** Stage-42 subjects: never touched by the agent (auto-reminder windows). */
export const PROTECTED_INVOICES = new Set([
	"INV2-ZKMY-MVK3-AEMZ-QKP4",
	"INV2-R7BT-JKFT-EYM7-67SL",
]);

export interface ReminderRun {
	invoiceId: string;
	invoiceNumber?: string;
	decision: "REMIND" | "WAIT" | "SKIP";
	reason: string;
	executed: boolean;
	blockedReason?: string;
}

function parseToolResultLocal(result: unknown): InvoiceResult {
	if (result == null || result === "") return {} as InvoiceResult;
	const parsed =
		typeof result === "string" ? (JSON.parse(result) as unknown) : result;
	return parsed as InvoiceResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runReminderAgent(
	tools: ToolkitTools,
	opts: { maxInvoices?: number } = {},
): Promise<ReminderRun[]> {
	const listExec = (
		tools.list_invoices as unknown as {
			execute: (a: unknown, o: unknown) => Promise<string>;
		}
	).execute;
	const listed = parseToolResultLocal(
		await listExec(
			{ page: 1, page_size: 20, total_required: true },
			{ toolCallId: "agent-list", messages: [] },
		),
	) as { items?: Array<Record<string, unknown>> };

	const runs: ReminderRun[] = [];
	const max = opts.maxInvoices ?? 5;

	// Priority: SENT invoices first, newest first (agent must find live work).
	const items = [...(listed.items ?? [])].sort((a, b) => {
		const aSent = a.status === "SENT" ? 0 : 1;
		const bSent = b.status === "SENT" ? 0 : 1;
		if (aSent !== bSent) return aSent - bSent;
		const ad = String(
			(a.detail as Record<string, unknown> | undefined)?.invoice_date ?? "",
		);
		const bd = String(
			(b.detail as Record<string, unknown> | undefined)?.invoice_date ?? "",
		);
		return bd.localeCompare(ad);
	});

	for (const inv of items.slice(0, max)) {
		const id = String(inv.id);
		const detail = (inv.detail ?? {}) as Record<string, unknown>;
		const amount = (inv.amount ?? {}) as {
			value?: string;
			currency_code?: string;
		};
		const paymentTerm = (detail.payment_term ?? {}) as { due_date?: string };
		const status = String(inv.status ?? "");

		if (PROTECTED_INVOICES.has(id)) {
			runs.push({
				invoiceId: id,
				decision: "SKIP",
				reason: "protected (stage-42 auto-reminder subject)",
				executed: false,
			});
			continue;
		}
		if (status !== "SENT" || !amount.value) {
			runs.push({
				invoiceId: id,
				decision: "SKIP",
				reason: `status=${status}`,
				executed: false,
			});
			continue;
		}

		// Real overdue computation from the due date (fallback: invoice_date).
		const dueStr = paymentTerm.due_date ?? String(detail.invoice_date ?? "");
		const daysOverdue = dueStr
			? Math.floor(
					(Date.now() - new Date(`${dueStr}T00:00:00Z`).getTime()) / DAY_MS,
				)
			: 0;

		const gateBefore = checkReminderAllowed(id);
		const decision = await decideReminder({
			invoice_number: String(detail.invoice_number ?? "(none)"),
			status,
			amount: amount.value,
			currency: amount.currency_code ?? "USD",
			days_outstanding: daysOverdue,
			reminders_last_24h: gateBefore.allowed ? 0 : 1,
			reminders_lifetime: gateBefore.reason.includes("lifetime") ? 3 : 0,
		});

		if (decision.decision !== "REMIND") {
			runs.push({
				invoiceId: id,
				invoiceNumber: detail.invoice_number as string | undefined,
				decision: "WAIT",
				reason: decision.reason,
				executed: false,
			});
			continue;
		}

		try {
			await sendInvoiceReminder(
				tools,
				id,
				`Automated reminder: invoice ${String(detail.invoice_number ?? id)} is overdue (agent, stage 65)`,
			);
			runs.push({
				invoiceId: id,
				invoiceNumber: detail.invoice_number as string | undefined,
				decision: "REMIND",
				reason: decision.reason,
				executed: true,
			});
		} catch (e) {
			runs.push({
				invoiceId: id,
				invoiceNumber: detail.invoice_number as string | undefined,
				decision: "REMIND",
				reason: decision.reason,
				executed: false,
				blockedReason: e instanceof Error ? e.message.slice(0, 120) : String(e),
			});
		}
	}
	return runs;
}
