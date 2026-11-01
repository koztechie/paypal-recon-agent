// C-5: the AG Studio AI proxy must be (a) local-only — an evil website in the
// user's browser carries its own Origin and must be refused — and (b) bounded —
// arbitrary-size/arbitrary-count `messages` were the credit-burn vector.
import assert from "node:assert/strict";
import { test } from "node:test";
import { guardStudioAi, validateAiBody } from "../web/lib/ai-limits.ts";

// ---------- guardStudioAi(origin, host) ----------
test("local host without Origin (curl / server tooling) -> allowed", () => {
	assert.deepEqual(guardStudioAi(undefined, "localhost:3001"), { ok: true });
});

test("local host with local Origin (the Studio UI itself) -> allowed", () => {
	assert.deepEqual(guardStudioAi("http://localhost:3001", "localhost:3001"), {
		ok: true,
	});
	assert.deepEqual(guardStudioAi("http://127.0.0.1:3001", "127.0.0.1:3001"), {
		ok: true,
	});
});

test("evil Origin against local host -> REJECTED (the localhost burn vector)", () => {
	const out = guardStudioAi("https://evil.example", "localhost:3001");
	assert.equal(out.ok, false);
	assert.equal(out.status, 503);
});

test("Origin 'null' (sandboxed iframe) -> REJECTED", () => {
	assert.equal(guardStudioAi("null", "localhost:3001").ok, false);
});

test("non-local Host (if web were ever deployed) -> REJECTED", () => {
	assert.equal(
		guardStudioAi(undefined, "paypal-recon-agent.onrender.com").ok,
		false,
	);
	assert.equal(
		guardStudioAi(
			"https://paypal-recon-agent.onrender.com",
			"paypal-recon-agent.onrender.com",
		).ok,
		false,
	);
});

test("lookalike host localhost.evil.com -> REJECTED", () => {
	assert.equal(guardStudioAi(undefined, "localhost.evil.com").ok, false);
});

// ---------- validateAiBody(text) ----------
test("valid small JSON with messages -> ok, parsed body", () => {
	const out = validateAiBody(
		JSON.stringify({
			model: "gpt-5.4-mini",
			messages: [{ role: "user", content: "hi" }],
		}),
	);
	assert.equal(out.ok, true);
	assert.equal(out.ok && out.body.messages.length, 1);
});

test("body over64KB -> rejected with413", () => {
	const big = JSON.stringify({
		messages: [{ role: "user", content: "x".repeat(70_000) }],
	});
	const out = validateAiBody(big);
	assert.equal(out.ok, false);
	assert.equal(!out.ok && out.status, 413);
});

test("more than50 messages -> rejected with400", () => {
	const many = JSON.stringify({
		messages: Array.from({ length: 51 }, (_, i) => ({
			role: "user",
			content: `m${i}`,
		})),
	});
	const out = validateAiBody(many);
	assert.equal(out.ok, false);
	assert.equal(!out.ok && out.status, 400);
});

test("messages present but not an array -> rejected with400", () => {
	const out = validateAiBody(JSON.stringify({ messages: "drop-table" }));
	assert.equal(out.ok, false);
	assert.equal(!out.ok && out.status, 400);
});

test("invalid JSON -> rejected with400", () => {
	const out = validateAiBody("{not json");
	assert.equal(out.ok, false);
	assert.equal(!out.ok && out.status, 400);
});
