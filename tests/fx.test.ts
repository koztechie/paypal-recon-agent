// H-9 (Rule 1 promise): "$500 USD equivalent — currency-converted at the ECB
// reference rate of the day; conversion failure → block" was DOCUMENTED but never
// implemented: the limit compared raw minor units across currencies. These tests
// pin the conversion (and its fail-closed behavior) hermetically — ECB is reached
// through an injected fetch, the USD fast path must never touch the network.

import assert from "node:assert/strict";
import { test } from "node:test";
import { primeFxRates, resetFxCache, usdMinorFrom } from "../src/fx.ts";
import { enforceActionPolicy } from "../src/guards.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time='2026-10-30'>
      <Cube currency='USD' rate='1.1172'/>
      <Cube currency='GBP' rate='0.83'/>
      <Cube currency='JPY' rate='160'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

const fetchWith = (body: string, opts: { fail?: boolean } = {}) =>
	(async () => {
		if (opts.fail) throw new Error("ECB down");
		return new Response(body, { status: 200 });
	}) as unknown as typeof fetch;

test("H-9a: USD fast path — identity conversion with ZERO network calls", async () => {
	resetFxCache();
	const spy = (async () => {
		throw new Error("USD must never fetch");
	}) as unknown as typeof fetch;
	await primeFxRates({ fetchImpl: spy });
	assert.equal(usdMinorFrom(50_000, "USD"), 50_000);
	assert.equal(usdMinorFrom(1, "USD"), 1);
});

test("H-9b: prime parses the ECB daily XML; EUR/GBP convert via cross-rates", async () => {
	resetFxCache();
	assert.equal(await primeFxRates({ fetchImpl: fetchWith(XML) }), true);
	// EUR is the ECB base:50000 minor EUR -> *1.1172 =55860 USD-minor
	assert.equal(usdMinorFrom(50_000, "EUR"), 55_860);
	// GBP: (1.1172 / 0.83) =1.3460241… *40000 =53840.96… ->53841
	assert.equal(usdMinorFrom(40_000, "GBP"), 53_841);
	assert.equal(usdMinorFrom(0, "EUR"), 0);
});

test("H-9c: unknown currency or unprimed cache -> null (fail-closed raw material)", async () => {
	resetFxCache();
	await primeFxRates({ fetchImpl: fetchWith(XML) });
	assert.equal(usdMinorFrom(50_000, "XXX"), null);
	resetFxCache();
	assert.equal(
		usdMinorFrom(50_000, "EUR"),
		null,
		"unprimed non-USD is unknown, not raw-compared",
	);
	assert.equal(usdMinorFrom(50_000, "USD"), 50_000, "USD still works unprimed");
});

test("H-9d: ECB outage -> prime fails, non-USD becomes null (fail-closed), USD unaffected", async () => {
	resetFxCache();
	assert.equal(
		await primeFxRates({ fetchImpl: fetchWith(XML, { fail: true }) }),
		false,
	);
	assert.equal(usdMinorFrom(50_000, "EUR"), null);
	assert.equal(usdMinorFrom(50_000, "USD"), 50_000);
	resetFxCache();
});

test("H-9e: THE BEHAVIORAL PIN — €500 passes RAW but must be BLOCKED once converted (≈$558.60)", async () => {
	resetFxCache();
	// raw comparison (the documented bug):50000 <=50000 would ALLOW it
	const raw = enforceActionPolicy("record_payment_for_invoice", 50_000, {});
	assert.equal(
		raw.allowed,
		true,
		"sanity: raw minor units fit the $500 constant",
	);
	await primeFxRates({ fetchImpl: fetchWith(XML) });
	const converted = enforceActionPolicy("record_payment_for_invoice", 50_000, {
		currency: "EUR",
		targetRef: "EUR-LIMIT-TEST",
	});
	assert.equal(
		converted.allowed,
		false,
		"€500 ≈ $558.60 must exceed the $500 limit",
	);
	assert.match(converted.reason, /exceeds agent auto-limit/);
	assert.match(
		converted.reason,
		/558\.60/,
		"the reason shows the converted USD value",
	);
	// and a €400 (≈$446.88) passes
	const below = enforceActionPolicy("record_payment_for_invoice", 40_000, {
		currency: "EUR",
	});
	assert.equal(below.allowed, true, "€400 ≈ $446.88 is inside the $500 limit");
	assert.match(below.reason, /446\.88/);
	resetFxCache();
});

test("H-9f: non-USD while unprimed -> BLOCKED fail-closed (conversion failure → block, per Rule 1)", async () => {
	resetFxCache();
	const out = enforceActionPolicy("record_payment_for_invoice", 10_000, {
		currency: "EUR",
		targetRef: "EUR-UNPRIMED",
	});
	assert.equal(out.allowed, false);
	assert.match(out.reason, /FX|ECB/i);
	const usd = enforceActionPolicy("record_payment_for_invoice", 10_000, {});
	assert.equal(usd.allowed, true, "USD path never needs the rate");
	resetFxCache();
});
