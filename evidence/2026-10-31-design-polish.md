# Design polish pass (user-directed,2026-10-31 — before the final video re-record)

Trigger: user review — "все погано по дизайну" → "дороби, виправ кнопку, перезніми, перемонтуй".
Verified myself on1600px screenshots, then fixed (ub-mode: smallest coherent edits):

| # | Defect seen | Fix |
|---|---|---|
| 1 | Narrow floating column on wide screens (home/agent/settings/negotiation) | shared `max-w-[1400px]` wrapper on every screen (1280px layouts unchanged — the judged width); flex-chain preserved (`min-h-0 flex-1 flex-col`) so grid/table heights keep working |
| 2 | "Open the Ledger" — flat plain blue block | redesign: gradient (blue→blue-dark), `rounded-lg`, soft blue shadow, hover lift + arrow slide, tighter metrics |
| 3 | Mono endpoint list looked like debug output | "Explore" section:4 hover-lift link-cards (Dashboard/Negotiation/Agent/Settings) + endpoints on one compact line |
| 4 | Recon statuses as bare coloured text | **pills** (tinted background + darker text, `recon-pill`) via a React `cellRenderer` — string-HTML renderers are escaped by AG Grid-React, `cellClass` would stretch the pill to the full cell (both attempts observed and rejected) |
| 5 | Detail panel header scrolled away | sticky panel header (bg-pp-surface, border-b) |
| — | (found & fixed en route) wrapper broke the grid/table height chain | `flex-1 min-h-0` added to wrappers of flex-layout pages |

Gates after the pass: `tsc 0` · `biome 0` · `npm test 1/1` · **axe:0 violations on the
polished ledger** (pills' colours: #00603a/#8a5a00/#b3122c/#545d68 on tints ≥ AA).
Screenshots reviewed by me at1600px before re-recording (home, ledger, agent).

## Re-record + re-montage (same day, after the polish)

All Playwright clips re-recorded on the polished UI (rec1+rec2 scripts, **0 page/console errors**):
`clip1` 11.8s · `clip2` 13.7s · `negotiation` 11.8s · `ai-panel` 5.5s · `hosted` 5.0s ·
`filters` 6.5s · `outro` 14.2s. Stage-129 evidence mp4s rebuilt from the new raws
(new cut points: `-ss 1.4` / `[0,3.0]+[5.1,∞]`), strips verified frame-by-frame
(new CTA, new pills, Explore cards visible; no loading shells).

Montage re-run (evidence script retuned for the new clip lengths: S3 =
nego 11.75 + console 13.4 + ai 5.45 + hosted 4.05@+0.3s head-skip + filters 6.635;
hosted head-skip removes the ≤0.3s white navigation frame found in review):
**FINAL = 100.8s, 13 burned cues, audio-driven** — `2026-10-30-stage132-demo-final.mp4`.
Verified frames: S1 ledger crop (red UNMATCHED pills + detail panel), home CTA,
hosted demo (no white frame). Subs still a single burned set (ffprobe: 0 sub streams).
