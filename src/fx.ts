/**
 * ECB reference-rate conversion for Rule 1's "$500 USD equivalent" promise
 * (finding H-9: SECURITY.md documented this but the code never did it).
 *
 * - Source: ECB daily reference rates (no key, no account) — eurofxref-daily.xml,
 *   EUR-base cross rates (USD minor = amountMinor * rateUSD / rateCurrency).
 * - Cached per process for 24h (the file updates once per business day).
 * - `usdMinorFrom` has a USD identity fast path that NEVER touches the network —
 *   the demo's overwhelmingly common case costs zero latency.
 * - Non-USD with no cached rate (not primed yet / ECB outage) -> `null`:
 *   the caller FAILS CLOSED (the documented "conversion failure → block").
 * Note: for zero-decimal currencies (JPY…) the legacy `dollarsToMinor`'s ×100 and
 * the unscaled per-unit rate cancel out — conversions land on the correct USD minor
 * value for both decimal and zero-decimal inputs (pinned by tests).
 */

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const TTL_MS = 24 * 60 * 60 * 1000;

export interface FxDeps {
	fetchImpl?: typeof fetch;
	now?: () => number;
}

let cache: { rates: Record<string, number>; at: number } | undefined;

/** Test-only: drop the process cache so hermetic suites start cold. */
export function resetFxCache(): void {
	cache = undefined;
}

export async function primeFxRates(deps: FxDeps = {}): Promise<boolean> {
	const now = deps.now ?? Date.now;
	if (cache && now() - cache.at < TTL_MS) return true;
	try {
		const res = await (deps.fetchImpl ?? fetch)(ECB_URL, {
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return false;
		const xml = await res.text();
		const rates: Record<string, number> = { EUR: 1 };
		for (const m of xml.matchAll(/currency='([A-Z]{3})'\s+rate='([\d.]+)'/g)) {
			const ccy = m[1];
			const rate = m[2];
			if (ccy && rate) rates[ccy] = Number(rate);
		}
		if (rates.USD === undefined || Object.keys(rates).length < 2) return false;
		cache = { rates, at: now() };
		return true;
	} catch {
		return false;
	}
}

export function usdMinorFrom(
	amountMinor: number,
	currency = "USD",
): number | null {
	if (currency === "USD") return amountMinor; // fast path: no cache, no network
	const rates = cache?.rates;
	const perEur = rates?.[currency];
	if (!rates?.USD || !perEur) return null; // unprimed / unknown -> fail-closed caller
	return Math.round(amountMinor * (rates.USD / perEur));
}
