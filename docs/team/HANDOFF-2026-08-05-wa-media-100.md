# HANDOFF — WA Media Richness 100% (shipped + verified)

**Date:** 2026-08-05  
**Status:** **SHIPPED to main + PROD VERIFIED**

| Item | Value |
|------|--------|
| PR (code) | [#847](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/847) **MERGED** `ff312646` |
| PR (closeout docs) | [#866](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/866) **MERGED** `2d0b4a6e` |
| Cloud Run rev | **`panelin-calc-00934-lp5`** (100% traffic) |
| Deploy run | [30988402352](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/runs/30988402352) success |
| **As-built SPEC** | [`features/WA-MEDIA-RICHNESS-SPEC.md`](./features/WA-MEDIA-RICHNESS-SPEC.md) |
| **Prompt eng archive** | [`goal-prompts/goal-prompt-wa-media-richness-100.md`](./goal-prompts/goal-prompt-wa-media-richness-100.md) |
| Operator hub | [`../wa-cockpit/MEDIA-G7G8G9.md`](../wa-cockpit/MEDIA-G7G8G9.md) |

---

## Full prod verification (2026-08-05 post-ship)

| Check | Expected | Observed |
|-------|----------|----------|
| health | 200 | 200 `ok:true` |
| media unauth | 401 not path 404 | **401** |
| Deli #1 auth | 302/200 | **302** → signed GCS |
| Deli #1 body | JPEG `ffd8` | **ffd8** JFIF, 461 705 B |
| Deli #2 auth | 302 | **302** |
| Deli #2 body | JPEG | **ffd8**, 97 500 B |
| junk FB as audio | 400 `not_audio_junk` | exact |
| tiny payload | 400 too small | exact |
| `/media/link` unauth | 401 | 401 |
| `/media/clear` unauth | 401 | 401 |
| messages list Deli | media fields | **2** × `has_media=true` + `media_url` |
| audio honesty | no synthetic STT | `audio_with_media=0` on sample page |
| SPA `/hub/wa` | 200 | Vercel 200 |
| `waMedia.js` on main | present | yes |

Reproduce commands: see SPEC §6 or [`../wa-cockpit/MEDIA-G7G8G9.md`](../wa-cockpit/MEDIA-G7G8G9.md).

---

## Residual (not ship blockers)

- G8 real Spanish STT: operator play-in-WA for Ogg → backfill → local Whisper (`LOCAL-STT.md`).
- Extension Mode C polish / Mode O Meta Cloud: out of scope.

---

## Ship path used (BMC-safe)

branch → PR → green required CI (Lint / Validate / Env drift) → merge → official `deploy-calc-api` → curl verify.  

**Never** `./scripts/deploy-cloud-run.sh` from Envíos / dirty trees (ad-hoc revisions get overwritten).

---

## Next prompt (if continuing G8)

```text
Play Jose Luis voice notes in WA Web, re-run wa-media-backfill + wa-local-stt-worker ONCE=1,
verify one real Spanish transcript on panelin-calc without synthetic audio.
```
