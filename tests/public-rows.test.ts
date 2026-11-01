// C-3: the public ledger must not serve raw webhook payloads (they carry buyer
// emails) and must mask any email that leaks into a note.
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskEmails } from "../src/public-rows.ts";

test("plain email -> local part masked, domain kept", () => {
	assert.equal(
		maskEmails("Payment to sb1234567@personal.example.com matches"),
		"Payment to sb…@personal.example.com matches",
	);
});

test("multiple emails in one string are all masked", () => {
	const out = maskEmails("a@x.com and b@y.example and c@z.org");
	// single-char local parts become "…@…" — nothing of the mailbox leaks
	assert.equal(out, "…@x.com and …@y.example and …@z.org");
	assert.equal((out.match(/…@/g) ?? []).length, 3);
});

test("text without emails is unchanged (byte-identical)", () => {
	const s =
		"matches invoice #9001 exactly: number + amount (30.00) + currency (USD).";
	assert.equal(maskEmails(s), s);
});

test("already-masked email stays masked (idempotent)", () => {
	assert.equal(
		maskEmails("sb…@personal.example.com"),
		"sb…@personal.example.com",
	);
});

test("URLs and other colons are not corrupted", () => {
	assert.equal(
		maskEmails("see https://example.com/a?b=1 or mail me: user@host.example"),
		"see https://example.com/a?b=1 or mail me: us…@host.example",
	);
});
