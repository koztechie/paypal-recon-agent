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
