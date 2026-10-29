# Evidence — stage 99 (UI minimum: negotiation window, 2 columns + "settled" button)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: the window works — PASS (8/8, Playwright at 1280x900)

Screenshots:
- `2026-10-29-stage99-1-negotiating.png` — both columns filled, Settled button armed
- `2026-10-29-stage99-2-settled-contract.png` — locked state + contract card
  (Contract CNT-…, total $450.00 / unit $45.00, net_days 7 days, buyer email, summary)

| Check | Result |
|---|---|
| window opens (/negotiation, "Negotiation window") | OK |
| Settled button disabled before a run | OK |
| buyer column shows offers (R1 $400.00, R3 accepts $450.00) | OK |
| seller column shows counter (R2 $450.00) | OK |
| Settled button enabled with the price ("Settled — $450.00") | OK |
| contract card total $450.00 | OK |
| contract terms net_days 7 | OK |
| button reads "Settled ✓" after locking | OK |
| **MARKER_WINDOW_WORKS** | **PASS** |

## Implementation
- src/server.ts: `POST /api/negotiate` — runs the SAME `negotiate()` (stage 94) with
  the demo config and, on settlement, builds the validated contract via
  `buildContract()` (stage 95); returns `{ rounds, settled, agreedMinor, contract }`.
  (Found & fixed: the handler body initially used `await` inside the synchronous
  request callback — `node --watch` refused to boot with ERR_INVALID_TYPESCRIPT_SYNTAX
  while `tsc` stayed green; wrapped in the standard async `req.on("end")` pattern.)
- web/app/api/negotiate/route.ts (proxy,60 s timeout).
- web/app/negotiation/page.tsx (client): "Run negotiation" → rounds revealed one by
  one into the TWO columns (buyer left / seller right) → "Settled — $450.00" button
  (disabled until settlement, stage-98 limits visible in the header) → clicking locks
  the agreement and reveals the contract card. aria-live status line throughout.
- Test: /tmp/pw91/stage99-window.js (Playwright, chromium, viewport 1280x900).

## Incident (honest log)
- `pkill -f "<pattern>"` matched the invoking shell's own command line and killed the
  stage's shell mid-run (classic self-match footgun) — recovered with PID-based kill.
- Direct endpoint smoke test: HTTP 200 in 4.0 s (3 rounds, settled $450, contract
  CNT-20261029-eeb30d).
