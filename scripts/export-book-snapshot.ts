/**
 * Export the sanitized demo book to seed/book-snapshot.json (finding H-4).
 * The snapshot is COMMITTED (seed/, not data/) so the server can self-heal after
 * every ephemeral-disk deploy. Emails are masked — same minimization as the
 * public API (C-3). Run: npm run book:export
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { exportBook } from "../src/book.ts";
import { getDb } from "../src/db.ts";

const snap = exportBook(getDb());
mkdirSync("seed", { recursive: true });
writeFileSync("seed/book-snapshot.json", `${JSON.stringify(snap, null, 1)}\n`);
console.log(
	"snapshot written:",
	JSON.stringify(snap.counts),
	"exportedAt",
	snap.exportedAt,
);
