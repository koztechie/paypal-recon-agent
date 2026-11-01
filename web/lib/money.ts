// M-1: the validated money read for UI surfaces (dollars, not minor units).
// Pure and dependency-free so the test suite can import it directly under Node's
// strip-only TypeScript (web/lib/paypal.ts itself uses class parameter properties,
// which strip-only mode cannot load). Malformed or missing -> 0 (the grid must
// never show NaN); a true negative (refund row) keeps its value.
const DOLLARS = /^-?\d+(\.\d+)?$/;

export function amountOf(
	m?: { value?: string; currency_code?: string } | null,
): number {
	const v = m?.value?.trim();
	if (v === undefined || v === "") return 0;
	return DOLLARS.test(v) ? Number(v) : 0;
}
