# Evidence — stage 100 ★ (phase criterion: "two agents pay each other", 45 s video)

Date: 2026-10-30 (plan date 07.11 — early)

## Marker: reproducible in the demo, video proof 45 s — PASS

**Video:** evidence/2026-10-30-stage100-module-a-demo.mp4 — **41.1 s**, 1.0 MB,
1920x1200, recorded from a real xterm run (x11grab, the stages-56/73 method).
Captured content: negotiation rounds (buyer $400 -> seller $450 -> buyer "Deal …
We accept"), SETTLED at $450.00, contract CNT-… [VALID], PayPal invoice INV2-…
$450.00 sent, payment recorded -> MARKED_AS_PAID, both agents' confirmations.

**Reproducible:** the video records ONE run of the script itself —
```
npm run demo        # = scripts/stage100-demo.ts (also: npm run stage100)
```
The demo prints the full Module A story with pacing pauses:
1. two LLM agents negotiate (3 rounds, guardrails $460/$450),
2. contract JSON built + validated,
3. seller agent creates & sends the real PayPal invoice,
4. buyer agent pays (guarded record-payment) -> invoice MARKED_AS_PAID,
5. confirmations delivered to BOTH agents (shared log; both views read back).
Exit code 0 = "two agents paid each other: PROVEN"; last verified run: DONE in 30.2 s
(script) inside the 41.1 s video (xterm + npm startup + closing pause).

## Verification trail (same pipeline as stages 94–98)
- negotiate(): 3 rounds -> SETTLED $450.00 (LLM wording, clamped numbers).
- buildContract(): CNT-20261030-…, net 7 days, [VALID] (stage-95 validator).
- createInvoiceFromContract(): INV2-… via the guarded core shell (audit PASS).
- recordExternalPayment(): invoice MARKED_AS_PAID on PayPal (verified via get_invoice).
- confirmPaymentToAgents(): buyer + seller messages; readAgentView: 1 msg each.

## Notes
- The video shows the CONSOLE demo (deterministic, capturable on the local X
  display); the browser window (stage 99, /negotiation) is the interactive twin of
  the same pipeline and can be added to the final <3-min video later.
- The recording briefly put an xterm on the user's desktop (~45 s) — the accepted
  trade-off of the x11grab method.
