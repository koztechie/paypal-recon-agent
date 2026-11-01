/**
 * Public-ledger data minimization — security finding C-3 (fixed 2026-11-01).
 * The book itself stays visible (it is a sandbox demo and the whole point of the
 * product), but personal data does not: EVENT rows no longer ship the raw webhook
 * payload (buyer emails live there), and any email that reaches a note is masked
 * to `ab…@domain` before it leaves the process.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function maskEmails(text: string): string {
	return text.replace(EMAIL, (m) => {
		const at = m.indexOf("@");
		const local = m.slice(0, at);
		const domain = m.slice(at);
		if (local.length <= 1) return `…${domain}`;
		return `${local.slice(0, 2)}…${domain}`;
	});
}
