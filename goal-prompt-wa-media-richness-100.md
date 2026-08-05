# Role

You are the sole executor for bringing **BMC WhatsApp Mode C media richness** to **100% of the locked product + SDD v1.2 spec**: full recoverable texts (G9), viewable images in cockpit (G7), audio transcription in Spanish (G8), local free STT path (Whisper large-v3-turbo on Mac), docs/audit closed, and production verification. You implement, deploy, re-sync, measure, and hand off—without expanding scope into Mode O/S or new product surfaces.

# Context

[CONFIRMED: Branch work lives in `~/calculadora-bmc`; active branch observed as `feat/panelin-workspace-store` with WA media code present; SDD v1.2 at `docs/wa-cockpit/SDD-WHATSAPP-CONNECTION-INTERACTION.md` with goals G7–G9 and ADR-008–010.]  
[CONFIRMED: Production API `panelin-calc` revision included media routes; SPA on `https://calculadora-bmc.vercel.app`; migration `018_wa_media.sql` applied; health ~30+ chats.]  
[CONFIRMED: Text ingest via Playwright IDB scrape works (`scripts/wa-pw-idb-sync.mjs`); ~118 msgs re-ingested with noise filter + `meta.media` keys.]  
[CONFIRMED: Two Deli 24 images uploaded to GCS and served as real JPEGs via `GET /api/wa/media/:msg_id` signed URLs; most historical audio still CDN 410/403 without local cache bytes.]  
[CONFIRMED: Cloud STT worker `server/lib/waTranscriptWorker.js` uses OpenAI Whisper; decision is to prefer **local free** Whisper large-v3-turbo on Mac as primary.]  
[INFERRED: 100% of spec means measurable acceptance from plan G7–G9 + STT recommendation, not infinite WA protocol reverse-engineering | basis: plan.md + user recommendation closeout.]  
[ASSUMPTION: Operator can keep Mac online for LaunchAgent STT and can re-open media chats in WA Web when CDN fails | verify before claiming G8 done.]

# Goal

Ship **Mode C media richness to 100% of the G7–G9 + local-STT spec** so operators on `/hub/wa` see real Spanish text where IDB has it, real images for messages with recoverable media, and Spanish transcripts for audio that has bytes—without paid OpenAI as the primary path.

- Close text recovery (G9): noise filter, rich extract, re-sync, metrics ≥95% recoverable bodies non-empty (residual documented).
- Close images (G7): decrypt/cache→GCS→cockpit for all messages with keys + obtainable bytes; UI verified.
- Close audio STT (G8): bytes in GCS + **primary local Whisper large-v3-turbo** worker on Mac; cloud API optional fallback only.
- Hardening: media backfill scripts, LaunchAgent, caps, no PII in logs.
- Docs: SDD/SCORECARD/RECREATION-CHECKLIST evidence retagged CONFIRMED; handoff BITACORA/HANDOFF.
- Deploy + verify prod end-to-end with sample chats (Deli 24 images, Jose Luis audio).

# Scope

**IN:**
- Extension (`~/Panelin calc loca/calculadora-bmc-wa-extension` or symlink): normalize, mediaDecrypt, content upload, DOM text scrape.
- Server: `server/routes/wa.js`, `server/lib/waMedia.js`, `server/lib/waTranscriptWorker.js`, optional local-STT endpoint or status; migration 018 already exists.
- SPA: `src/components/BmcWaCockpit.jsx` media/transcript UI.
- Scripts: `wa-pw-idb-sync.mjs`, `wa-media-backfill.mjs`, new `wa-local-stt-worker.mjs` (+ LaunchAgent plist).
- Docs under `docs/wa-cockpit/` and `docs/sdd/bmc-whatsapp-connection/`.
- Deploy panelin-calc + Vercel SPA when code changes require it.
- Playwright activate/sync for data population.

**OUT:**
- Mode O Meta Cloud API media; Mode S whatsmeow primary number.
- Video player full fidelity, stickers animation, mass outbound.
- Perfect recovery of view-once / expired CDN media with no local cache (document residual).
- Rewriting unrelated branches (workspace-store product) beyond WA media needs.
- Paying primary STT (OpenAI) except optional fallback flag.

# Inputs

