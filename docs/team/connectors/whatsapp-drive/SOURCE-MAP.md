# WhatsApp + Drive — Canonical Source Map

**Purpose:** verified index of files, endpoints, scripts, docs, env vars, and tables that make up WhatsApp, Google Drive quote archive, and the (not-yet-built) intersection a connector would use. **Read this after** [`README.md`](./README.md). Architecture intent: [`BLUEPRINT.md`](./BLUEPRINT.md). Load recipe: [`CONTEXT-RECIPE.md`](./CONTEXT-RECIPE.md).

**Pack root:** `docs/team/connectors/whatsapp-drive/`. Status: 🟢 live · 🟡 partial/dormant · 🔴 missing.

Every path below was confirmed in-repo at pack creation. If you add a file, add it here.

> **Rules:** human gate on every customer WhatsApp send. Drive scope is `drive.file` only. WA media = GCS, not Drive. Never log secrets. Unverified prod flag state → `#ZonaDesconocida`.

---

## 1. AI brain (shared)

| File | Purpose | Status |
|------|---------|--------|
| `server/lib/agentCore.js` | `callAgentOnce()`; `CHANNEL_RULES.wa` (800 chars); WA `maxTokens` 400 | 🟢 |
| `server/lib/agentTools.js` | Tools incl. `enviar_whatsapp_link`, `wa_lead_to_admin`; `user_confirmed` | 🟢 |
| `server/lib/chatPrompts.js` | System prompt parts + WA cockpit 3-options block | 🟢 |
| `server/lib/channelRenderer.js` | `goodAnswerWA`; channel adapters | 🟢 |
| `server/lib/trainingKB.js` | Training KB; `goodAnswerWA`; GCS persist | 🟢 |
| `server/lib/kbSurface.js` | Surface `whatsapp`, limit 700 | 🟢 |
| `server/lib/surface.js` | Brand surface → channel `wa` | 🟢 |
| `server/lib/assistantRegistry.js` | Assistant key `wa` | 🟢 |
| `server/lib/autoLearnExtractor.js` | Q→A extract `source: "wa"` | 🟢 |
| `server/lib/rag.js` · `server/lib/embeddings.js` | pgvector similar quotes | 🟡 `RAG_ENABLED` |
| `server/lib/brainKB.js` | Policy lessons (GCS/local) | 🟡 flag-gated |
| `server/lib/knowledgeLoader.js` | Loads `data/knowledge/*.md` into **all** chat prompts | 🟢 do not add this pack there |
| `server/lib/omni/knowledge/kbBridge.js` | Last 5 msgs + optional RAG for Omni suggest | 🟢 |
| `data/knowledge/*.md` | Static product facts | 🟢 |
| `data/training-kb.json` | Curated Training KB runtime | 🟢 (+ GCS in prod) |

## 2. WhatsApp Cloud API (webhook + send)

| File | Purpose | Status |
|------|---------|--------|
| `server/index.js` | Canonical `GET`/`POST /webhooks/whatsapp`; legacy `processWaConversation`; 5-min / 🚀 | 🟢 |
| `server/routes/webhooks.js` | Partial/stub WA router (full logic still in `index.js`) | 🟡 |
| `server/lib/whatsappOutbound.js` | Single Graph `v21.0/{phoneNumberId}/messages` text sender | 🟢 |
| `server/lib/whatsappSignature.js` | HMAC `x-hub-signature-256` | 🟢 |
| `server/lib/wa/ingestMode.js` | `legacy` vs `canonical` (`OMNI_WA_CANONICAL` + bus + AI) | 🟢 |
| `server/lib/wa/crmIngestWrite.js` | Sheets ingest + AF/AG tail + `runWaAutoLearn` | 🟢 |
| `server/lib/wa/waCrmSyncJob.js` | Durable Omni job replacing duplicate `processWaConversation` side-effects | 🟢 |
| `scripts/whatsapp-cloud-check.mjs` | `npm run wa:cloud-check` | 🟢 |

## 3. WA Cockpit (`wa_*`)

