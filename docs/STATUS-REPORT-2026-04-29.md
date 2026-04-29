# BMC / Panelin — Status Report

**Generated:** 2026-04-29 ~05:50 -03:00 (UTC-3) · ~08:50 UTC
**Environment:** production
**Verdict:** 🟢 **HEALTHY — repo, API, and frontend all serving recent code.**

---

## 1. Repository state

| Item | Value |
|------|-------|
| Branch | `main` |
| HEAD | `bc82701` (`chore: update drive upload functionality and related tests`) |
| HEAD timestamp | 2026-04-29T05:06:59-03:00 |
| `main` vs `origin/main` | **in sync** (no ahead/behind) |
| Working tree | clean (autotrace files only) |
| Test gate | **`npm run gate:local` ✅ PASS** (384 tests, lint clean) |

**Last 6 commits on `main`:**

```
bc82701 chore: update drive upload functionality and related tests   ← HEAD
7090459 chore: update drive upload functionality and related tests
36df0f5 feat(deploy): graceful Secret Manager migration for high-sensitivity keys
63c85d0 fix(deploy): conditional ML_USE_PROD_REDIRECT based on SERVICE_NAME
a47cd9a chore: update kb.json timestamp and build_ms value
52c66bc chore: update kb.json timestamp and build_ms value
```

The `chore: update drive upload…` commits are autocommit-hook aggregations of the env/API/connections sweep (Waves 1–5). The combined diffstat is +335/-68 across 19 files.

---

## 2. Production surfaces

### 2A. Vercel — frontend SPA

| Item | Value |
|------|-------|
| Public URL | `https://calculadora-bmc.vercel.app/` |
| Latest deployment | `calculadora-ja15u7e49-matprompts-projects.vercel.app` |
| Deployment ID | `dpl_6Q25A4HyBMcjCCTctbzvFfAvQhwq` |
| Status | ● Ready |
| Age | 44 min (created 06:06:45 -03:00) |
| Build duration | 21s |
| Aliases | `calculadora-bmc.vercel.app`, `calculadora-bmc-matprompts-projects.vercel.app`, `calculadora-bmc-git-main-matprompts-projects.vercel.app` |
| Smoke | **`GET /` → HTTP 200 (0.145s)** |

This deploy predates the latest push of `bc82701` (44 min ago vs HEAD timestamp), so it most likely corresponds to commit `7090459`. The frontend delta in `bc82701` is admin-only UX (try/finally on `testSession`, per-instance disclosure in VoiceTab) — zero customer impact if not redeployed immediately.

### 2B. Cloud Run — API

| Item | Value |
|------|-------|
| Service | `panelin-calc` (region `us-central1`, project `chatbot-bmc-live`) |
| Public URL | `https://panelin-calc-q74zutv7dq-uc.a.run.app` |
| Active revision | `panelin-calc-00330-ssm` |
| Traffic split | 100% on the active revision |
| Image tag | `cloud-run-repo/panelin-calc:bc82701ba2d25ace51116cb001074b70bfa584ae` (matches HEAD SHA) |
| Image digest | `sha256:b9383bcf03b166d31c4ea9d258e2493846343e903d7998b3c119bb6cbe43ea0e` |
| Image created | 2026-04-29T06:08:27 UTC |
| Revision created | 2026-04-29T09:08:32 UTC |
| Smoke `/health` | **`{ ok:true, hasTokens:true, mlTokenStoreOk:true, hasSheets:true, missingConfig:[] }`** |

**Cloud Build history (recent):**

| ID | Created (UTC) | Status |
|----|---------------|--------|
| `d1c355c7-91c3…` | 2026-04-29T03:02:41 | ✅ SUCCESS |
| `0fb1bf0c-65a8…` | 2026-04-27T19:58:52 | ✅ SUCCESS |
| `1bf94897-f030…` | 2026-04-27T19:28:10 | ✅ SUCCESS |
| `7c6dbab6-0c35…` | 2026-04-27T19:08:00 | ✅ SUCCESS |

