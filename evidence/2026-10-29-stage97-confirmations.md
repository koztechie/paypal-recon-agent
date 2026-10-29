# Evidence — stage 97 (payment + confirmation for BOTH agents)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: both agents "see" the confirmation — PASS (6/6 checks)

Full pipeline in one run (`npm run stage97`):
```
invoice sent: INV2-THCU-ZWMW-3JR8-5VDZ (450.00 USD, CNT-20261029-a81413)
payment recorded -> invoice status: MARKED_AS_PAID

buyer sees:  "You paid $450.00 for invoice INV2-THCU-ZWMW-3JR8-5VDZ (contract
              CNT-20261029-a81413) — the seller's invoice now shows MARKED_AS_PAID."
seller sees: "Payment of $450.00 received for invoice INV2-THCU-ZWMW-3JR8-5VDZ (contract
              CNT-20261029-a81413) — invoice status MARKED_AS_PAID; funds recorded."
```
| Check | Result |
|---|---|
| invoice paid on PayPal (MARKED_AS_PAID via the guarded record-payment wrapper) | OK |
| buyer has the confirmation | OK |
| seller has the confirmation | OK |
| both messages mention the amount | OK |
| messages differ per agent (own perspective) | OK |
| same contract/invoice in both | OK |
| **MARKER_BOTH_AGENTS_CONFIRMED** | **PASS** |

## Implementation
- src/confirmation.ts (new): `confirmPaymentToAgents()` builds the TWO
  audience-specific messages (code-owned numbers/status), appends both to the shared
  append-only negotiation log `logs/negotiation-a.jsonl` — the state both agents read
  on their next turn, which is what makes the confirmation "seen" by BOTH.
  `readAgentView(agent, contractId)` reads one agent's view back (asserted in the run).
- scripts/stage97-confirm.ts (`npm run stage97`): negotiate -> contract -> invoice ->
  send -> record payment (real PayPal, audit-logged, `payment_date` now = today —
  fixed a hardcoded 2026-10-28 left in the stage-53 wrapper) -> confirm both -> assert.
- Local payments row is OPTIONAL in the run: `record_payment_for_invoice` does not
  emit INVOICE.PAID (consistent with stage 53); the webhook path is separately
  verified below.

## Incident: ngrok tunnel was OFFLINE — restored (same URL)
- Discovered while checking for the payment webhook: the registered tunnel answered
  with ngrok's ERR_NGROK_3200 "endpoint is offline" page (agent process dead —
  killed by the earlier /tmp wipe + server restarts, same class as the stage-80
  incident). Webhooks from PayPal were NOT reachable during stages 96–97 (which is
  why those invoices have no local rows).
- Restored: `ngrok start ecwid-dev` (config keeps the SAME stable domain
  `uncorrupted-aubrielle-unhatingly.ngrok-free.dev` -> PayPal's registered webhook
  URL stays valid, no re-registration needed).
- Verified end-to-end AFTER restore: `GET /health -> 200` through the tunnel, and a
  real `POST /webhook` through the tunnel -> `{"received":true}` + row
  `TEST-STAGE97-RECOVERY` in webhook_events (2026-10-29 19:03:47).
