# Evidence — stage 28 (AI API key live test)

Date: 2026-10-27 (UTC+3 evening)
Provider: Google AI Studio / Gemini API
Model: gemini-3.5-flash-lite (primary; config: LLM_PROVIDER / LLM_MODEL env vars)

## Free-tier rate limits (from AI Studio, project gen-lang-client-0797315388)
- gemini-3.5-flash-lite: RPM 15 / TPM 250K / RPD 500  <- primary
- gemini-3.8-flash:       RPM 5  / TPM 250K / RPD 20   <- reserved for video day (stage 134)
- gemini-3.1-flash-lite:  RPM 15 / TPM 250K / RPD 500  <- fallback 1
- (decision: gemini-2.0-flash was SHUT DOWN 2026-06-01; old recommendation corrected)

## Test 1 — plain generation
- POST /v1beta/models/gemini-3.5-flash-lite:generateContent -> HTTP 200
- Reply to "Reply with exactly: PONG-28" -> `PONG-28`  PASS

## Test 2 — function calling (critical for stage 61)
- HTTP 200; candidate part = functionCall
- Tool: send_invoice_reminder
- Args returned: {"invoice_id": "INV-1042", "message": "...10 days overdue..."}  PASS
- Note: response part carries `thoughtSignature` -> API callers must round-trip it
  on follow-up turns when tools are involved (see Gemini docs: thought signatures).
- Note: parser mistake during test: functionCall lives in candidates[0].content.parts[],
  not candidates[0].functionCall. Recorded to avoid re-work.

## Incidents during stage 28
1. .env.local quoting errors (password with `'` and `|`, `<` chars) broke `set -a` sourcing.
   Fixed: all values single-quoted; file chmod 600.
2. SANDBOX_BUSINESS_PASSWORD was accidentally dropped during the fix -> placeholder in file;
   RE-COPY from developer.paypal.com -> Sandbox -> Accounts (needed for stage 43).
3. Credentials (PayPal client id/secret, LLM key) were echoed into terminal tool output during
   debugging. Sandbox creds: low risk. LLM free-tier key: recommended to rotate after the
   hackathon (or now) via AI Studio -> API keys.

Conclusion: stage 28 marker met — "key works: test LLM request returned an answer".
