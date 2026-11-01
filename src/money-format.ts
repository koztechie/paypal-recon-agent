/**
 * Currency-aware money formatting (finding M-2, zero-decimal ISO 4217).
 *
 * Storage model (ADR-022): EVERY amount is stored as a uniform "pseudo-cent"
 * (dollars-string ×100 at entry — one consistent scale for matching, variance and
 * FX; H-9's linear FX math is scale-invariant, so ¥ and $ conversions are true).
 * Formatting converts per-currency ONLY at the boundary:
 *   - zero-decimal currencies (JPY/KRW/VND/…) -> whole units ("500", not "500.00");
 *   - everyone else -> cents ("43.50").
 * Outbound API strings and human-readable text share this single formatter.
 * The web grid needs no change: its Intl `style: currency` formatter already knows
 * each currency's digit count.
 */

export const ZERO_DECIMAL_CURRENCIES = new Set([
	"BIF",
	"CLP",
	"DJF",
	"GNF",
	"ISK",
	"JPY",
	"KMF",
	"KRW",
	"PYG",
	"RWF",
	"UGX",
	"VND",
	"VUV",
	"XAF",
	"XOF",
	"XPF",
]);

export function minorDigits(currency?: string): 0 | 2 {
	return currency && ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
		? 0
		: 2;
}

/** minor (pseudo-cent) units -> decimal string: "43.50" for USD, "500" for JPY. */
export function formatMinorUnits(minor: number, currency?: string): string {
	return minorDigits(currency) === 0
		? String(Math.round(minor / 100))
		: (minor / 100).toFixed(2);
}
