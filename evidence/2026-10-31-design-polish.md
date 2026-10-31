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

## Video pacing fix (user review #2, same day): "rapid frames, then long static"

Root cause found with `freezedetect` + frame strips: the recordings were shorter
than their VO segments, so all action crammed into the first seconds and `tpad`
froze the tail — **seg1 held one static frame ~13s** (filter burst in first 4.7s),
**seg2 held Settings ~14s**. The negotiation slice also drifted off the sub-perfect
14.0s budget (= sub1+sub2 exactly).

Fixes (all re-recorded, 0 console/page errors):
| Clip | Was | Now |
|---|---|---|
| clip1 | filter+panel in 4.7s → 13s frozen | 16.6s of paced action: rows → filter popup → typed UNMATCHED → panel → **switch row** → close/reopen → **sort by Amount** |
| clip2 | 4 pages in 9s → Settings frozen 14s | 29.3s: hero 4.2 → CTA+load → **search USD/clear** → agent **+scroll** → settings **+scroll** (VO tail trimmed by `-t`, zero freeze) |
| negotiation | slow-LLM run: 36s empty wait | retried until fast (settle **5.8s**, raw 14.56s); window [0,14] = thinking → rounds → Settled → contract; **s_n restored to 14.0** (sub alignment exact again) |
| hosted / outro | hit cold Render (50s) | re-recorded warm: 4.6s / 14.5s |
| filters | ended on post-clear "Loading" flash | window shifted +1s — ends on full grid + Export |

Post-fix `freezedetect`: no static block in 0–41s longer than **2.9s** (seg1) /
**5.3s** (Settings hold, narrated); the only long holds left are the contract
reveal and the final URL end-card — deliberate beats. Strips of every segment
visually reviewed. Raw vid2 clips committed for montage rerunnability.