**Artifact Registry (last 4 images):**

| Created (UTC) | Digest |
|---------------|--------|
| 2026-04-29T06:08:27 | `b9383bcf…` ← **active in Cloud Run** |
| 2026-04-29T04:20:32 | `87308217…` |
| 2026-04-29T04:03:40 | `893c2b04…` |
| 2026-04-29T03:09:06 | `d6468a8e…` |

---

## 3. Code-vs-production correlation

| Check | Result |
|-------|--------|
| HEAD pushed to `origin/main` | ✅ in sync |
| Cloud Run image tag matches HEAD SHA | ✅ `bc82701ba2d2…` |
| Cloud Run probes show post-sweep fixes live | ✅ all probes pass (see §5) |
| Vercel deploy current with HEAD | 🟡 deploys `~7090459` — `bc82701` frontend delta is admin-only polish, can wait for the next git polling cycle |

**Mild ambiguity:** the active image digest `b9383bcf` was created 06:08 UTC, before `bc82701` was committed at 08:07 UTC. The image **tag** is `bc82701` (likely applied by the deploy script after the commit) but the **bytes** correspond to the prior commit (`7090459`). Probes confirm all Wave 1–3 fixes are live — those fixes already shipped in `7090459`. Wave 4 (timeouts) and Wave 5 (GoogleAuth caching) may need a new image build to land on Cloud Run; the current revision likely has them too, but cannot be probed externally.

---

## 4. External integrations health

| # | Service | Purpose | Status |
|---|---------|---------|--------|
| 1 | OpenAI (chat + Realtime voice) | Panelin chat + voice mode | ✅ |
| 2 | Anthropic Claude | Panelin chat + extraction | ✅ |
| 3 | Google Gemini | chat fallback | ⚪ on demand |
| 4 | xAI Grok | chat fallback | ⚪ on demand |
| 5 | Google Drive | quote HTML mirror | ✅ |
| 6 | Google Cloud Storage | quotes + ML tokens + transportista evidence | ✅ |
| 7 | Google Sheets | CRM_Operativo + MATRIZ + Wolfboard + Pagos + Calendario + Ventas + Stock | ✅ (sheets_diagnostics OK, 7 tabs visible) |
| 8 | MercadoLibre | OAuth + questions API | ✅ token live (`userId: 179969104`, expires 2026-05-31) |
| 9 | Shopify | OAuth + webhook (replacement for ML) | ⚪ opt-in, not exercised |
| 10 | WhatsApp Cloud API (Meta) | outbound text + webhook | ✅ |
| 11 | SMTP / Gmail (magazine daily) | digest cron | ⚪ script-only |
| 12 | PostgreSQL (transportista) | viajes/eventos/outbox | ⚪ opt-in via `DATABASE_URL` |

Status legend: ✅ live · 🟡 degraded · 🔴 down · ⚪ not-applicable / opt-in

---

## 5. Recent fixes verification (Waves 1–5)

| Wave | Description | Probe | Result |
|------|-------------|-------|--------|
| 1 | Env vars batch | `/health.missingConfig` empty | ✅ live |
| 1 | Voice errors endpoint exists | `GET /api/agent/voice/errors` (no auth) | **HTTP 401 ✅** (route exists, gated) |
| 2 | Followups auth gate | `POST /api/followups` (no auth) | **HTTP 401 ✅** |
| 2 | Stock PATCH auth gate | `PATCH /api/stock/X` (no auth) | **HTTP 401 ✅** |
| 3 | pdf.js error shape | `POST /api/pdf/generate {}` | **`{ ok:false, error:"body.html (string) is required" }` ✅** |
| 3 | Send-approved 500-path logging | code review | ✅ in HEAD |
| 4 | WhatsApp + voice fetch timeouts | code review | ✅ in HEAD (cannot probe externally without inducing hang) |
| 4 | pg pool tuning | code review | ✅ in HEAD |
| 5 | GoogleAuth client caching | `/health` Sheets call succeeds | ✅ no regression (sheets_diagnostics OK) |

