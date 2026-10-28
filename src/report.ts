/**
 * Daily summary (stage 66, agent action #4): counts from a day of data,
 * rendered as a merchant report. LLM polishes; deterministic template is the
 * fallback (and the numbers ALWAYS come from SQL, never from the model).
 * Usage cadence: once per day (SECURITY stage-19 action table).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { chat } from "./llm.ts";

export interface DailyStats {
	date: string;
	payments: number;
	matched: number;
	review: number;
	unmatched: number;
	matchedAmountMinor: number;
	varianceAbsMinor: number;
	events: number;
	remindersSent: number;
}

export function collectDailyStats(db: DatabaseSync, date?: string): DailyStats {
	const day = date ?? new Date().toISOString().slice(0, 10);
	const one = <T>(sql: string, ...args: unknown[]): T =>
		db.prepare(sql).get(...(args as never[])) as T;

	const payments = one<{ c: number }>(
		"SELECT count(*) c FROM payments WHERE date(received_at) = date(?)",
		day,
	).c;
	const statuses = db
		.prepare(
			`SELECT r.status, count(*) c, COALESCE(SUM(CASE WHEN r.status='MATCHED' THEN p.amount_minor ELSE 0 END),0) amt,
            COALESCE(SUM(ABS(r.variance_minor)),0) varsum
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE date(r.detected_at) = date(?) GROUP BY r.status`,
		)
		.all(day) as Array<{
		status: string;
		c: number;
		amt: number;
		varsum: number;
	}>;
	const by = (s: string) => statuses.find((x) => x.status === s)?.c ?? 0;
	const events = one<{ c: number }>(
		"SELECT count(*) c FROM webhook_events WHERE date(received_at) = date(?)",
		day,
	).c;
	const remindersSent = one<{ c: number }>(
		"SELECT count(*) c FROM agent_actions WHERE action='send_invoice_reminder' AND executed=1 AND date(created_at) = date(?)",
		day,
	).c;

	return {
		date: day,
		payments,
		matched: by("MATCHED"),
		review: by("REVIEW"),
		unmatched: by("UNMATCHED"),
		matchedAmountMinor: statuses.find((x) => x.status === "MATCHED")?.amt ?? 0,
		varianceAbsMinor: statuses.reduce((s, x) => s + x.varsum, 0),
		events,
		remindersSent,
	};
}

const money = (minor: number) => `${(minor / 100).toFixed(2)}`;

const SUMMARY_SYSTEM = [
	"You write a ONE-PARAGRAPH daily merchant report from pre-computed numbers.",
	"Rules: repeat EXACTLY the numbers given (amounts as dollars with 2 decimals),",
	"never invent data, plain English, no markdown headings, start with the date.",
	"Cover: payments received, matched, in review/discrepancies, unmatched,",
	"total matched amount, absolute variance, webhook events, reminders sent.",
].join("\n");

export async function dailySummary(
	db: DatabaseSync,
	date?: string,
): Promise<{ report: string; stats: DailyStats; via: "llm" | "template" }> {
	const stats = collectDailyStats(db, date);
	const template =
		`${stats.date}: ${stats.payments} payments received; ${stats.matched} matched ` +
		`(${money(stats.matchedAmountMinor)} USD), ${stats.review} in discrepancy review, ` +
		`${stats.unmatched} unmatched; |variance| ${money(stats.varianceAbsMinor)} USD; ` +
		`${stats.events} webhook events; ${stats.remindersSent} reminders sent.`;

	try {
		const r = await chat(SUMMARY_SYSTEM, JSON.stringify(stats), {
			temperature: 0,
			maxTokens: 220,
		});
		const text = r.text.trim();
		if (text.length < 40 || !text.includes(String(stats.payments))) {
			return { report: template, stats, via: "template" };
		}
		return { report: text, stats, via: "llm" };
	} catch {
		return { report: template, stats, via: "template" };
	}
}

// --- Action #5 for core C (stage 67): tax / marketplace compliance report ----

export interface ComplianceReport {
	from: string;
	to: string;
	audience: "tax" | "marketplace";
	perCurrency: Array<{
		currency: string;
		payments: number;
		grossMinor: number;
		feeMinor: number;
		netMinor: number;
	}>;
	reviewRows: Array<{
		paymentId: string;
		varianceMinor: number;
		reason: string | null;
		explanation: string;
	}>;
	unmatched: Array<{
		paymentId: string;
		amountMinor: number;
		currency: string;
	}>;
	summary: string;
	file: string;
}

/**
 * Builds a period report suitable for a Ukrainian ФОП tax filing or a
 * marketplace seller back-office: gross/fee/net per currency (SQL truth),
 * every REVIEW row with its explanation, unmatched payments, LLM summary.
 * Writes logs/reports/compliance_<from>_<to>_<audience>.md.
 */
