/**
 * Stage 54: logging audit — every action is a timestamped row; last 24h log
 * has NO GAPS (PayPal-side events backfilled via resend when missing locally).
 * Run: npm run stage54
 */
import { existsSync, readFileSync } from "node:fs";
import { logAgentAction } from "../src/auditlog.ts";
import { getDb } from "../src/db.ts";
import { sendInvoiceReminder } from "../src/invoicing.ts";
import { createPaypalToolkit } from "../src/paypal.ts";

const db = getDb();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function paypal(
	path: string,
	method = "GET",
	body?: unknown,
): Promise<unknown> {
	const cid = process.env.PAYPAL_CLIENT_ID;
	const cs = process.env.PAYPAL_CLIENT_SECRET;
	const auth = Buffer.from(`${cid}:${cs}`).toString("base64");
	const tok = (await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	}).then((r) => r.json())) as { access_token: string };
	const res = await fetch(`https://api-m.sandbox.paypal.com${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${tok.access_token}`,
			"Content-Type": "application/json",
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	return res.json();
}

// 0) Prove rule-3 logging works: a BLOCKED attempt must still produce a row.
try {
	await sendInvoiceReminder(
		createPaypalToolkit().getTools(),
		"INV2-CXQ5-F3AW-8P75-225Y",
	);
} catch {
	/* expected: rate limit */
}
logAgentAction({
	action: "stage54_audit",
	limitCheck: "PASS",
	executed: true,
	llmDecision: "audit-run",
});

// 1) Authoritative source: PayPal events (last 24h).
const remote = (await paypal(
	"/v1/notifications/webhooks-events?page_size=100",
)) as {
	events?: Array<{ id?: string; event_type?: string; create_time?: string }>;
};
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
const remoteIds = (remote.events ?? [])
	.filter((e) => e.create_time && new Date(e.create_time).getTime() >= cutoff)
	.map((e) => e.id as string);
console.log(`PayPal events (24h): ${remoteIds.length}`);

// 2) Local: webhook_events + NDJSON.
const localIds = new Set(
	(
		db.prepare("SELECT paypal_event_id id FROM webhook_events").all() as Array<{
			id: string;
		}>
	).map((r) => r.id),
);
const ndjsonCount = existsSync("logs/webhooks.ndjson")
	? readFileSync("logs/webhooks.ndjson", "utf8")
			.trim()
			.split("\n")
			.filter(Boolean).length
	: 0;
console.log(`local rows: ${localIds.size} | NDJSON lines: ${ndjsonCount}`);

let gaps = remoteIds.filter((id) => !localIds.has(id));
console.log(`gaps before backfill: ${gaps.length}`);

// 3) Auto-backfill: resend missing events (idempotent server-side; dedupe locally).
for (const id of gaps.slice(0, 20)) {
	const r = (await paypal(
		`/v1/notifications/webhooks-events/${id}/resend`,
		"POST",
		{},
	)) as Record<string, unknown>;
	console.log(`resend ${id}: ${JSON.stringify(r).slice(0, 60)}`);
	await sleep(1500);
}
if (gaps.length) await sleep(8000);

// 4) Re-verify.
const localIds2 = new Set(
	(
		db.prepare("SELECT paypal_event_id id FROM webhook_events").all() as Array<{
			id: string;
		}>
	).map((r) => r.id),
);
gaps = remoteIds.filter((id) => !localIds2.has(id));
console.log(`gaps after backfill: ${gaps.length}`);
if (gaps.length) console.log("missing:", gaps.join(", "));

// 5) agent_actions: every row has a timestamp (rule 3).
const actions = db
	.prepare(
		"SELECT action, limit_check lc, executed ex, created_at ts FROM agent_actions ORDER BY id",
	)
	.all() as Array<{ action: string; lc: string; ex: number; ts: string }>;
console.log(`agent_actions rows: ${actions.length}`);
for (const a of actions.slice(-5))
	console.log("  ", a.ts, a.action, a.lc, a.ex ? "exec" : "planned");

const checks: Array<[string, boolean]> = [
	["no gaps: all PayPal 24h events present locally", gaps.length === 0],
	["NDJSON log has events", ndjsonCount >= 10],
	[
		"agent_actions rows exist with timestamps",
		actions.length >= 1 && actions.every((a) => Boolean(a.ts)),
	],
	["BLOCKED attempt logged (rule 3)", actions.some((a) => a.lc === "BLOCKED")],
];
let pass = 0;
for (const [name, ok] of checks) {
	console.log(`${ok ? "✓" : "✗"} ${name}`);
	if (ok) pass++;
}
console.log(`\n${pass}/${checks.length} logging checks passed`);
if (pass !== checks.length)
	throw new Error(`LOGGING AUDIT FAILED: ${pass}/${checks.length}`);
console.log("STAGE 54 OK: 24h log without gaps; every action timestamped");
