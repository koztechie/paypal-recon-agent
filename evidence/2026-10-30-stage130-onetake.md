# Evidence — stage 130 (E2E demo recorded in ONE take, no splicing)

Date: 2026-10-30 (plan date 10.11 — early)

## Marker: one take, no cuts — PASS

**File:** `evidence/2026-10-30-stage130-e2e-onetake.mp4` — **49.1 s,636 KB,1920×1200**.
A SINGLE continuous ffmpeg capture of one xterm run — no stitching, no post-edits
(the only trim is the natural tail after the script prints its final line).

### What the take shows (verified frame-by-frame,1 fps /4 s strip)
1. Banner `E2E ONE TAKE — create → pay → reconcile (public URL)` → `[1/4] full demo`:
   negotiation rounds (SELLER R2 "$450.00 final price" → BUYER R3 "Deal — $450.00 …
   We accept") → SETTLED → contract `[VALID]` → invoice INV2-… sent → payment
   recorded → `[5/5] confirmations delivered to BOTH agents` (buyer/seller lines);
2. `[2/4] waiting for the INVOICE.PAID webhook to reach PRODUCTION` — poll lines until
   the event lands on the public API;
3. `[3/4] reconcile ON THE PUBLIC URL` → `{"ok":true,"reconciled":1,…}`;
4. `[4/4] final ledger via the public API` — rows with `recon=MATCHED` printed;
5. `=== ONE TAKE DONE — the cycle passed on the public URL ===`.

## Privacy incident & fix (honest log)
- Attempt1: a shell precedence bug (`VAR=… && cmd &` put the assignment in a
  background subshell) left the output path empty — ffmpeg failed, nothing recorded.
- Attempt2 (FULL-SCREEN capture of the live desktop): the user was actively working —
  the take captured **their own windows (Firefox, Telegram) instead of the demo**.
  **The file was deleted immediately and never committed** (no private content enters
  the repo or evidence); the take-strip derived from it was deleted too.
- Attempt3 (final): re-run in a **private Xvfb display (`:99`)** — the xterm and the
  capture live on a virtual framebuffer, so third-party windows are physically
  impossible to record. Verified by the strip: only our terminal is present.
- Also logged: my `pkill -f "Xvfb :99"` self-matched the invoking shell again
  (the stage-99 footgun recurring) — switched to PID-based kills.

## Method (reusable for the remaining recordings)
```
Xvfb :99 -screen 0 1920x1200x24 &
DISPLAY=:99 xterm -e "bash <take-script>; sleep 5" &
DISPLAY=:99 ffmpeg -f x11grab -video_size 1920x1200 -i :99.0 … out.mp4 &
wait xterm → kill ffmpeg → kill Xvfb (by PID)
```
The take script itself: `/tmp/stage130-take.sh` (demo → prod-poll → prod-recon →
final ledger). Prod side got re-seeded by this take's cycle (fresh rows visible).
