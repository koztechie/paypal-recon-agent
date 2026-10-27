# Evidence — stage 36 (webhook tunnel)

Date: 2026-10-27 (UTC+3 evening)
Tool: ngrok (pre-installed, authtoken configured: Valid configuration)
Command: ngrok http 3000

## Marker: public URL -> local server
- Public URL: https://uncorrupted-aubrielle-unhatingly.ngrok-free.dev
- GET $URL/health -> HTTP 200 {"status":"ok",...} (proxied to npm run dev on :3000)  PASS

## Notes
- URL saved to .env.local as BASE_URL (needed for stage 37 webhook registration).
- ngrok-free URL IS EPHEMERAL: restart => new URL => re-register webhook (stage 37).
- Caveat: ngrok free tier shows a browser warning (interstitial) page. Server-to-server
  webhook POSTs typically bypass it; if stage 38 gets blocked, fallback ready:
  cloudflared quick tunnel (installed, no warning page):
  cloudflared tunnel --url http://localhost:3000
