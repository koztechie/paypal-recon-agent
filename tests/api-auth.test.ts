// C-2: mutating endpoints (/api/action, /api/recon/run, /api/negotiate) must not be
// callable by the whole internet when ACTION_TOKEN is configured; with the token
// unset the server keeps working but says so LOUDLY (same pattern as C-1).
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkActionAuth } from "../src/api-auth.ts";

// signature: checkActionAuth(authorizationHeader, xActionTokenHeader, configuredToken)

test("no ACTION_TOKEN configured -> allowed, with the unprotected warning flag", () => {
	const out = checkActionAuth("Bearer anything", undefined, undefined);
	assert.deepEqual(out, { allowed: true, warnUnprotected: true });
});

test("token set + matching Bearer header -> allowed, no warning", () => {
	const out = checkActionAuth("Bearer s3cret", undefined, "s3cret");
	assert.deepEqual(out, { allowed: true, warnUnprotected: false });
});

test("token set + matching x-action-token header -> allowed (no Authorization needed)", () => {
	const out = checkActionAuth(undefined, "s3cret", "s3cret");
	assert.deepEqual(out, { allowed: true, warnUnprotected: false });
});

test("token set + wrong values -> denied", () => {
	assert.equal(
		checkActionAuth("Bearer wrong", undefined, "s3cret").allowed,
		false,
	);
	assert.equal(checkActionAuth(undefined, "wrong", "s3cret").allowed, false);
});

test("token set + no credentials at all -> denied", () => {
	assert.equal(checkActionAuth(undefined, undefined, "s3cret").allowed, false);
});

test("comparison is length-safe for longer attacker values", () => {
	assert.equal(
		checkActionAuth(`Bearer ${"x".repeat(500)}`, undefined, "s3cret").allowed,
		false,
	);
});
