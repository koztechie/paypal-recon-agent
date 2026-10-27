import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";

async function probeHealth(port: number, tries = 40): Promise<Response> {
	let lastErr: unknown;
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(`http://localhost:${port}/health`);
			if (res.ok) return res;
			lastErr = new Error(`status ${res.status}`);
		} catch (e) {
			lastErr = e;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw lastErr instanceof Error ? lastErr : new Error("health probe failed");
}

test("server starts and /health returns 200", async () => {
	const port = 3999;
	const child = spawn(process.execPath, ["src/server.ts"], {
		env: { ...process.env, PORT: String(port) },
		stdio: "ignore",
	});
	try {
		const res = await probeHealth(port);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { status: string };
		assert.equal(body.status, "ok");
	} finally {
		child.kill("SIGTERM");
		await once(child, "exit").catch(() => undefined);
	}
});
