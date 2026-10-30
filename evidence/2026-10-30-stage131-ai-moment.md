# Evidence — stage 131 (the AI moment: LLM decides → PayPal acts, visible on screen)

Date: 2026-10-30 (plan date 10.11 — early)

## Marker: the moment is visible on screen — PASS

**File:** `evidence/2026-10-30-stage131-ai-moment.mp4` — **39.2 s,380 KB**, recorded in
the private Xvfb display (`:99`, the stage-130 method — no user windows reachable).

### What the viewer sees (verified frame-by-frame,1 fps /3 s strip)
1. Banner `=== AI MOMENT: LLM decides -> PayPal acts ===`;
2. **The decision (LLM):** `npm run stage94` prints the three live negotiation rounds —
   `BUYER R1 … $400.00 budget` → `SELLER R2 … final price $450.00` →
   `BUYER R3 "Deal — $450.00 total … We accept"` →
   **`Result: SETTLED at 450.00 USD after 3 rounds`**;
3. **The action (PayPal):** `npm run stage96` re-runs the agreement and then —
   `invoice INV2-… (E2E-…) amount=450.00 USD to sb-…` — the real sandbox invoice is
   created through the core shell, followed by its on-PayPal verification checks
   (`OK invoice exists on PayPal`, `OK amount == contract total`, …);
4. Closing line `=== THE MOMENT: decision above, PayPal invoice below ===`.

Decision and consequence are contiguous in ONE take — the marker's "LLM decides →
PayPal action" is literally on screen, in order.

## Method
- Same isolated pipeline as stage 130: `Xvfb :99` + `xterm` + single `x11grab`
  capture (PID-based process control — no `pkill -f`).
- Take script: banner → `npm run stage94` (the decision) → `npm run stage96`
  (contract → invoice → verification) → closing line; no cuts anywhere.
