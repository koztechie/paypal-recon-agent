# Evidence — stage 71 (agent action latency) — PENDING official measurement

Date: 2026-10-28 night (plan date 04.11 — early attempt at PEAK hour)

## Findings (definitive, recorded to avoid re-work)
1. Correctness under load: 10/10 classifications correct (production path).
2. Latency at 23:30 local (free-tier PEAK): median 17574ms, p90 27694ms,
   MIN 1447ms — the model CAN answer in ~1.4s; the spread = serving queue.
3. usageMetadata: prompt=36 tokens, out=56, THOUGHTS=0 -> latency is NOT thinking:
   zero thought tokens; pure free-tier serving time.
4. Knobs tested (none help): thinkingBudget=0 -> 400; thinkingLevel low/minimal
   accepted but no measurable gain (removed from llm.ts as a dead parameter);
   response_mime_type json -> no gain; shorter output -> no gain.
5. Alternatives: gemini-2.5-flash -> 404 (not available to new users);
   gemini-3.1-flash-lite / gemma-4-31b -> 503 high demand; gemma-4-26b -> 500;
   gemini-flash-lite-latest -> same pool (12.3s median).

## Decision (not a code failure — external congestion)
- Stage 71 = PENDING official re-measurement at a QUIET hour:
  deferred runner scheduled for 07:00 local (US ~23:00 PT = deep night),
  runs npm run stage71 -> /tmp/stage71-deferred.log, marker file
  /tmp/stage71-deferred.done.
- Marker expected to pass there (observed floor: 1.4s).
