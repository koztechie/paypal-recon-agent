// C-3: CORS is an explicit allowlist — same-origin by default, dev origins out of
// the box, `CORS_ORIGINS` for anything else. Wildcard is gone: a foreign site can
// neither read responses nor pass preflight.
import assert from "node:assert/strict";
import { test } from "node:test";
import { corsHeadersFor } from "../src/cors.ts";

const ALLOW = ["http://localhost:3001"];

test("no Origin header (curl / same-origin GET / server-to-server) -> no CORS headers", () => {
	assert.equal(corsHeadersFor(undefined, "localhost:3000", ALLOW), null);
});

test("same-origin (Origin host equals Host) -> allowed, origin echoed", () => {
	const out = corsHeadersFor(
		"https://paypal-recon-agent.onrender.com",
		"paypal-recon-agent.onrender.com",
		ALLOW,
	);
	assert.deepEqual(out, {
		"Access-Control-Allow-Origin": "https://paypal-recon-agent.onrender.com",
		Vary: "Origin",
	});
});

test("allowlisted dev origin -> allowed", () => {
	const out = corsHeadersFor("http://localhost:3001", "localhost:3000", ALLOW);
	assert.equal(out?.["Access-Control-Allow-Origin"], "http://localhost:3001");
});

test("foreign origin -> NO CORS headers (browser cannot read the response)", () => {
	assert.equal(
		corsHeadersFor("https://evil.example", "localhost:3000", ALLOW),
		null,
	);
});

test("lookalike origin (localhost.evil.com) -> denied", () => {
	assert.equal(
		corsHeadersFor("http://localhost:3001.evil.com", "localhost:3000", ALLOW),
		null,
	);
});

test("empty allowlist -> only same-origin passes", () => {
	assert.equal(
		corsHeadersFor("http://localhost:3001", "localhost:3000", []),
		null,
	);
});
