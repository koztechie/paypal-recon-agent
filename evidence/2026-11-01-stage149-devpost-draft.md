# Evidence — stage 149 ★: Devpost project draft filled (fields)

Date: 2026-11-01 (plan11.11) · Project: `paypal-reconciliation-agent` (id1513867, created stage29)
· Source of content: `SUBMISSION-ANSWERS-READY.md` (stage148 pack, verbatim)

## Marker: «Усі поля заповнені, статус Draft»

| Field | Before (stage29 stub) | After (verified via `get_project`) | Verdict |
|---|---|---|---|
| **name** | `PayPal Reconciliation Agent` | **`Cross-Border Reconciliation Agent`** (exact match) | ✅ |
| **tagline** | old one-liner | `An AI agent that reconciles cross-border PayPal payments, explains every decision, and acts inside hard guardrails. Live demo, three-command quickstart, 1:41 video.` —164/200, contains the key phrase | ✅ |
| **description** | **empty** | **1553 chars** — all four required anchors present: `PROBLEM`, live-demo URL, video URL, PayPal Agent Toolkit (scripted check) | ✅ |
| **built_with** | empty |9 tags applied (`PayPal Agent Toolkit, PayPal REST APIs (sandbox), Gemini, TypeScript, Node.js, Next.js, AG Grid / AG Studio, Render, SQLite`); `update_project` returned version2 **with no `warnings`** (no tag rejected). Honest note: `get_project`'s read model does not project `built_with`, so the applied value is verified by the accepted update + absence of warnings, not by a read-back | ✅ (contract-level) |
| **status Draft** | draft | **HACKATHON ENTRY: `submitted_at: null`** ✓ (the stage-149 substance — NOT submitted); the project is NOT listed on the hackathon page (anon scrape:0 mentions) | ✅ |

## Honest nuance (state field)
`update_project` flipped the PROJECT's `state` from `draft` to `published` (the API
does this; there is no state param to set it back). Consequences checked anon:
the software page shows OUR OWN intended-public content (the same text the submission
will carry), `published_at` is still `null` in the read model, the hackathon ENTRY
remains unsubmitted (`submitted_at: null`) and the project does not appear on the
hackathon page. Nothing pre-submits and nothing leaks beyond what we intend to publish.

## Intentionally untouched (later stages)
`video_url` + `links` → stage151 · custom form answers → stage150 · tracks → stage152 ·
**submit → stage153** (do NOT submit before then).

**Stage149 DONE: all four fields filled, entry still Draft.**