| File | Purpose | Status |
|------|---------|--------|
| `server/routes/wa.js` | `/api/wa/*` ingest, conversations, media, suggestions, quotes, outbound | 🟢 |
| `server/lib/waDb.js` | Postgres pool | 🟢 |
| `server/lib/waConfig.js` · `waConfigSchema.js` | Runtime flags/settings | 🟢 |
| `server/lib/waValidate.js` | Ingest payload validation | 🟢 |
| `server/lib/waOperatorAuth.js` | Magic-link / JWT | 🟢 |
| `server/lib/waEnricher.js` · `waEnricherWorker.js` | 3 suggestion drafts | 🟢 flag-gated |
| `server/lib/waQuoteRunner.js` · `waQuoteParams.js` | Auto-quote from thread | 🟢 |
| `server/lib/waFollowupsWorker.js` · `waSlaWorker.js` · `waRoutingRules.js` | Follow-ups, SLA, rules | 🟢 |
| `server/lib/waWebhooks.js` | Outbound HMAC webhooks from cockpit events | 🟢 |
| `server/lib/waMedia.js` | Magic-byte + GCS paths | 🟢 |
| `server/lib/waTranscriptWorker.js` | Voice → transcript | 🟢 |
| `src/components/BmcWaModuleWithTabs.jsx` · `BmcWaCockpit.jsx` | `/hub/wa` | 🟢 |
| `src/components/hub/canales/panels/WaInboxPanel.jsx` | WA slice in Omni | 🟢 |
| `src/utils/waPhoneNormalize.js` | Phone normalize | 🟢 |
| `wa-package/migrations/000`–`018_*.sql` | Schema `wa_*` | 🟢 `npm run wa:migrate` |

## 4. Omni WA

| File | Purpose | Status |
|------|---------|--------|
| `server/routes/omni.js` | Omni API; outbound WA via `sendWaReply` | 🟢 |
| `server/lib/omni/adapters/waWebhook.js` · `waExtension.js` | Cloud / extension → Omni event | 🟢 |
| `server/lib/omni/outbound/waReply.js` · `metaSend.js` | Unified send + UY `598` | 🟢 |
| `server/lib/omni/orchestrator/aiWorker.js` | classify / suggest / `wa_crm_sync` | 🟡 orchestrator flag |
| `server/lib/wa/omniReadAdapter.js` | Cockpit reads from Omni | 🟡 `OMNI_WA_READS` |

## 5. Google Drive (GIS + server)

| File | Purpose | Status |
|------|---------|--------|
| `src/utils/googleDrive.js` | GIS + Drive v3 client; scope `drive.file` | 🟢 |
| `src/utils/quotationNaming.js` | Client/code folder + PDF names (Montevideo TZ) | 🟢 |
| `src/utils/companyDriveArchive.js` | SPA → `POST /api/quotes/drive-archive` | 🟢 |
| `src/utils/driveConfigApi.js` | JWT client for folder preference | 🟢 |
| `src/utils/logistica/enviosDrive.js` | `.bmc-envios.json` schema | 🟢 |
| `src/utils/logistica/adjuntoUrl.js` | Parse Drive share links | 🟢 |
| `src/components/GoogleDrivePanel.jsx` · `DriveFolderConfig.jsx` | Drive UI | 🟢 |
| `server/lib/driveUpload.js` | Server Drive: HTML mirror, PDF+`.bmc.json`, load project | 🟢 |
| `server/routes/quoteDriveArchive.js` | `POST /api/quotes/drive-archive`, `GET /api/quotes/drive-project` | 🟢 |
| `server/routes/driveConfig.js` | `GET/POST /api/drive/config` | 🟢 |
| `server/lib/enviosAdjuntoFetch.js` | SSRF-safe public Drive/Dropbox fetch | 🟢 |
| `supabase/migrations/20260624000001_user_drive_config.sql` | `identity.user_drive_config` | 🟢 |

## 6. Calc / CRM glue

| File | Purpose | Status |
|------|---------|--------|
| `src/utils/helpers.js` | `buildWhatsAppText()` parallel export | 🟢 |
| `src/utils/pdfGenerator.js` | PDF pipeline | 🟢 |
| `server/routes/bmcDashboard.js` | `parse-conversation`, send-approved → Cloud API | 🟢 |
| `server/routes/agentChat.js` | SSE chat; surface `whatsapp`→`wa`; **tools** | 🟢 |
| `server/lib/calcLoopbackClient.js` | Agent tools → `/calc/*` | 🟢 |
| `server/lib/transportistaOutboxWorker.js` | Logistics WA via same outbound | 🟢 |

## 7. Scripts & npm

| Script / npm | Purpose | Status |
|--------------|---------|--------|
| `npm run wa:cloud-check` | Masked env + callback URL | 🟢 |
| `npm run wa:migrate` | Apply `wa-package/migrations` | 🟢 |
| `npm run drive:one-shot` / `drive:bootstrap` / `drive:configure` | GIS Client ID setup | 🟢 |
| `npm run verify:google-drive-oauth` · `verify:google-drive-dist` | Client ID / dist bake-in | 🟢 |
| `node tests/waDriveKnowledgePack.test.js` | This pack: MANIFEST paths + no secrets | 🟢 |

