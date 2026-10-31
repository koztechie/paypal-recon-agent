# Evidence — stage 141: README section «PayPal APIs used»

Date: 2026-10-31 · Marker: «Перелід у README» ✓ (`## PayPal APIs used`, right after «How AI is used»).

## Section contents (8 capabilities)
Invoicing core cycle · Webhooks (16 observed types) · Reporting transactions ·
Reporting balances · Catalog products · Billing plans · Orders (wired) ·
Disputes (read-only, accept = red list) + the two call surfaces
(agent Toolkit `src/paypal.ts` ↔ UI REST client `web/lib/paypal.ts`).

## Fact → code verification (scripted asserts in the commit run)

| Claim | Source of truth |
|---|---|
| Sandbox host `api-m.sandbox.paypal.com`, OAuth `grant_type=client_credentials` | `web/lib/paypal.ts:5,27,33` |
| `GET /v1/catalogs/products` (+fetch-by-id) | `web/lib/paypal.ts:117–118` (`listProducts`) |
| `GET /v1/billing/plans` | `:122–123` (`listPlans`) |
| `GET /v2/invoicing/invoices` (+fetch-by-id) | `:181–182` (`listInvoices`) |
| `GET /v1/reporting/transactions?start_date&end_date&fields=all` | `:210` (`searchTransactions`) |
| `GET /v1/reporting/balances` | `:222` (`getBalances`) |
| Webhook receiver `POST /webhook` → `webhook_events`, PAID → payments row | `src/server.ts:122–149` |
| **16 event types** observed in sandbox | `evidence/2026-10-30-stage118-webhook-prod.md` (all 16 tokens programmatically re-checked from the file: `INVOICING.INVOICE.*` ×8, `PAYMENT.CAPTURE.*` ×5, `CUSTOMER.DISPUTE.*` ×3) |
| Agent tools `create_invoice`, `send_invoice`, `record_payment_for_invoice`, `send_invoice_reminder` (+`get_invoice`, `list_invoices`) | `src/invoicing.ts` `tools.*` calls |
| Orders create/get/capture + `pay_order` dry-run | `src/paypal.ts` actions config; `src/dryrun.ts:21` |
| Disputes list/get wired, accept = human-only | `src/paypal.ts` (`// RED LIST: accept`) |

Scope: the AI-specific chain stays in «How AI is used» (stage140); this section is the
PayPal capability enumeration only. Language: English (`grep -P '[а-я…]' README` → 0).

## Marker: enumeration present + code-verified → stage141 DONE
