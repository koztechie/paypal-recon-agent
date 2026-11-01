// M-2: zero-decimal ISO 4217 currencies (JPY/KRW/VND/…) must display and travel as
// whole units — the storage model is a UNIFORM pseudo-cent (everything ×100, one
// consistent scale for matching/variance/FX; H-9's linear FX math is scale-invariant),
// and formatting converts per-currency at the boundary. Outbound API strings and every
// human-readable amount go through the same formatter.

import assert from "node:assert/strict";
import { test } from "node:test";
import { dollarsToMinor } from "../src/db.ts";
import { primeFxRates, resetFxCache, usdMinorFrom } from "../src/fx.ts";
import {
	formatMinorUnits,
	minorDigits,
	ZERO_DECIMAL_CURRENCIES,
} from "../src/money-format.ts";

test("M-2a: the zero-decimal set covers the classic offenders", () => {
	for (const c of ["JPY", "KRW", "VND", "CLP", "UGX", "PYG"]) {
		assert.equal(minorDigits(c), 0, `${c} has no minor unit`);
	}
	for (const c of ["USD", "EUR", "GBP", "UAH", "CHF"]) {
		assert.equal(minorDigits(c), 2, `${c} uses cents`);
	}
	assert.equal(minorDigits(undefined), 2, "unknown -> conservative2");
	assert.ok(ZERO_DECIMAL_CURRENCIES.has("JPY"));
});

test("M-2b: formatMinorUnits — whole units for zero-decimal, cents otherwise", () => {
	assert.equal(formatMinorUnits(50_000, "JPY"), "500"); // our storage: ¥500 ->50000 pseudo-cents
	assert.equal(formatMinorUnits(3_000, "KRW"), "30");
	assert.equal(formatMinorUnits(500_000, "VND"), "5000");
	assert.equal(formatMinorUnits(4_350, "USD"), "43.50"); // $43.50
	assert.equal(formatMinorUnits(45_000, "EUR"), "450.00");
	assert.equal(formatMinorUnits(0, "JPY"), "0");
	assert.equal(formatMinorUnits(0, "USD"), "0.00");
	assert.equal(formatMinorUnits(1, "USD"), "0.01");
	assert.equal(formatMinorUnits(12_345, "JPY"), "123");
});

test("M-2c: the web grid formatter is Intl-based (knows JPY has no cents) — pinned", () => {
	const jpy = (500).toLocaleString("en-US", {
		style: "currency",
		currency: "JPY",
	});
	const usd = (43.5).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
	assert.ok(
		jpy.includes("500") && !jpy.includes(".00"),
		`Intl must render ¥500 without cents, got ${jpy}`,
	);
	assert.ok(usd.includes("43.50"), `Intl keeps cents for USD, got ${usd}`);
});

test("M-2d: SYSTEMIC proof — JPY end-to-end: parse -> storage scale -> FX gives TRUE USD cents", () => {
	const jpyMinor = dollarsToMinor("50000"); // ¥50000 stored as5000000 pseudo-cents
	assert.equal(jpyMinor, 5_000_000);
	// H-9 FX with the fixture rates: USD1.1172 / JPY160 per EUR
	const xml = `<?xml version="1.0"?><gesmes:Envelope xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><Cube><Cube time='2026-10-30'><Cube currency='USD' rate='1.1172'/><Cube currency='JPY' rate='160'/></Cube></Cube></gesmes:Envelope>`;
	return primeFxRates({
		fetchImpl: (async () => new Response(xml)) as unknown as typeof fetch,
	}).then((ok) => {
		assert.equal(ok, true);
		const usdCents = usdMinorFrom(jpyMinor, "JPY");
		const expected = Math.round(5_000_000 * (1.1172 / 160)); // identical expression (FP-stable)
		assert.equal(
			usdCents,
			expected,
			"scale-invariant: ×100 storage cancels in the linear FX math",
		);
		// the $500 limit gets the TRUTH: ¥50000 ≈ $349.13 -> inside the limit
		assert.ok(
			(usdCents ?? 0) < 50_000,
			"¥50000 must NOT be blocked as if it were $50000",
		);
		// and ¥60000 ≈ $418.95 -> still inside; the old RAW compare (6000000 > 50000) blocked both
		const more = usdMinorFrom(dollarsToMinor("60000"), "JPY") ?? 0;
		assert.ok(more < 50_000, "¥60000 ≈ $419 also passes");
		resetFxCache();
	});
});
