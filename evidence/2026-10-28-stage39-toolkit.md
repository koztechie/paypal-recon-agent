# Evidence — stage 39 ★ (Agent Toolkit + APIMatic plugin)

Date: 2026-10-28 (early morning, plan date was 31.10)

## Part 1: PayPal Agent Toolkit
- Installed: @paypal/agent-toolkit v1.11.0 (+ ai package for Tool types).
- src/paypal.ts: createPaypalToolkit() with guardrail whitelist (SECURITY.md rule 2):
  - invoices: create/list/get/send/sendReminder/search/update/generateInvoiceNumber/
    cancelReminders/createConditionalRules/recordPayment
  - orders: create/get/capture (pay_order)
  - transactions: list
  - disputes: list/get
  - DISABLED (red list): recordRefund, cancel, delete, createRefund, accept_dispute_claim;
    out of scope: products, shipment, subscriptions, subscriptionPlans.
- scripts/toolkit-test.ts (npm run toolkit:test): lists 17 tools and EXECUTES
  list_invoices against sandbox -> returned invoice INV2-HMRF-4JVX-WRNZ-287Y.
  "TOOLKIT TEST OK"  PASS

## Toolkit facts learned (source-inspected, saved to avoid re-work)
- Exact config action keys: orders.pay = `capture`; pay_order tool; accept_dispute_claim
  is gated by `disputes.create`; get_merchant_insights is gated by `insights.get` AND
  THROWS in sandbox ("not supported in sandbox") -> daily summary (stage 66) must use
  list_transactions.
- Toolkit debug logging available via context.debug.

## Part 2: APIMatic Context Plugin (sponsor requirement, DECISIONS stage 12)
- Tool: npx context-plugins install paypal (APIMatic ContextMatic marketplace).
- Target: VS Code (codex/claude/cursor NOT installed on this machine).
- Installed -> ~/.context-plugins/vscode/paypal (916K), registered in
  ~/.config/Code/User/settings.json (chat.pluginLocations). Timestamp: 2026-10-28T06:33:27Z.
- Content: APIMatic-generated PayPal Server SDK skills (TypeScript/dotnet/python),
  grounded in SDK source: authentication, calling endpoints, models, error handling,
  testing -> usable as reference during stages 40-58; documented for R7/stage 141.

## Incidents
- First push failed: "could not read Username for https://github.com" — git credential
  helper chain broken (empty helper entry). Fixed via `gh auth setup-git`; push 5d7befa OK.
- Lint scope extended: scripts/ added to `npm run lint`.

## CI
- Push 5d7befa -> lint + tsc + tests: success.
