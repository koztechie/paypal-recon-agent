# Evidence — stage 104 (navigation: Dashboard / Agent / Settings — 3 screens)

Date: 2026-10-30 (plan date 08.11 — early)

## Marker: all three navigate — PASS (7/7, Playwright at 1280x900)

Screenshots: `2026-10-30-stage104-agent.png`, `2026-10-30-stage104-settings.png`.

| Check | Result |
|---|---|
| Dashboard tab active on /reconciliation | OK |
| → Agent: audit table renders (real agent_actions rows) | OK |
| Agent screen shows the LLM model (gemini / gemini-3.5-flash-lite) | OK |
| Agent tab active | OK |
| → Settings: guardrail limits visible ($500, …) | OK |
| Settings tab active | OK |
| → back to Dashboard: grid rows visible | OK |
| **MARKER_NAV_3_SCREENS** | **PASS** |

## What the three screens are (all real data, no mock)
1. **Dashboard (grid)** = `/reconciliation` — the working Ledger (stages 79–91).
2. **Agent** (`web/app/agent/page.tsx`) — runtime + append-only audit trail:
   stats cards (Actions logged / Executed / Blocked by guardrails / model) and the
   last 20 `agent_actions` rows with PASS/BLOCKED chips (the stage-98 BLOCKED refusal
   row is visible in the screenshot — evidence the trail is live, not staged).
   Data: new `GET /api/agent-summary` on the agent server.
3. **Settings** (`web/app/settings/page.tsx`) — read-only configuration the agent
   actually runs with: mode sandbox, LLM provider/model + fallback, guardrail limits
   ($500 invoice limit, 1/24h & 3-lifetime reminders, max 10 rounds, 14 s NL deadline),
   net-7 default. Source: new `GET /api/app-config` (facts only, **no secrets**).

## Implementation
- `web/app/components/top-nav.tsx` (client, usePathname, aria-current active state) —
  rendered by EndpointPage (so every endpoint page shares it) and by /agent + /settings.
- New endpoints GET /api/agent-summary, GET /api/app-config (CORS, no secrets in
  either payload).
