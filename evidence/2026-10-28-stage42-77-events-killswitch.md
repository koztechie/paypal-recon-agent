# Evidence — stage 42 (auto-reminder event finally arrived) + stage 77 ★

Date: 2026-10-28

## Stage 42 CLOSED: AUTOMATIC-REMINDER-SENT received
- Event: WH-8VG16137XB9439610-4LE164705S6546947
- received_at: 2026-10-28T14:00:48Z (PayPal's daily batch ran at 14:00 UTC)
- Invoice: INV2-ZKMY-MVK3-AEMZ-QKP4 (#0007) — the original stage-42 test subject
- Path: PayPal -> ngrok -> POST /webhook -> logs/webhooks.ndjson (+ DB row)
- Full marker met: manual reminder (204) + auto-reminder EVENT in the log.
- Note: the 12h/36h background watchers died without writing their done-files
  (orphan processes); the event was found by direct grep. Lesson: watchers must
  re-verify on every session touch rather than being trusted blindly.
- Backup invoice INV2-R7BT (due 02.11) left unpaid & untouched (redundant now;
  cancel is human-only anyway).

## Stage 77 ★: Kill-switch AI — NOT APPLIED
- Status: AI chain EXISTS and is proven: function calling (61), agent decisions
  executing PayPal actions (65), R2 video DRAFT->SENT (73), explanations (63),
  classification (62), rule-based fallback when LLM is down (72).
- Decision: Kill-switch 2.4 NOT triggered; no simplification needed.
- Control date 05.11 -> satisfied with evidence from 28.10 (-7 days).
