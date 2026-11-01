// H-3: reconciliation and the reminder agent must see EVERY invoice, not page 1.
// The sandbox already holds75 (the cap was20) — payments whose invoice sat beyond
// page1 were false UNMATCHED. The pager stops on total_pages, on a short page, and
// hard-caps so a lying API can never hang the product.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ToolkitTools } from "../src/paypal.ts";
import { listAllInvoices } from "../src/paypal.ts";

function mockTool(
	pages: Array<Array<Record<string, unknown>>>,
	opts: { totalPages?: number } = {},
) {
	const calls: Array<{ page: number }> = [];
	const tools = {
		list_invoices: {
			execute: async (a: unknown) => {
				const args = a as { page?: number };
				const page = args.page ?? 1;
				calls.push({ page });
				const items = pages[page - 1] ?? [];
				const payload: Record<string, unknown> = { items };
				if (opts.totalPages !== undefined)
					payload.total_pages = opts.totalPages;
				return JSON.stringify(payload);
			},
		},
	} as unknown as ToolkitTools;
	return { tools, calls };
}

const N = (i: number) => ({ id: `INV${i}` });

test("H-3a: total_pages drives the loop — every page is fetched", async () => {
	const { tools, calls } = mockTool([[N(1), N(2)], [N(3), N(4)], [N(5)]], {
		totalPages: 3,
	});
	const items = await listAllInvoices(tools, 2);
	assert.equal(calls.length, 3, "all3 pages requested");
	assert.equal(items.length, 5);
	assert.deepEqual(
		items.map((i) => i.id),
		["INV1", "INV2", "INV3", "INV4", "INV5"],
	);
});

test("H-3b: without total_pages a short page ends the loop", async () => {
	const { tools, calls } = mockTool([[N(1), N(2)], [N(3), N(4)], [N(5)]]);
	const items = await listAllInvoices(tools, 2);
	assert.equal(calls.length, 3, "stops on the short page");
	assert.equal(items.length, 5);
});

test("H-3c: empty first page -> one call, no items", async () => {
	const { tools, calls } = mockTool([[]]);
	const items = await listAllInvoices(tools, 2);
	assert.equal(calls.length, 1);
	assert.equal(items.length, 0);
});

test("H-3d: a never-ending full-page API hits the hard cap and terminates", async () => {
	const endless = {
		list_invoices: {
			execute: async (a: unknown) =>
				JSON.stringify({
					items: Array.from({ length: 10 }, (_, i) => N(i)),
					// no total_pages, always a full page
				}),
		},
	} as unknown as ToolkitTools;
	const items = await listAllInvoices(endless, 10);
	assert.equal(
		items.length,
		500,
		"exactly MAX_PAGES * pageSize — no infinite loop",
	);
});
