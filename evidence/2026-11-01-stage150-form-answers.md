# Evidence — stage 150: answers for EVERY mandatory form field (no empty)

Date: 2026-11-01 (plan11.11) · Form: PayPal AI Hackathon, live `get_submission_requirements`
(22 fields: **19 required**,3 optional) · Answers attach at submit (stage153) — this stage
prepares the COMPLETE validated array.

## Marker: «Жодного обов'язкового порожнього поля»

Validation executed against the LIVE form (fresh MCP fetch): **19/19 required +3/3 optional
answered, problems = []**:
- every required id has a non-empty concrete value;
- every dropdown value ∈ the form's own `options` (incl. `Ukraine`, `Individual`,
  `New`, `Yes`, `Significant`, multi-select `AG Grid/APIMatic/Render`);
- checkboxes are booleans (submit contract: boolean ✓).

## The bug this validation caught (why it exists)
Stage-148's pack staged the rating as `"9 - excellent"` — the actual option literal is
**`"9"`** (options: `1 - poor … 9 … 10 - excellent`). Caught by the options-membership
check; fixed everywhere.

## Deliverable for stage153
**`SUBMISSION-custom-answers.json`** —22 answers (19 required +3 optional), self-verified
after writing (count=22, no empty required, rating `"9"`). Long texts = the stage-148 pack
(tech-requirement, AI-tools, rating-why, testing, AG Grid & APIMatic experience).

## Staged values needing YOUR confirmation before submit (`staged_for_user_confirmation`)
- **Legal self-declarations (28794/95/96): `true`** — age of majority / eligible
  jurisdiction / not a Promotion Entities employee — **your assertion to make**;
- Rating `9` · Contact `Yes` · Learning `Significant` · AI-career `Yes` (recommendations);
- Sources: Country = **Ukraine** (dossier FACT F-01, Kyiv); Submitter = **Individual**
  (solo since registration); Sponsors = **AG Grid + APIMatic + Render** (stage39★ proves
  the APIMatic plugin usage — all three legitimately used).

## Not in this stage
File uploads (`prepare_file_upload`) and actual `submit_project` → stages152/153.

**Stage150 DONE:19/19 required +3/3 optional prepared,0 empty, all option values valid.**

## CORRECTION (2026-11-02): APIMatic removed from the answers — ADR-023
The original pack listed sponsors as `AG Grid + APIMatic + Render` and claimed the
APIMatic Context Plugin "was used during development". Challenged by the user, the
records were re-audited:
- **Install: real** (stage39 evidence: `~/.context-plugins/vscode/paypal`, registered
  in VS Code settings, `2026-10-28T06:33:27Z`);
- **Consultation during the build: no evidence anywhere** (zero mentions after stage39
  in evidence/PROGRESS/README; the plugin targets VS Code while the build ran in a
  different agent environment) → **usage claim FALSE**.
Corrections applied: `SUBMISSION-custom-answers.json` → sponsors `["AG Grid","Render"]`,
field **28793 left empty** («If you used…» = conditional + optional), the APIMatic
sentence removed from **29053**; the pack now instructs **two tracks** (AG Grid + Render)
and the152 instruction was corrected to tick **only those two**. Full rationale: ADR-023.
The stage39 install fact remains recorded (it is true) — it just never became usage.