## 8. Cursor skills / rules

| Path | Purpose |
|------|---------|
| `.cursor/skills/whatsapp-drive-connector/SKILL.md` | This pack — read MANIFEST first |
| `.cursor/rules/bmc-whatsapp-drive-company-knowledge-first.mdc` | Grounding rule |
| `.cursor/skills/bmc-google-drive-oauth/SKILL.md` | GIS Client ID / Vercel |
| `.cursor/skills/meta-social-api-config-agent/SKILL.md` | Meta app, tokens, webhooks |
| `.cursor/rules/human-gates-bmc.mdc` | cm-0 WhatsApp evidence |
| `docs/team/knowledge/WhatsAppDrive.md` | Role stub → this folder |

## 9. Docs (hubs to index, not copy)

| Doc | Purpose |
|-----|---------|
| `docs/wa-cockpit/README.md` | Cockpit hub |
| `docs/wa-cockpit/API-REFERENCE.md` · `CONFIG-REFERENCE.md` · `OPERATOR-GUIDE.md` | API / config / ops |
| `docs/wa-cockpit/MEDIA-G7G8G9.md` · `LOCAL-STT.md` | Media + STT |
| `docs/team/WHATSAPP-META-E2E.md` | Meta webhook E2E (**canonical**) |
| `docs/team/HUMAN-GATES-ONE-BY-ONE.md` | cm-0 clicks |
| `docs/team/runbooks/wa-canonical-flip.md` | Omni canonical flip |
| `docs/team/features/WA-MEDIA-RICHNESS-SPEC.md` | Media as-built |
| `docs/team/panelsim/knowledge/WA-ARCHIVE-TRAINING-MODE.md` | Offline export → KB |
| `docs/GOOGLE_DRIVE_SETUP_PROMPT.md` · `docs/GOOGLE-DRIVE-OAUTH-AUTOMATION-PLAN.md` | GIS setup |
| `docs/EXTERNAL-CONNECTIONS.md` | External systems cards |
| `docs/sdd/calculadora-bmc/SDD.md` §7.4 | As-built inbound WA |
| `docs/team/EMAIL-SOURCE-MAP.md` | Sibling pattern (Email/Omni) |

## 10. Postgres (WA / Omni / Drive config)

| Object | Where | Purpose |
|--------|-------|---------|
| `wa_conversations` / `wa_messages` / `wa_suggestions` / `wa_quotes` | `wa-package/migrations/000`–`003` | Cockpit core |
| `wa_followups` / `wa_consent` / `wa_operators` | `004`–`006`, `012` | Follow-ups, opt-in, ops |
| `wa_flags` / `wa_settings` / `wa_webhooks` / `wa_sla` / `wa_rules` / `wa_media` | `010`–`018` | Config + media |
| `omni_contacts/conversations/messages/suggestions` | `server/migrations/omni/` | Unified inbox |
| `omni_ai_jobs` (`wa_crm_sync`, …) | Omni AI migrations | Durable CRM sync |
| `identity.user_drive_config` | supabase migration `20260624000001` | Per-user Drive folder id |

## 11. Environment variables

See [`knowledge/04-env-and-secrets.md`](./knowledge/04-env-and-secrets.md). Names only.

**WA:** `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `PUBLIC_BASE_URL`, `WA_*`, `OMNI_WA_*`, `API_AUTH_TOKEN`, `DATABASE_URL`.

**Drive:** `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `DRIVE_QUOTE_FOLDER_ID`.

**Intersection 🔴:** no `WA_DRIVE_*` vars. No Drive folder dedicated to WA knowledge.

## 12. Tests (selected)

| File | Purpose |
|------|---------|
| `tests/whatsappOutboundUnified.test.js` | Single Graph sender |
| `tests/wa-ingest-contract.js` · `wa-enricher.test.js` | Ingest / enricher |
| `tests/omniWa*.test.js` | Omni WA parity |
| `tests/quoteDriveArchiveAuth.test.js` · `drive-config-routes.test.js` · `enviosDrive.test.js` | Drive archive / config / envíos |
| `tests/googleDriveScopeError.test.js` | `drive.file` insufficient-scope |
| `tests/waDriveKnowledgePack.test.js` | This knowledge pack |
| `tests/agentGolden/cases/12-canal-wa-corto.json` · `16-canal-whatsapp-precio.json` | Golden WA channel |

---

*Maintenance: when a WA/Drive file, flag default, or route is added, update this map in the same PR.*
