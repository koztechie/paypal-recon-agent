/**
 * Prompt registry (stage 60): system prompts live as VERSIONED markdown files
 * in src/prompts/, loaded at startup. Changing a file = bump its version line
 * + record in DECISIONS.md (rule §2.9).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function loadPrompt(name: string): { version: string; text: string } {
	const raw = readFileSync(join(here, "prompts", name), "utf8");
	const versionMatch = raw.match(/^#\s.*?—\s(v[\d.]+)\s\(([\d-]+)\)/m);
	return {
		version: versionMatch?.[1] ?? "unversioned",
		text: raw.replace(/^#.*?\n(\s*#\s.*\n)*/m, (m) => m), // keep full text (comments are context)
	};
}

const agent = loadPrompt("agent.system.md");

/** System prompt of the reconciliation agent (v1.0). */
export const AGENT_SYSTEM_PROMPT = agent.text;
export const AGENT_PROMPT_VERSION = agent.version;
