# Email / Omni Inbox — Canonical Source Map

**Purpose:** the single index of every file, endpoint, script, doc, env var, and table that makes up
the Email channel and the Omni unified inbox. **Read this first** before touching inbox/email code —
it is the "company-knowledge-first" grounding map referenced by
[`INBOX-AI-FIRST-BLUEPRINT.md`](./INBOX-AI-FIRST-BLUEPRINT.md) and the master prompt
([`docs/prompts/BMC_EMAIL_PANELSIM_COMPANY_KNOWLEDGE_FIRST_AGENT_PROMPT_V5.md`](../prompts/BMC_EMAIL_PANELSIM_COMPANY_KNOWLEDGE_FIRST_AGENT_PROMPT_V5.md)).

**Verified at commit `73bf15b` (2026-06-30).** Status: 🟢 live · 🟡 partial/dormant · 🔴 missing.
Every path below was confirmed to exist; if you add a file, add it here.

> **Architectural rule of thumb (committed):** Postgres `omni_*` = operational source of truth;
> Sheets `CRM_Operativo` = business-editable mirror. Single canonical writer per destination.
> Human approval gate on every outbound message. Never log secrets/PII.

---

## 1. AI brain (shared across all channels)

| File | Purpose | Status |
|---|---|---|
| `server/lib/agentCore.js` | `callAgentOnce()` — single AI entry point; channel rules, provider chain, cost. | 🟢 |
| `server/lib/agentTools.js` | 65 channel-aware tools; write-confirmation gates. | 🟢 |
| `server/lib/aiProviderConfig.js` | Provider/model registry, allowlist, cost table, fast vs. quality tiers. | 🟢 |
| `server/lib/rag.js` · `server/lib/embeddings.js` | pgvector retrieval over historical quotes. | 🟡 `RAG_ENABLED` off |
| `server/lib/brainKB.js` · `server/lib/trainingKB.js` · `server/lib/autoLearnExtractor.js` | Accumulated-knowledge brain + KB + auto-learn. | 🟢 (brain flag-gated) |
| `scripts/training/embedQuotes.js` | One-off backfill of quote embeddings for RAG. | 🟢 |

## 2. Omni unified inbox (Postgres-backed SoT)

| File | Purpose | Status |
|---|---|---|
| `server/routes/omni.js` | 25-endpoint Omni API; `PATCH /api/omni/conversations/:id`; copilot assist. | 🟢 |
| `server/lib/omni/orchestrator/{aiRegistry,aiWorker,automationEngine,automationConditions,suggestions,bootstrap}.js` | Async AI jobs (classify/suggest/extract), rules, budget cap. | 🟡 `OMNI_AI_ORCHESTRATOR_ENABLED` off |
| `server/lib/omni/adapters/{emailIngest,mlCrmRow,waExtension,waWebhook,mlOutboundMirror}.js` | Inbound normalizers → `omni_*`. | 🟡 email/WA wired; ML inbound partial |
| `server/lib/omni/outbound/{emailReply,mlReply,waReply}.js` | Unified channel reply senders. | 🟢 |
| `server/lib/omni/{normalizer,omniDb,eventBus,conversationPatch,conversationStatus,snoozeWorker,omniMetrics}.js` | Core helpers, event bus, status/patch validation, snooze, metrics. | 🟢 |
| `src/components/hub/canales/CanalesModule.jsx` | `/hub/canales` shell + tabs (Omni Inbox / Cockpit / Deals / ML / WA / Contactos). | 🟢 |
| `src/components/hub/canales/{OmniInboxPanel,OmniThreadPanel,OmniContactSidebar,OmniDealsKanban,UnifiedContactsPanel,OmniAdminCockpit,MlManagerPanel,WaInboxPanel}.jsx` | Inbox UI panels. | 🟢 Fases 1+2; 🟡 full-desk tier |
| `src/components/hub/canales/{omniFormat.js,cannedReplies.js,omniInbox.css}` · `src/hooks/useOmniConversations.js` | UI helpers + data hook. | 🟢 |

## 3. Email channel (ingest + reply)

