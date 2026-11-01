/**
 * The product's log channel: **stdout/stderr** — the Render Logs tab in production,
 * the console locally (stage 122). Messages keep their structured [tag] prefixes.
 * Nothing else in `src/` calls console.* directly (stage 145 cleanup).
 */
export function logLine(...args: unknown[]): void {
	console.info(...args);
}

export function logError(...args: unknown[]): void {
	console.error(...args);
}
