# Phase 9 — Scorecard

**Audit:** EXPORT_SEAL::OMNI_HUB_DISCOVERY_MASTER_V1  
**Date:** 2026-06-22  
**Repo SHA:** `d04a7f4`  
**Cross-links:** [08-omni-gap-analysis](08-omni-gap-analysis.md) · [02-channel-map](02-channel-map.md)

---

## Scoring scale

| Score | Label | Meaning |
|-------|-------|---------|
| 0 | Missing | No implementation |
| 25 | Partial | Scaffold, docs, or filter-only |
| 50 | Functional | Core path works; notable gaps |
| 75 | Advanced | Production features; minor gaps |
| 100 | Production Ready | Complete, secured, observable, documented |

---

## Scores

| Area | Score | Label | Summary |
|------|-------|-------|---------|
| **WhatsApp** | 75 | Advanced | Full webhook, Postgres wa_*, cockpit UI, outbound, workers, Sheets bridge |
| **MercadoLibre** | 75 | Advanced | OAuth, webhook, CRM sync, send-approved; no ML Postgres channel DB |
| **Email** | 25 | Partial | API ingest + external IMAP bridge; no UI, no SMTP outbound |
| **Instagram** | 25 | Partial | surface.js + unified queue filter only; no Meta API |
| **Facebook** | 25 | Partial | Same as Instagram; send-approved rejects FB |
| **OmniHub** | 25 | Partial | Architecture doc + SQL schema; zero runtime omni_* |
| **AI** | 50 | Functional | agentCore production; RAG opt-in; heuristic classifiers |
| **Security** | 50 | Functional | JWT/RBAC/HMAC strong; open CRM AI routes; no SSRF |
| **Frontend** | 50 | Functional | canales production; ml-manager partial; wa-inbox missing |
| **Observability** | 50 | Functional | pino logging; WA/PDF metrics; no centralized APM |
| **Documentation** | 75 | Advanced | Rich docs/team + sheets module; omni docs ahead of code |

---

## WhatsApp — 75

**Strengths:**
- Meta webhook with HMAC (`server/index.js` L812–962)
- 18 Postgres migrations, full `/api/wa/*` API
- Production UI at `/hub/wa`
- In-process enricher, SLA, followups workers

**Gaps preventing 100:**
- `/hub/wa-inbox` route **NOT_FOUND** (separate from `/hub/wa`)
- No omni_* unified model
- omni normalizer **NOT_FOUND**

**Evidence:**

- File: `server/routes/wa.js` — 37 routes **IMPLEMENTED**
- File: `wa-package/migrations/` — 18 SQL files **IMPLEMENTED**

---

## MercadoLibre — 75

**Strengths:**
- OAuth PKCE + ML proxy API (`server/index.js` L291–531)
- Webhook + CRM sync (`ml-crm-sync.js`)
- CRM cockpit send-approved to ML Answers API

**Gaps preventing 100:**
- No ML-specific Postgres message store
- `/hub/ml-manager` **PARTIAL** (~2 working backend routes)
- Missing `/ml/messages/unread`, ads, analytics APIs

**Evidence:**

- File: `server/index.js` L533–603 — webhook **IMPLEMENTED**
- File: `src/components/hub/ml/hooks/useMlConnector.js` L36–42 — calls missing endpoint

---

## Email — 25

**Strengths:**
- `POST /api/crm/ingest-email` with auth
- Bridge script `email-snapshot-ingest.mjs`
- AI parse + CRM write to Sheets

**Gaps:**
- No in-repo IMAP — **NOT_FOUND**
- No `/hub/email` UI — **NOT_FOUND**
- No SMTP outbound send — **NOT_FOUND**
- GHA email cron commented out — **PARTIAL**

**Evidence:**

- File: `server/routes/bmcDashboard.js` L2626–2627 — ingest **IMPLEMENTED**
- File: `src/App.jsx` — no email route **NOT_FOUND**

---

## Instagram — 25

**Strengths:**
- `SURFACES.INSTAGRAM` in `surface.js`
- Unified queue channel filter in canales UI

**Gaps:**
- No Meta Instagram Graph webhook — **NOT_FOUND**
- No send path — **NOT_FOUND**
- sync-all skips IG — **PARTIAL**

**Evidence:**

- File: `server/lib/surface.js` L18, L74
- File: `server/routes/bmcDashboard.js` L3535–3545

---

## Facebook — 25

Same rationale as Instagram.

**Evidence:**

- File: `server/lib/surface.js` L19, L75
- File: `server/routes/bmcDashboard.js` L3253–3256 — send ML/WA only

---

## OmniHub — 25

**Strengths:**
- Frozen architecture doc (`OMNI-HUB-ARCHITECTURE.md`)
- Complete SQL schema (`omni-hub-schema.sql`)
- Sheets-backed unified queue (`/hub/canales`) as interim

**Gaps:**
- All `omni_*` tables — **DOCUMENTED_ONLY**
- Omni normalizer, identity engine, omni API — **NOT_FOUND**
- Planned routes `/api/omni/*` — **NOT_FOUND**

**Evidence:**

- Grep `omni_` in `server/` — **NOT_FOUND**
- File: `docs/team/omni-hub-schema.sql` — DDL only

---

## AI — 50