| File | Purpose | Status |
|---|---|---|
| `server/routes/bmcDashboard.js` | Email routes: `parse-email`, `ingest-email`, `poll-gmail`, `panelsim-summary`, `draft-outbound`. | 🟢 |
| `server/lib/emailLeadIngest.js` | 12-field Zod AI lead extraction (4-provider fallback). | 🟢 |
| `server/lib/emailIngestAuth.js` | Machine auth (`EMAIL_INGEST_TOKEN`/`API_AUTH_TOKEN`; 503/401). | 🟢 |
| `server/lib/emailIngestDb.js` | Idempotency log access (`public.email_ingest_log`). | 🟢 |
| `server/lib/gmailPoll.js` · `server/lib/gmailSend.js` | Server-side Gmail poll + RFC822 send. | 🟢 |
| `server/lib/emailReply.js` | Threaded outbound (Gmail API preferred, per-casilla SMTP fallback). | 🟢 |
| `server/lib/crmOperativoLayout.js` | CRM_Operativo layout; `defaultTailAGAK_Email()` AG–AK gate defaults. | 🟢 |
| `server/lib/emailSnapshotIngest.js` · `server/lib/emailInboxRepoResolve.js` | Legacy IMAP snapshot ingest (sibling repo). | 🟡 to be demoted to backfill |
| `server/lib/marketIntel/alerts/email.js` | SMTP nodemailer alerts (`sendEmailAlert`). | 🟢 |

## 4. Chatwoot shared inbox + in-app Email Agent (dormant)

| File | Purpose | Status |
|---|---|---|
| `server/lib/chatwootClient.js` · `server/routes/chatwoot.js` | Chatwoot REST client + `POST /api/chatwoot/webhook` (secret-verified, dedupe). | 🟡 `CHATWOOT_*` unset → 503 |
| `server/lib/emailAgentTools.js` · `server/routes/emailAgentChat.js` | 11 `email_*` tools + `POST /api/email-agent/chat` (SSE). | 🟡 |
| `src/components/EmailAgentPanel.jsx` | In-app email assistant (right panel). | 🟡 `VITE_FEATURE_EMAIL_AGENT` off |

## 5. Webhooks (inbound)

| Route | Purpose | Status |
|---|---|---|
| `server/routes/webhooks.js` → `POST /webhooks/whatsapp` | WA ingest + auto-suggestion loop (HMAC-verified). | 🟢 |
| `server/routes/webhooks.js` → `POST /webhooks/ml` | ML signature verified; **body processing TODO**. | 🔴 |
| `server/routes/webhooks.js` → `POST /webhooks/shopify` | Shopify product/order sync. | 🟢 |

## 6. Scripts & npm

| Script | npm | Purpose | Status |
|---|---|---|---|
| `scripts/email-snapshot-ingest.mjs` | `email:ingest-snapshot` | Snapshot JSON → `/api/crm/ingest-email` (dedupe, `--dry-run`). | 🟢 |
| `scripts/panelsim-email-ready.sh` | `panelsim:email-ready` | Resolve sibling repo, sync, print report paths. | 🟢 |
| `scripts/resolve-email-inbox-repo.sh` · `scripts/open-email-inbox-env.sh` · `scripts/ensure-panelsim-sheets-env.sh` | `panelsim:env` | Sibling-repo path/env resolution. | 🟢 |
| `scripts/omni-backfill-email-crm.mjs` | — | Backfill CRM email rows → Omni (SoT migration helper). | 🟢 |
| `scripts/training/embedQuotes.js` | — | RAG embeddings backfill. | 🟢 |

## 7. Cursor skills

| Skill | Purpose |
|---|---|
| `.cursor/skills/panelsim-email-inbox/SKILL.md` | Canonical PANELSIM email-inbox orchestration (resolve sibling repo, sync, read reports). |
| `.cursor/skills/networks-development-agent/SKILL.md` | Networks + email-as-inbound-channel (Gmail/IMAP/webhooks/OAuth). |
| `.cursor/rules/bmc-email-company-knowledge-first.mdc` | Grounding rule pointing agents to this map + the master prompt + invariants. |

## 8. Docs, runbooks, OpenAPI

