# Evidence — stage 103 ★ (homepage: what the judge sees in 5 s)

Date: 2026-10-30 (plan date 08.11 — early)

## The one homepage scenario (5-second path)

> A judge opens the app and must instantly answer: WHAT is this, WHY care, WHERE to
> click. One hero, one primary CTA — the Ledger (the working seller tool built in
> phases 5/7, stages 79–91). Everything else is below the fold.

## Sketch (before implementation)

```
┌───────────────────────────────────────────────────────────────────┐
│ PayPal sandbox · AG Grid + AG Studio · live data        (trust)   │
│                                                                   │
│ Cross-Border Reconciliation Agent                                 │
│ The seller's AI agent that reconciles every PayPal payment,       │
│ explains every mismatch, and acts — inside hard guardrails.       │
│                                                                   │
│ [ Open the Ledger → ]   ← PRIMARY CTA (5-second path)             │
│  Negotiation demo →   ·  AG Studio dashboard →       (secondary)  │
│                                                                   │
│ ( 139 live rows · AI explains mismatches · audited guardrails )   │
│                            (proof chips — credibility, not hype)  │
├───────────────────────────────────────────────────────────────────┤
│ below the fold: PayPal API surface (boilerplate pages, kept)      │
└───────────────────────────────────────────────────────────────────┘
```

Decision rules applied:
- ONE scenario: hero -> Ledger. The negotiation window (/negotiation) is secondary
  (module A); the dashboard and raw endpoints are exploration, not the path.
- CTA label names the destination ("Open the Ledger"), not "Learn more".
- Proof chips carry facts we can evidence (row count, AI explanations, audit trail),
  matching the no-hype honesty rules.

## Implementation
- web/app/page.tsx rewritten: hero (trust line, H1, one-liner, primary CTA ->
  /reconciliation, secondary -> /negotiation + /dashboard, proof chips), the
  boilerplate's endpoint index kept below the fold as "PayPal API surface".
- Screenshot: evidence/2026-10-30-stage103-home.png (matches the sketch).

## Verification (Playwright, viewport 1280x900) — MARKER_HOME_5S: PASS (6/6)
| Check | Result |
|---|---|
| hero H1 "Cross-Border Reconciliation Agent" present | OK |
| primary CTA visible above the fold (boundingBox.y < 900) | OK |
| trust line present | OK |
| proof chips present | OK |
| secondary link to /negotiation | OK |
| **CTA lands on /reconciliation with grid rows** | OK |

## Incident (honest log)
- First run: Ledger stayed empty — `localhost:3000` was DOWN (000; the dev server
  died silently between stages). Restarted (`npm run dev`), health+rows 200, test
  rerun green. Infra re-verification at session start remains mandatory.
