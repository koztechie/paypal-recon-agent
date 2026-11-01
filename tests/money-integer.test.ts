// M-1: money must be VALIDATED INTEGER minor units everywhere — the docs claim an
// exact-cents ledger, but dollarsToMinor was Math.round(parseFloat()) with no
// validation: "abc" → NaN → NOT NULL/CHECK violations (webhooks lost), NaN PASSED
// the $500 policy (NaN > limit is false!), and NaN totals silently broke matching
// (NaN !== NaN → false UNMATCHED). amountOf (web) leaked NaN into the grid.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dollarsToMinor } from "../src/db.ts";
import { createDraftInvoice, recordExternalPayment } from "../src/invoicing.ts";
import type { ToolkitTools } from "../src/paypal.ts";
import { amountOf } from "../web/lib/money.ts";

test("M-1a: valid decimal strings -> exact integer minor units", () => {
	assert.equal(dollarsToMinor("43.50"), 4350);
	assert.equal(dollarsToMinor("0.01"), 1);
	assert.equal(dollarsToMinor("0.1"), 10); // float artifact:0.1*100 =10.000…2 -> exact10
	assert.equal(dollarsToMinor("9999999.99"), 999999999);
	assert.equal(
		dollarsToMinor(45),
		4500,
		"number inputs get the same dollars semantics",
	);
});

test("M-1b: missing amount stays the documented0 (fee/net optional columns)", () => {
	assert.equal(dollarsToMinor(undefined), 0);
	assert.equal(dollarsToMinor(""), 0);
	assert.equal(dollarsToMinor("   "), 0, "whitespace-only trims to missing");
});

test("M-1c: malformed / unsafe amounts THROW (never NaN into a NOT NULL column)", () => {
	for (const bad of [
		"abc",
		"NaN",
		"Infinity",
		"-5",
		"1e999",
		"0x10",
		"1e3",
		"100000000000000.01",
	]) {
		assert.throws(
			() => dollarsToMinor(bad),
			/invalid money value/,
			`must reject ${JSON.stringify(bad)}`,
		);
	}
});

test("M-1d: web amountOf — malformed reads as0 (grid never shows NaN)", () => {
	assert.equal(amountOf({ value: "43.5", currency_code: "USD" }), 43.5);
	assert.equal(amountOf({ value: "abc", currency_code: "USD" }), 0);
	assert.equal(amountOf({ value: "", currency_code: "USD" }), 0);
	assert.equal(amountOf(undefined), 0);
	assert.equal(amountOf(null), 0);
	// the grid is a DISPLAY surface: a negative (refund) row keeps its true value
	assert.equal(amountOf({ value: "-5.25", currency_code: "USD" }), -5.25);
});

test("M-1e: garbage never reaches the $500 policy as NaN (create + record throw first)", async () => {
	const calls: unknown[] = [];
	const tools = {
		create_invoice: {
			execute: async (a: unknown) => {
				calls.push(a);
				return "{}";
			},
		},
		get_invoice: { execute: async () => "{}" },
		record_payment_for_invoice: {
			execute: async (a: unknown) => {
				calls.push(a);
				return "{}";
			},
		},
	} as unknown as ToolkitTools;

	await assert.rejects(
		() =>
			createDraftInvoice(tools, {
				buyerEmail: "x@y.z",
				itemName: "M1E-CREATE",
				amount: "garbage",
				currency: "USD",
			}),
		/invalid money value/,
	);
	await assert.rejects(
		() => recordExternalPayment(tools, "INV2-M1E", "garbage", "USD"),
		/invalid money value/,
	);
	assert.equal(calls.length, 0, "no PayPal call for unparseable money");
	// and no PASS audit row was logged for either (policy never ran on NaN)
	const { getDb } = await import("../src/db.ts");
	const rows = getDb()
		.prepare(
			"SELECT limit_check FROM agent_actions WHERE target_ref IN ('M1E-CREATE','INV2-M1E')",
		)
		.all() as Array<{ limit_check: string }>;
	assert.equal(
		rows.length,
		0,
		"no audit rows for a rejected-before-policy call",
	);
});