| Doc | Purpose |
|---|---|
| [`INBOX-AI-FIRST-BLUEPRINT.md`](./INBOX-AI-FIRST-BLUEPRINT.md) | Target architecture + phased roadmap (this map's parent). |
| [`OMNI-HUB-ARCHITECTURE.md`](./OMNI-HUB-ARCHITECTURE.md) | **Superseded** by the blueprint (frozen 2026-06-21). |
| [`ARCHITECTURE-CHANNELS-COTIZACIONES.md`](./ARCHITECTURE-CHANNELS-COTIZACIONES.md) | Module-by-module architecture of `/hub/{canales,wa,ml-manager,ml,cotizaciones}`. |
| [`runbooks/email-ingest-cron.md`](./runbooks/email-ingest-cron.md) · [`runbooks/email-cloud-run-poller.md`](./runbooks/email-cloud-run-poller.md) · [`runbooks/chatwoot-email-agent-setup.md`](./runbooks/chatwoot-email-agent-setup.md) | Operational runbooks. |
| `docs/team/panelsim/{EMAIL-ADMINISTRATOR,EMAIL-WORKSPACE-SETUP,EMAIL-BMC2-CONFIG-NOTES,GPT-EMAIL-AGENT-BUILDER,EMAIL-GPT-THUNDERBIRD-WORKFLOW,EMAIL-MULTI-COMPUTER-THUNDERBIRD,EMAIL-PANELSIM-CHAT-VERIFY,EMAIL-THUNDERBIRD-MULTI-MACHINE-CHECKLIST}.md` | PANELSIM email role/setup/GPT docs. |
| `docs/openapi-email-gpt.yaml` | OpenAPI for the email-only GPT (`panelsim-summary`, `draft-outbound`). |
| [`docs/transformation/12-migration-strategy.md`](../transformation/12-migration-strategy.md) · [`docs/discovery/02-channel-map.md`](../discovery/02-channel-map.md) | SoT migration strategy + channel audit. |

## 9. Postgres tables & migrations

| Object | Migration | Purpose |
|---|---|---|
| `omni_contacts/conversations/messages/suggestions` | `server/migrations/omni/001_core.sql` | Core unified model. |
| `omni_ai_jobs/prompt_registry/model_registry`, `omni_automation_rules/runs` | `002_ai_automation.sql`, `005_seed_ai_registry.sql` | AI orchestration + rules. |
| `omni_deals`, knowledge | `003_deals_knowledge.sql`, `004_deals_properties_patch.sql` | Deals + knowledge. |
| Conversations properties / category fixes | `006`, `007`, `008_email_channel_constraint.sql` | Email channel + category constraints. |
| `omni_teams`, `omni_team_members`, `omni_email_accounts`; `omni_conversations.{receiving_account_id,assigned_to_user_id,assigned_at,team_id,snoozed_until,first_agent_reply_at}` | `009_email_manager_multi.sql` | Multi-account email, teams, assignment, FRT, snooze. |
| `omni_notes` (`conversation_id`,`author_user_id`,`author_label`,`body`) | `010_omni_notes.sql` | Internal thread notes. |
| `public.email_ingest_log` (`message_key` PK, `account`, `message_id`, `remitente`, `crm_row`, `ingested_at`) | `supabase/migrations/20260625000001_email_ingest_log.sql` | Inbound email idempotency guard. |

## 10. Environment variables & feature flags

| Var / flag | Effect |
|---|---|
| `EMAIL_INGEST_TOKEN` (fallback `API_AUTH_TOKEN`) | Ingest auth; unconfigured → 503, bad token → 401. |
| `GMAIL_OAUTH_CLIENT_ID/SECRET`, `GMAIL_INGEST_REFRESH_TOKEN`, `GMAIL_SEND_FROM`, `GMAIL_INGEST_ADDRESSES` | Gmail poll/send config; absent → 503. |
| `SMTP_HOST/PORT/USER/PASS`, per-casilla `EMAIL_<CASILLA>_PASS` | SMTP reply fallback + alerts. |
| `BMC_EMAIL_INBOX_REPO` | Path to sibling repo `conexion-cuentas-email-agentes-bmc`. |
| `RAG_ENABLED`, `RAG_TOP_K`, `RAG_THRESHOLD` | RAG grounding (default off). |
| `OMNI_WA_SHADOW_WRITE`, `OMNI_ML_SHADOW_WRITE`, `OMNI_EMAIL_SHADOW_WRITE` | Channel shadow-write into Omni (default off). |
| `OMNI_EVENT_BUS_ENABLED`, `OMNI_AI_ORCHESTRATOR_ENABLED`, `OMNI_AI_DAILY_BUDGET_USD` | Orchestrator + AI spend cap. |
| `VITE_OMNI_INBOX`, `VITE_OMNI_DEALS`, `VITE_FEATURE_EMAIL_AGENT`, `VITE_FEATURE_BRAIN` | Frontend surface flags (default off). |
| `CHATWOOT_API_TOKEN`, `CHATWOOT_WEBHOOK_SECRET`, ids | Chatwoot shared inbox; unset → routes 503. |

---

*Maintenance: when a file/endpoint/table is added or a flag changes default, update this map in the
same PR. This is the index the AI agents and human contributors trust as ground truth.*
