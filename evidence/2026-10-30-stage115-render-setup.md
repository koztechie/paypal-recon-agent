# Evidence — stage 115 ★ (Render service from repo + $50 credits)

Date: 2026-10-30 (plan date 09.11 — early)

## Marker: service created; credits credited — **PARTIAL: repo side DONE, account side = manual action required**

### Done by me (automatable part)
- **`render.yaml` blueprint committed** (repo root): web service `paypal-recon-agent`,
  Node, plan free, region frankfurt, repo `github.com/koztechie/paypal-recon-agent`,
  branch main, build `npm ci`, start `npm run start`, **healthCheckPath `/health`**
  (stage-117 marker target), NODE_VERSION 22, non-secret env defaults
  (PAYPAL_ENVIRONMENT/LLM_*), secrets declared with `sync:false`
  (PAYPAL_CLIENT_ID/SECRET, LLM_API_KEY, BASE_URL — filled in stage 116).
- **Boot proof on a clean port** (exactly what Render runs, no local assumptions):
  `PORT=3996 npm run start` → `/health -> 200`, `GET /api/recon/rows?count=1 ->
  {"count":144}`, log contains "listening". `data/` is auto-created by `db.ts`
  (`mkdirSync recursive`), `schema.sql` read from the service root cwd — both safe
  on Render.
- YAML parsed programmatically (service name/runtime/plan/health/8 env keys).

### NOT doable by me — account, credits, service creation (browser + user identity)
**Manual instruction (follow exactly):**

**A. Отримати $50 Render credits (спонсорська вимога):**
1. Відкрий у браузері (краще приватне вікно):
   `https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon`
   (джерело: DECISIONS.md, спонсорські вимоги, `/details/render`).
2. Якщо не залогінений у Render — натисни **Sign up** або **Log in** → рекомендовано
   **Continue with GitHub** (той самий акаунт, що й `koztechie`, щоб усе було разом).
3. Після логіну портал має показати сторінку клейму з текстом на кшталт
   **"$50 credits — PayPal AI Hackathon"** → натисни **Claim** / **Accept**.
4. **Верифікація клейму:** Render Dashboard → ліворуч **Account Settings → Billing**
   (або головна сторінка Billing): у балансі/credits має з'явитися
   **+$50.00 (PayPal AI Hackathon)**. Якщо портал кинув тебе просто в Dashboard без
   сторінки клейму — повтори посилання з кроку1 ще раз у тому ж приватному вікні.
5. Зроби скріншот секції Billing із видимим $50 і поклади у
   `evidence/2026-11-09-stage115-render-credits.png` (я підхоплю його в evidence).

**B. Створити сервіс із репозиторію (Blueprint):**
1. Render Dashboard → кнопка **New +** (праворуч вгорі) → **Blueprint**.
2. Підключи акаунт GitHub → вибери репозиторій **`koztechie/paypal-recon-agent`** →
   **Connect**. Render знайде `render.yaml` → покаже сервіс `paypal-recon-agent`
   (web service, free, frankfurt, health `/health`) → натисни **Apply**.
3. Дочекайся першого деплою: статус сервісу **Live** (зелений) — збірка `npm ci`,
   старт `npm run start`. Посилання сервісу набуде вигляду
   `https://paypal-recon-agent-<random>.onrender.com` — **запиши його** (потрібно в
   етапі116 для `BASE_URL` і в етапі118 для PayPal webhooks).
4. Перевірка маркера сервісу: `curl https://<app-url>/health` → `200` — якщо200,
   частину «Сервіс створено» можна вважати закритою (остаточно підтвердить етап117).

