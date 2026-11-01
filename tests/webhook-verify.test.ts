// Webhook signature verification (finding C-1): every inbound PayPal event must be
// checked against /v1/notifications/verify-webhook-signature before it is trusted.
// The module is dependency-injected (fetch), so these tests are hermetic.
import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPaypalWebhook } from "../src/webhook-verify.ts";

process.env.PAYPAL_CLIENT_ID = "TEST-CID";
process.env.PAYPAL_CLIENT_SECRET = "TEST-SECRET";

const HEADERS = {
	"paypal-auth-algo": "SHA256withRSA",
	"paypal-cert-url":
		"https://api-m.sandbox.paypal.com/v1/notifications/cert/SB_SERVER",
	"paypal-transmission-id": "0e7d6d1c-8f5e-4b9a-9c8f-1a2b3c4d5e6f",
	"paypal-transmission-sig": "MEUCIQDx...forged...",
	"paypal-transmission-time": "2026-11-01T08:00:00Z",
};
const BODY = { id: "WH-123", event_type: "INVOICING.INVOICE.PAID" };

type Call = { url: string; init: RequestInit };
function makeFetch(
	verifyJson: unknown,
	opts: { throw?: boolean; verifyStatus?: number } = {},
) {
	const calls: Call[] = [];
	const impl = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url = String(input);
		calls.push({ url, init: init ?? {} });
		if (opts.throw) throw new TypeError("fetch failed (network)");
		if (url.includes("/v1/oauth2/token")) {
			return new Response(
				JSON.stringify({ access_token: "TEST-TOKEN", expires_in: 32400 }),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		return new Response(JSON.stringify(verifyJson), {
			status: opts.verifyStatus ?? 200,
			headers: { "Content-Type": "application/json" },
		});
	};
	return { impl: impl as unknown as typeof fetch, calls };
}

test("SUCCESS: valid signature -> ok, correct verify payload, Basic auth on the token", async () => {
	const { impl, calls } = makeFetch({ verification_status: "SUCCESS" });
	const out = await verifyPaypalWebhook(HEADERS, BODY, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.deepEqual(out, { ok: true, reason: "success" });

	const tokenCall = calls.find((c) => c.url.includes("/v1/oauth2/token"));
	assert.ok(tokenCall, "token call happened");
	const expectedBasic = `Basic ${Buffer.from("TEST-CID:TEST-SECRET").toString("base64")}`;
	assert.equal(
		(tokenCall.init.headers as Record<string, string>).Authorization,
		expectedBasic,
	);
	const verifyCall = calls.find((c) =>
		c.url.includes("/v1/notifications/verify-webhook-signature"),
	);
	assert.ok(verifyCall, "verify call happened");
	assert.equal(
		(verifyCall.init.headers as Record<string, string>).Authorization,
		"Bearer TEST-TOKEN",
	);
	const payload = JSON.parse(String(verifyCall.init.body)) as Record<
		string,
		unknown
	>;
	assert.equal(payload.webhook_id, "WEBHOOK-ID-1");
	assert.equal(payload.auth_algo, HEADERS["paypal-auth-algo"]);
	assert.equal(payload.cert_url, HEADERS["paypal-cert-url"]);
	assert.equal(payload.transmission_id, HEADERS["paypal-transmission-id"]);
	assert.equal(payload.transmission_sig, HEADERS["paypal-transmission-sig"]);
	assert.equal(payload.transmission_time, HEADERS["paypal-transmission-time"]);
	assert.deepEqual(
		payload.webhook_event,
		BODY,
		"event passed through unchanged",
	);
	assert.ok(!("headers" in payload), "legacy headers[] shape is gone");
});

test("FAILURE status from PayPal -> not ok", async () => {
	const { impl } = makeFetch({ verification_status: "FAILURE" });
	const out = await verifyPaypalWebhook(HEADERS, BODY, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.deepEqual(out, { ok: false, reason: "failure-status" });
});

test("missing signature headers -> not ok and NO network calls", async () => {
	const { impl, calls } = makeFetch({ verification_status: "SUCCESS" });
	const { "paypal-transmission-sig": _drop, ...rest } = HEADERS;
	const out = await verifyPaypalWebhook(rest, BODY, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.deepEqual(out, { ok: false, reason: "missing-headers" });
	assert.equal(
		calls.length,
		0,
		"no token/verify call without complete headers",
	);
});

test("non-200 verify response -> not ok (fail-closed)", async () => {
	const { impl } = makeFetch(
		{ message: "unauthorized" },
		{ verifyStatus: 401 },
	);
	const out = await verifyPaypalWebhook(HEADERS, BODY, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.deepEqual(out, { ok: false, reason: "failure-status" });
});

test("transport error -> not ok (fail-closed; PayPal retries non-2xx)", async () => {
	const { impl } = makeFetch(null, { throw: true });
	const out = await verifyPaypalWebhook(HEADERS, BODY, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.deepEqual(out, { ok: false, reason: "transport-error" });
});

test("missing body still verifies with an empty event object (no throw)", async () => {
	const { impl, calls } = makeFetch({ verification_status: "SUCCESS" });
	const out = await verifyPaypalWebhook(HEADERS, {}, "WEBHOOK-ID-1", {
		fetchImpl: impl,
	});
	assert.equal(out.ok, true);
	const payload = JSON.parse(
		String(
			calls.find((c) => c.url.includes("verify-webhook-signature"))?.init.body,
		),
	) as Record<string, unknown>;
	assert.deepEqual(
		payload.webhook_event,
		{},
		"empty body -> empty event object",
	);
});