export function generateComplianceReport(
	db: DatabaseSync,
	opts: { from: string; to: string; audience: "tax" | "marketplace" },
): ComplianceReport {
	const { from, to, audience } = opts;

	const perCurrency = db
		.prepare(
			`SELECT currency, count(*) payments,
            SUM(amount_minor) gross, SUM(fee_minor) fee, SUM(net_minor) net
     FROM payments
     WHERE date(received_at) BETWEEN date(?) AND date(?)
     GROUP BY currency ORDER BY currency`,
		)
		.all(from, to) as ComplianceReport["perCurrency"];

	const reviewRows = db
		.prepare(
			`SELECT p.paypal_payment_id paymentId, r.variance_minor varianceMinor,
            r.reason reason, r.ai_explanation explanation
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE r.status='REVIEW' AND date(r.detected_at) BETWEEN date(?) AND date(?)
     ORDER BY ABS(r.variance_minor) DESC`,
		)
		.all(from, to) as ComplianceReport["reviewRows"];

	const unmatched = db
		.prepare(
			`SELECT p.paypal_payment_id paymentId, p.amount_minor amountMinor, p.currency currency
     FROM reconciliation_records r JOIN payments p ON p.id = r.payment_id
     WHERE r.status='UNMATCHED' AND date(r.detected_at) BETWEEN date(?) AND date(?)`,
		)
		.all(from, to) as ComplianceReport["unmatched"];

	const audienceLabel =
		audience === "tax"
			? "Tax filing support (ФОП): gross, fees and net per currency for the period."
			: "Marketplace seller report: settlements, discrepancies and unmatched items for the period.";

	const lines: string[] = [];
	lines.push(`# Compliance report (${audience})`);
	lines.push(`Period: ${from} .. ${to}`);
	lines.push("");
	lines.push(`Purpose: ${audienceLabel}`);
	lines.push("");
	lines.push("| Currency | Payments | Gross | Fee | Net |");
	lines.push("|---|---|---|---|---|");
	for (const c of perCurrency) {
		lines.push(
			`| ${c.currency} | ${c.payments} | ${money(c.grossMinor)} | ${money(c.feeMinor)} | ${money(c.netMinor)} |`,
		);
	}
	lines.push("");
	lines.push(`Discrepancies requiring attention: ${reviewRows.length}`);
	for (const r of reviewRows) {
		lines.push(
			`- ${r.paymentId}: variance ${(r.varianceMinor / 100).toFixed(2)} — ${r.explanation}`,
		);
	}
	lines.push("");
	lines.push(`Unmatched payments: ${unmatched.length}`);
	for (const u of unmatched) {
		lines.push(
			`- ${u.paymentId}: ${(u.amountMinor / 100).toFixed(2)} ${u.currency}`,
		);
	}

	const deterministic = lines.join("\n");

	mkdirSync("logs/reports", { recursive: true });
	const file = `logs/reports/compliance_${from}_${to}_${audience}.md`;

	// Deterministic report is the source of truth (all numbers from SQL).
	const summary = `Total across currencies: ${perCurrency.reduce((s, c) => s + c.payments, 0)} payments in period; ${reviewRows.length} need attention; ${unmatched.length} unmatched.`;
	writeFileSync(file, `${deterministic}\n\n## Summary\n${summary}\n`);

	return {
		from,
		to,
		audience,
		perCurrency,
		reviewRows,
		unmatched,
		summary,
		file,
	};
}