**C. Готуй секрети для етапу116** (ставитимемо в Dashboard → сервіс → Environment →
**Add Environment Variable**, усі з `sync:false` уже заявлені в render.yaml):
`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `LLM_API_KEY`, `BASE_URL`
(= крок B3). Значення — ті самі, що в локальному `.env.local` (PayPal sandbox app
`hackathon-recon-agent`, ключ Gemini). Якщо зручніше — надай мені доступ-сценарій,
але секрети традиційно вводить власник акаунта.

## Status decision
- Plan row115 will be marked **⏳ ЧЕКАЄ НА ДІЇ КОРИСТУВАЧА** (не DONE): маркер має
  дві складові, обидві — у браузері користувача. Після виконання кроків A+B я
  перевірю `/health` по публічному URL (етап117) і закрию115.

## Attempt log (2026-10-30, user)
- First claim attempt from the browser failed on the portal page (logged in as
  koztechie@proton.me): **"Could not issue code — Origin not allowed"** (red status
  box, "Try again" gives the same result).
- Verified: the claim URL is exactly the official one from Devpost
  (`https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon`, href confirmed
  on paypalaihackathon.devpost.com/details/render) — the link is NOT the problem.
- Diagnosis: the portal validates the HTTP Origin of the code-issue request; the
  failure means the browser (or an extension/proxy/webview) sent a missing/altered
  Origin. Not documented anywhere public — environmental/portal-side.
- Troubleshooting ladder issued to the user (clean Chrome profile → normal window →
  privacy/translate extensions off → cookies → sign out/in). Official support paths
  per the sponsor page: Render Discord (https://render.com/discord), PayPal Discord,
  or devrel+credits@render.com (address shown on the failing page itself).

## Credits outreach — full state (2026-10-30, continued)
1. Email to devrel+credits@render.com — SENT (user).
2. Render AI agent consulted: documented redemption path = **promo code at
   Billing → Credit Balance → Apply**; "Origin not allowed" not in docs;
   **hackathon credits are issued by the EVENT ORGANIZERS**, not by Render directly.
3. Render Support (Dashboard contact form / support@render.com) — message drafted,
   includes: portal fails at code-issue step, ask to coordinate a promo code with
   organizers or fix the portal; account identified by GitHub `koztechie`
   (no personal email in any public channel — user requirement).
4. Organizer outreach — Discord `#general-hackathon-question` message drafted
   (promo-code fallback request, cites Render's organizer-issued statement).
5. Verified public organizer channels for an existing code: Devpost Updates titles
   ("Two weeks to go…", "PayPal build session recording", "FAQs", "Live Build
   Session Oct 6") contain NO Render/promo mentions; Discussions/FAQs — nothing.
   No public promo code exists yet.
6. Parallel track (independent of credits): step B service creation via Blueprint —
   NOT started by the user yet.

## Update (2026-10-30, user): CREDITS RECEIVED ✅
- The user reports **$50 Render credits received on the account** — the sponsor
  requirement part of stage 115 is satisfied (resolution path: public Discord/email
  outreach as described above; the failing-claim incident closed).
- Outstanding: **service creation (step B)**. Probe of the plain host
  `https://paypal-recon-agent.onrender.com/health` returns 404 (Render edge, no such
  bare-host service) — either the service was not created yet, or it has the
  canonical `paypal-recon-agent-<hash>.onrender.com` URL, which the user must supply.
- Stage stays ⏳ until /health answers 200 on the public URL (that check also closes
  stage 117's marker).

## Stage 116 prep (2026-10-30)
- Audited `process.env.*` usage in src/: the service needs PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET, LLM_API_KEY (+ SANDBOX_BUYER_EMAIL used by /api/negotiate
  contracts); PORT comes from Render; PAYPAL_ENVIRONMENT/LLM_PROVIDER/LLM_MODEL/
  NODE_VERSION ship as blueprint defaults. BASE_URL is not read by src/ but is
  declared for humans/future webhook code.
- render.yaml updated: SANDBOX_BUYER_EMAIL added (sync:false) → 9 env keys, 5 secrets.
- Secret VALUES are deliberately NOT echoed anywhere (chat/git/screenshots) — the
  user copies them from their local .env.local into the Render dashboard directly.
- Manual instruction issued to the user (names + exact dashboard path + verification:
  their screenshot of the Environment tab + my functional LLM probe on the public URL).

## VERIFIED LIVE (2026-10-30): stage 115 + 117 closed
- Service created from the Blueprint (user): **paypal-recon-agent**, Node, Free,
  Service ID `srv-dbibg867bikc73amsdf0`, blueprint `exs-dbibe5flk1mc73fqnm30`,
  repo main @ `4a5f319`, deploy `dep-dbibg8e7bikc73amse50` → **Live** (17:30–17:32).
- **Public URL: `https://paypal-recon-agent.onrender.com`** (bare host was free).
- My probes against the public URL:
  | Probe | Result |
  |---|---|
  | `GET /health` | **200** `{"status":"ok","service":"paypal-reconciliation-agent"}` (stage-117 marker) |
  | `GET /api/app-config` | ok · mode sandbox · gemini / gemini-3.5-flash-lite · limits intact |
  | `POST /api/nl-filter "review payments"` | **`source: "llm", ms:1566`** — LLM_API_KEY works in prod (stage-116 functional proof) |
  | `GET /api/recon/rows?count=1` | `{"count":0}` — fresh production DB (expected on day one; the stage-105 first-run screen will show) |
- Remaining for stage 116: set `BASE_URL` in Environment to
  `https://paypal-recon-agent.onrender.com` (left empty on the deploy screen by
  design — value only exists after first deploy) + Environment-tab screenshot for
  evidence (masked values only).
- Note for stages 118–120: prod ledger starts EMPTY — plan the webhook/demo flow
  accordingly (the stage-105 empty screen instructs a first run).

## Stage 116 CLOSED (2026-10-30)
- User set `BASE_URL=https://paypal-recon-agent.onrender.com` (Environment → Save)
  and confirmed PAYPAL_CLIENT_ID/SECRET visually.
- Environment-tab screenshot (user, in-session) shows **all 9 keys filled with
  masked values**: BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_PROVIDER, NODE_VERSION,
  PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENVIRONMENT, SANDBOX_BUYER_EMAIL.
- Post-save probes (my independent re-check): `/health -> 200`;
  `POST /api/nl-filter` -> correct filter, `source: llm, 1169 ms`;
  `/api/app-config` -> sandbox / gemini gemini-3.5-flash-lite.
- Marker "all variables filled" = MET. PayPal creds' functional test deferred to
  stages 118–120 (first real PayPal call from prod), as planned.
- Optional artifact: if convenient, drop the Environment screenshot into
  `evidence/2026-11-09-stage116-render-env.png` (masked values only) — the in-session
  confirmation above is the primary record meanwhile.