**Strengths:**
- Unified `agentCore` with 4-provider chain — **IMPLEMENTED**
- SSE chat with tools — **IMPLEMENTED**
- Training KB + auto-learn — **IMPLEMENTED**
- suggest-response for CRM — **IMPLEMENTED**

**Gaps:**
- RAG disabled by default — **PARTIAL**
- Classifiers are regex/heuristic, not LLM — **PARTIAL**
- No central omni AI orchestrator — **NOT_FOUND**
- `suggest-response` unauthenticated — security gap

**Evidence:**

- File: `server/config.js` L246–250 — `RAG_ENABLED=false`
- File: `server/lib/agentCore.js` — **IMPLEMENTED**

---

## Security — 50

**Strengths:**
- JWT + RBAC + MFA — **IMPLEMENTED**
- HMAC on ML/WA/Shopify/sync webhooks — **IMPLEMENTED**
- Rate limiting on auth, chat, WA outbound — **IMPLEMENTED**
- CSP on Vercel — **IMPLEMENTED**

**Gaps:**
- Many unauthenticated Sheets GET routes — factual
- `POST /api/crm/suggest-response` open — factual
- SSRF protection — **NOT_FOUND**
- Validation Zod only on select paths — **PARTIAL**

**Evidence:**

- File: `server/middleware/requireGrant.js` — **IMPLEMENTED**
- File: `server/routes/bmcDashboard.js` L2311 — no auth middleware

---

## Frontend — 50

**Strengths:**
- `/hub/canales` production unified CRM — **IMPLEMENTED**
- `/hub/wa` full cockpit — **IMPLEMENTED**
- `/hub/ml` operativo queue — **IMPLEMENTED**
- RBAC via `RequireGrant` — **IMPLEMENTED**

**Gaps:**
- `/hub/wa-inbox` — **NOT_FOUND**
- `/hub/ml-manager` — **PARTIAL** (mock MessagesTab, missing APIs)
- Orphan `CanalesModule.jsx` — **NOT_MOUNTED**
- No omni workspace — **NOT_FOUND**

**Evidence:**

- File: `src/App.jsx` L188–234
- File: `src/components/hub/canales/panels/WaInboxPanel.jsx` L23 — Phase 2 stub

---

## Observability — 50

**Strengths:**
- pino + pino-http on all requests (`server/index.js` L7–8, L164)
- WA metrics endpoint `GET /api/wa/metrics`
- PDF generation metrics `GET /api/pdf/metrics`
- Structured cost logging in agentChat
- GHA scheduled smoke prod

**Gaps:**
- No centralized APM/tracing — **NOT_FOUND**
- Wolfboard/superAgent TODO pino threading — **PARTIAL**
- No omni-specific dashboards — **NOT_FOUND**
- Vercel cron — **NOT_FOUND**

**Evidence:**

- File: `server/index.js` L7–8 — pino logger
- File: `server/routes/wa.js` L1284 — metrics route
- File: `vercel.json` — no cron block

---

## Documentation — 75

**Strengths:**
- `AGENTS.md`, `CLAUDE.md`, `PROJECT-STATE.md`
- `docs/google-sheets-module/` canonical mapping
- `docs/team/OMNI-HUB-ARCHITECTURE.md` + schema SQL
- Channel E2E docs (WHATSAPP-META-E2E, ML-OAUTH-SETUP)
- 12+ agent definitions in `.claude/agents/`

**Gaps preventing 100:**
- omni docs describe routes not yet in code — drift
- ML Manager roadmap ahead of backend implementation
- Some PROJECT-STATE omni entries stale vs codebase

**Evidence:**

- File: `docs/team/OMNI-HUB-ARCHITECTURE.md` — design frozen
- Runtime omni — **NOT_FOUND** (doc ahead of code)

---

## Aggregate readiness

| Category | Avg score | Weighted assessment |
|----------|-----------|---------------------|
| Channels (WA+ML+Email+IG+FB) | 45 | Strong on WA/ML; weak on Email/IG/FB |
| Omni platform | 25 | Design only |
| Platform (AI+Security+Frontend+Obs) | 50 | Functional core |
| Documentation | 75 | Strong |

**Overall omni-readiness estimate:** ~**40/100** (functional multi-channel via Sheets + WA Postgres; omni unified layer not started).

---

## Score evidence index

| Score doc section | Primary evidence files |
|-------------------|------------------------|
| WhatsApp 75 | `server/routes/wa.js`, `wa-package/migrations/`, `server/index.js` L812 |
| MercadoLibre 75 | `server/index.js` L291–627, `server/ml-crm-sync.js` |
| Email 25 | `bmcDashboard.js` L2626, `scripts/email-snapshot-ingest.mjs` |
| Instagram/Facebook 25 | `server/lib/surface.js`, `bmcDashboard.js` L3380+ |
| OmniHub 25 | `docs/team/omni-hub-schema.sql`, grep omni in server |
| AI 50 | `server/lib/agentCore.js`, `server/config.js` RAG flag |
| Security 50 | `identityAuth.js`, `bmcDashboard.js` L2311 |
| Frontend 50 | `src/App.jsx`, `useMlConnector.js` |
| Observability 50 | `server/index.js` pino, `wa.js` metrics |
| Documentation 75 | `docs/team/`, `docs/google-sheets-module/` |