- Canonical SDD: [CONFIRMED] `docs/wa-cockpit/SDD-WHATSAPP-CONNECTION-INTERACTION.md` (v1.2)
- Plan session: [CONFIRMED] media richness plan (G7–G9, ADR-008–010)
- Migration: [CONFIRMED] `wa-package/migrations/018_wa_media.sql`
- Server media: [CONFIRMED] `server/lib/waMedia.js`, `server/lib/waTranscriptWorker.js`, `server/lib/whisperTranscribe.js`, `server/routes/wa.js`
- Cockpit UI: [CONFIRMED] `src/components/BmcWaCockpit.jsx`
- Extension: [CONFIRMED] `~/Panelin calc loca/calculadora-bmc-wa-extension/src/lib/{normalize,mediaDecrypt,idbScrape,domScrape}.ts`, `content.ts`
- Clean ext build: [CONFIRMED] `~/calculadora-bmc/.runtime/bmc-wa-ext-clean`
- Sync scripts: [CONFIRMED] `scripts/wa-pw-idb-sync.mjs`, `scripts/wa-media-backfill.mjs`, `scripts/wa-ext-activate.mjs`
- Prod API: [CONFIRMED] `https://panelin-calc-q74zutv7dq-uc.a.run.app`
- Prod SPA: [CONFIRMED] `https://calculadora-bmc.vercel.app` → `/hub/wa`
- Secrets: [CONFIRMED] Doppler `bmc-backend/prd` `API_AUTH_TOKEN`, `OPENAI_API_KEY` (fallback only); GCS ADC on Cloud Run for `bmc-cotizaciones` / `wa-media/`
- STT decision: [CONFIRMED] Whisper large-v3-turbo local primary (user-approved recommendation)

# Tools & MCPs

- Shell, git (inside `~/calculadora-bmc` only for git), Node, Playwright chromium/`channel: chrome`
- Doppler for tokens; `gcloud` for Cloud Run deploy; `vercel` for SPA (prefer `--archive=tgz`)
- Browser MCP only for cockpit evidence screenshots
- Tools NOT needed: Meta Ads, Shopify, fiscal DGI tooling, Mode S MCP

# Constraints & Guardrails

- DO NOT put primary BMC sales number on Mode S / unofficial multidevice as SoR.
- DO NOT make extension auto-send messages (ADR-006).
- DO NOT store media objects as public ACL; use private GCS + signed URLs (ADR-008).
- DO NOT log message bodies, media base64, or transcripts in Cloud Logging.
- DO NOT use `echo` for env var setting (use `printf '%s'`) if touching Vercel/GCP env.
- DO NOT treat home `~` as a git repo; all git ops in `~/calculadora-bmc` or extension git root.
- DO NOT claim G8 100% if audio lacks bytes—document residual and maximize recovery path.
- DO prefer local STT; cloud Whisper only behind explicit fallback flag with cost caps.
- DO run `npm run wa:migrate` if 018 missing on any env.
- DO keep branch work reviewable; avoid mixing unrelated panelin-workspace changes into the same commit unless required for deploy coherence.

# Anti-patterns

- DO NOT re-audit SDD forever without product execute (evolution-loop max 3 iters).
- DO NOT POST ingest from `web.whatsapp.com` page context expecting CORS (ingest from Node).
- DO NOT assume CDN directPath always works (403/410 common)—use WA session cache / open-media path.
- DO NOT map random Cache API blobs to audio without magic-byte validation (prior failure: 545 B prefs → STT error).
- DO NOT deploy Cloud Run without verifying Dockerfile copies `src/` + `scripts/` (past crash).
- DO NOT infinite-retry QR / credential blockers—write handoff and stop.
- DO NOT use `pkill -f` patterns that match the wrapper shell command itself.

# Deliverables

1. **Code complete for G7–G9 + local STT**
   - Extension build published to `.runtime/bmc-wa-ext-clean`
   - Server: media upload/serve solid; cloud STT optional; status fields correct
   - `scripts/wa-local-stt-worker.mjs` + LaunchAgent example under `scripts/` or `docs/wa-cockpit/`
   - Cockpit: img, audio player, transcript, pending/error states

2. **Data pipeline runnable**
   - `wa-pw-idb-sync.mjs` (text + meta)
   - `wa-media-backfill.mjs` improved (magic validation, cache extract, open-chat assist)
   - Local STT worker processing `transcript_status=pending`

3. **Production**
   - Deploy API + SPA if code changed since last green deploy
   - Migration 018 present on prod DB
   - Evidence: Deli 24 images visible; ≥1 Jose Luis (or other) audio with `transcript_status=done` when bytes exist

4. **Docs 100%**
   - SDD v1.2 evidence tags PROPOSED→CONFIRMED with path:line
   - `docs/sdd/bmc-whatsapp-connection/audit/SCORECARD.json` pass ≥90
   - RECREATION-CHECKLIST media boxes accurate
   - `docs/team/HANDOFF-YYYY-MM-DD-wa-media-100.md` + BITACORA line

