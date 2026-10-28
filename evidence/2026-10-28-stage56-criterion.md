# Evidence — stage 56 ★ (phase criterion: zero-touch PayPal core + video proof)

Date: 2026-10-28 (plan date 02.11 — early)

## Marker: 60s video, E2E without touching the keyboard — PASS
- Video: evidence/2026-10-28-stage56-zero-touch.mp4
  h264, 1516x776, duration 27.1s (<=60s), 448 KB
- Content: xterm window running `npm run stage56` end-to-end:
  create #NNNN $63.33 -> send -> record payment -> PayPal fires INVOICE.PAID
  -> payments row (webhook) -> reconciliation MATCHED variance 0
  -> "STAGE 56 OK: zero-touch core run PASSED"
- ZERO human input after start (no keyboard/mouse): all steps scripted;
  the earlier manual approve clicks are NOT part of this run.
- Capture: ffmpeg x11grab of the xterm window REGION only (privacy: no other
  windows on screen); -t 50 cap; run ended at ~22-25s.

## Key finding that made this possible
- record_payment_for_invoice (external CASH) ALSO fires INVOICING.INVOICE.PAID
  (verified earlier via EXTR reference) -> full chain can run unattended.
  External recordings land as status MARKED_AS_PAID (stage-45 semantics).

## Fixes caught before the video
1. createDraftInvoice helper did not accept invoice_number (stages 47/52/53 used
   raw execute) -> param added; runs now use a fresh time-based 4-digit number.
2. Criterion accepted PAID OR MARKED_AS_PAID (external recording semantics).
3. ffmpeg x11grab: offset goes into -i :0.0+X,Y (NOT into -video_size).
- Cold validation runs: 19.4s and 22.4s zero-touch PASS.