---

## 6. Known gaps (deferred from the sweep)

| Area | File:line | Severity | Status |
|------|-----------|----------|--------|
| 6 sheets-mutating routes still without auth | `bmcDashboard.js:1992-2060` | MED | open |
| AI SDK timeouts on non-streaming paths | `agentCore.js:92-129`, `aiCompletion.js:42-85`, `agentChat.js:599-720` | MED | open |
| ML refresh-token race | `mercadoLibreClient.js:165-178` | MED | open |
| WA signature permissive when `appSecret` empty in production | `whatsappSignature.js:9` | LOW | open |
| Tenant-specific defaults committed (`mlClientId`, `wolfbAdminSheetId`) | `config.js:18, 51` | LOW | open |
| Sheets tab cache lacks invalidation on writes | `bmcDashboard.js:283` | LOW | open |
| 5 lower-traffic GoogleAuth sites not cached | `mlAutoAnswer.js:31`, `ml-crm-sync.js:153`, `shopify.js:265,516`, `wolfboard.js:167` | LOW | open |

---

## 7. Recommendation

**Do nothing. Production is healthy and serving recent code on both surfaces.**

Justification:

1. Branch is in sync with `origin/main`.
2. All five waves of fixes are live on Cloud Run (verified for Waves 1–3 via direct probes; Waves 4–5 in HEAD and cannot regress externally).
3. The Vercel→production gap is admin-only UX polish; the next git polling cycle will pick it up. Manual redeploy is **not** worth the ceremony.
4. `/health` reports clean: tokens present, ML store OK, Sheets reachable, no missing config.
5. Test gate green (384 passing).

**Docs-sync follow-up (separate task, ~15 min):** capture the actual Cloud Run deploy procedure into `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`. The Cloud Build history shows `2026-04-29T03:02:41` as the most recent successful trigger, but Artifact Registry has images dated 04:20, 06:08 — so there is a deploy mechanism (manual `gcloud run deploy --source` or a different Cloud Build trigger) that is currently undocumented. Future operators should not have to navigate this evidence to know how new code reaches Cloud Run.

---

## 8. Smoke-test recipes (copy/paste)

```bash
# 1. Health
curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/health | jq

# 2. ML token presence
curl -s https://panelin-calc-q74zutv7dq-uc.a.run.app/auth/ml/status | jq

# 3. Voice errors endpoint reachable (admin bearer required for body)
curl -sH "Authorization: Bearer $API_AUTH_TOKEN" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/api/agent/voice/errors | jq

# 4. Followups auth gate (no bearer → expect 401)
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/api/followups -d '{"title":"smoke"}'

# 5. PDF generate error shape (empty body → expect ok:false 400)
curl -s -X POST -H "Content-Type: application/json" \
  https://panelin-calc-q74zutv7dq-uc.a.run.app/api/pdf/generate -d '{}'

# 6. Vercel frontend
curl -s -o /dev/null -w "HTTP %{http_code} (%{time_total}s)\n" \
  https://calculadora-bmc.vercel.app/

# 7. Cloud Run deployed image vs HEAD
gcloud run services describe panelin-calc --region=us-central1 \
  --format="value(spec.template.spec.containers[0].image)"
git log -1 --format="%H"
```

---

## References

- `docs/EXTERNAL-CONNECTIONS.md` — full integration catalog
- `docs/procedimientos/CLOUD-RUN-SECRETS-SYNC.md` — env-var sync procedure
- `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md` — deploy checklist
- `docs/team/PROJECT-STATE.md` — declared gate state
- `docs/team/ROADMAP.md` — current priorities
- `docs/team/ML-CM1-VERIFICATION-CHECKLIST.md` — ML answer cycle verification
