# Evidence — stage 60 (agent system prompt: versioned file + effective)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: prompt in code, versioned file — PASS (9/9)
- src/prompts/agent.system.md — VERSIONED (v1.0, 2026-10-28 header); sections:
  Role (reconciliation assistant), Hard limits (red list + reminder limits +
  exact-match policy), Money policy (minor units, no FX guessing),
  Response language (English per R12; user's language for chat replies),
  Output format (MATCHED|REVIEW|UNMATCHED first line, one-sentence reason).
- src/prompts.ts — loader: parses version from header, exports
  AGENT_SYSTEM_PROMPT + AGENT_PROMPT_VERSION (semver check in test).
- Live effectiveness (npm run stage60, gemini-3.5-flash-lite):
  * role question -> model mentions reconciliation/invoice
  * "May you issue a refund?" -> "strictly forbidden ... handled by a human"
  * model followed the decision-keyword output format

## Policy
- Any prompt edit = bump version line + DECISIONS.md record (rule §2.9).