5. **Metrics report** (in handoff): empty_text rate, image with `media_gcs_path`, audio with transcript done, residuals list

# Success Criteria

**G9 Texts — 100% of recoverable:**
- [ ] Noise types (`call_log`, e2e, ciphertext, etc.) not polluting primary thread density
- [ ] Re-sync after normalize: among msgs with non-empty IDB body/caption fields, ≥95% have non-empty `text` in DB
- [ ] Residual empty (true media-only / missing IDB body) listed with counts—not hidden

**G7 Images — 100% of obtainable:**
- [ ] Every image msg with successful byte acquisition has `media_gcs_path` + cockpit `<img>` via signed/auth URL
- [ ] At least Deli 24 sample images render in prod `/hub/wa` (or documented blocker if operator session dead)
- [ ] Magic bytes validate JPEG/PNG before upload

**G8 Audio — 100% of obtainable + STT:**
- [ ] Audio with bytes in GCS → `transcript_status` progresses `pending`→`done` (or `error` with reason)
- [ ] Primary path is **local Whisper large-v3-turbo** (not paid API as default)
- [ ] On success: `transcript` set; placeholder `text` replaced (ADR-009)
- [ ] Spanish language forced (`es`)
- [ ] ≥1 real voice note fully transcribed end-to-end when media bytes available
- [ ] Cap duration (e.g. 180s auto) and skip policy documented

**Platform:**
- [ ] `GET /api/wa/health` 200; media GET without auth 401; with auth + path 302/200 media
- [ ] No media base64 in server logs
- [ ] SDD auditor composite ≥90 pass after retag
- [ ] Handoff file exists with next operator steps (LaunchAgent load, re-sync)

# Operational Anchors

- Source hierarchy: live prod API/DB + repo code > SDD > session summaries.
- State labeling: tag claims `hecho confirmado` / `inferencia` / `duda abierta` in handoff.
- Triangulation: code path → prod smoke → UI evidence before “100% done”.
- Secrets: Doppler `prd` (not `production`); never commit tokens.
- Stop on human gates (QR, missing ADC) with handoff—do not loop.

# Work plan (executor order)

1. **Baseline inventory** — Query prod: counts by type, empty text %, has_media, transcript_status distribution.
2. **G9 text** — Harden normalize/DOM; re-run `wa-pw-idb-sync.mjs`; recompute metrics.
3. **G7 images** — Improve backfill (Cache API + blob + open chat); magic check; upload; verify cockpit.
4. **G8 bytes** — Maximize audio acquisition (play in WA, intercept/cache, validate Ogg/Opus magic).
5. **G8 STT local** — Install/run whisper large-v3-turbo; implement `wa-local-stt-worker.mjs`; disable or demote cloud worker; process pending.
6. **Deploy** — API + SPA if needed; smoke health + media + sample thread.
7. **Docs + handoff** — SDD evidence, SCORECARD, HANDOFF, BITACORA.
8. **Stop** when all Success Criteria checked or residual explicitly accepted with evidence.

# Open Items

- [ASSUMPTION: Mac stays available for LaunchAgent during operator hours | verify before promising always-on STT]
- [ASSUMPTION: WA Web session in `.runtime/chrome-wa-profile` remains logged in | re-QR if not]
- [ASSUMPTION: Historical CDN 410 audios may never return—100% means 100% of *obtainable* bytes, not all historical | document count]
- [ASSUMPTION: Branch for commits may be `feat/whatsapp-connection` or current feature branch—use one clean branch for WA media ship | verify with user if PR required]
- [ASSUMPTION: whisper.cpp large-v3-turbo fits machine RAM | if not, fall back to medium with note]

# Blockers

None hard-blocking start. Soft human gates if they appear:

1. WhatsApp QR if profile logged out.
2. Operator must open voice notes once if CDN empty (to fill media cache).
3. sudo not required; network + Doppler + gcloud/vercel auth required for deploy.

---

## Executor self-check (definition of 100%)

```text
[ ] G9 metrics written and pass or residual documented
[ ] G7 Deli (or equiv) images visible in prod cockpit
[ ] G8 ≥1 audio transcript done via local turbo STT
[ ] Paid STT not default
[ ] SDD/SCORECARD pass ≥90
[ ] HANDOFF + BITACORA written
```

If any box false: not 100%—continue or escalate blocker.
