# Evidence — stage 105 (first-run empty states: what to do with no data)

Date: 2026-10-30 (plan date 08.11 — early)

## Marker: "empty" screen with instructions — PASS (6/6, Playwright)

Screenshot: evidence/2026-10-30-stage105-empty.png — the Ledger forced into a true
first-run state (web restarted with INTERNAL_API_URL -> local mock returning
`{rows:[]}`; environment restored and re-verified after the test).

| Check | Result |
|---|---|
| empty screen renders (`section[aria-label="Empty ledger"]`) | OK |
| headline asks about first run | OK |
| instruction 1: `npm run demo` (fills the ledger in seconds) | OK |
| instruction 2: webhook tunnel (`ngrok start ecwid-dev`) | OK |
| instruction 3: watch the Agent screen (audit trail) | OK |
| no grid rendered under the card | OK |
| **MARKER_EMPTY_INSTRUCTION** | **PASS** |

## Implementation
- web DataGrid empty state upgraded (stage 88's friendly card → stage 105's
  instructional card): headline "The ledger is empty — first run?" + a numbered
  how-to (demo command / sandbox webhooks via tunnel / Agent screen) + a note that
  rows appear without a refresh once the first webhook arrives.
- Agent screen's empty row now also names the concrete first step
  (`npm run demo`) instead of a generic sentence.

## Recovery check
- After the test: mock removed, web restarted against the real agent API —
  SSR shows the real rows again (QA-P1 present), /agent -> 200.
