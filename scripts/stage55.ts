/**
 * Stage 55 marker: "turn off the network" test — retries with backoff, clear
 * messages, recovery WITHOUT manual intervention, no state loss.
 * All failures are simulated deterministically (no real network manipulation).
 * Run: npm run stage55
 */

import { logAgentAction } from "../src/auditlog.ts";
import { getDb } from "../src/db.ts";
import { ApiError, classifyError, withRetry } from "../src/retry.ts";

const checks: Array<[string, boolean]> = [];

// --- T1: network "off" for 2 attempts, then "back on" -> auto-recovery --------
let calls = 0;
const flakyFetch = async () => {
	calls++;
	if (calls < 3) throw new TypeError("fetch failed"); // simulated outage
	return { ok: true };
};
const t1 = await withRetry(flakyFetch, {
	retries: 3,
	baseMs: 50,
	action: "t1_flaky",
});
checks.push([
	"T1 outage -> recovered automatically (3rd attempt)",
	t1.ok === true && calls === 3,
]);

// --- T2: persistent outage -> clear classified error, bounded attempts --------
calls = 0;
const deadFetch = async () => {
	calls++;
	throw new Error("connect ECONNREFUSED 127.0.0.1:443");
};
let t2: ApiError | undefined;
try {
	await withRetry(deadFetch, { retries: 2, baseMs: 30, action: "t2_dead" });
} catch (e) {
	t2 = e as ApiError;
}
checks.push([
	"T2 persistent outage -> ApiError transient, attempts=3 (bounded)",
	t2 instanceof ApiError &&
		t2.kind === "transient" &&
		t2.attempts === 3 &&
		calls === 3,
]);
checks.push([
	"T2 clear message (no stack noise)",
	Boolean(t2?.message.includes("ECONNREFUSED") && t2.message.length < 300),
]);

// --- T3: validation error -> NO retry, clear message -------------------------
calls = 0;
const badRequest = async () => {
	calls++;
	throw new Error(
		'{"name":"VALIDATION_ERROR","details":[{"field":"term_type","description":"Cannot construct instance"}]}',
	);
};
let t3: ApiError | undefined;
try {
	await withRetry(badRequest, {
		retries: 3,
		baseMs: 10,
		action: "t3_validation",
	});
} catch (e) {
	t3 = e as ApiError;
}
checks.push([
	"T3 validation -> exactly 1 attempt (never retried)",
	t3 instanceof ApiError && t3.kind === "validation" && calls === 1,
]);
checks.push([
	"T3 message keeps field details",
	Boolean(t3?.message.includes("term_type")),
]);

// --- T4: auth error -> no retry --------------------------------------------
calls = 0;
let t4: ApiError | undefined;
try {
	await withRetry(
		async () => {
			calls++;
			throw new Error("401 unauthorized: invalid_client");
		},
		{ retries: 3, baseMs: 10, action: "t4_auth" },
	);
} catch (e) {
	t4 = e as ApiError;
}
checks.push([
	"T4 auth -> 1 attempt, kind=auth",
	t4?.kind === "auth" && calls === 1,
]);

// --- T5: no state loss -> failures logged executed=0, never flipped ----------
const db = getDb();
const failedRows = db
	.prepare(
		"SELECT count(*) c FROM agent_actions WHERE executed = 0 AND limit_check = 'BLOCKED'",
	)
	.get() as { c: number };
checks.push([
	"T5 failed attempts stay executed=0 in agent_actions",
	failedRows.c >= 2,
]);

// --- T6: success path still works after retries (end-to-end sanity) ----------
const ok = await withRetry(async () => "healthy", { retries: 1, baseMs: 10 });
checks.push(["T6 success passthrough unaffected", ok === "healthy"]);

// --- T7: classifier sanity ---------------------------------------------------
checks.push([
	"T7 classifier: 429 transient, 400 validation, ENOTFOUND transient",
	classifyError(new Error("429 rate limit")).kind === "transient" &&
		classifyError(new Error("400 bad body")).kind === "validation" &&
		classifyError(new Error("getaddrinfo ENOTFOUND api-m.sandbox.paypal.com"))
			.kind === "transient",
]);

void logAgentAction; // (rows created above via withRetry failure paths)

let pass = 0;
for (const [name, result] of checks) {
	console.log(`${result ? "✓" : "✗"} ${name}`);
	if (result) pass++;
}
console.log(`\n${pass}/${checks.length} retry/error checks passed`);
if (pass !== checks.length)
	throw new Error(`RETRY QA FAILED: ${pass}/${checks.length}`);
console.log(
	"STAGE 55 OK: network-off test — recovery without manual intervention",
);
