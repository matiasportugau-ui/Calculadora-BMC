import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const bool = (value, fallback = false) => {
  if (value == null || value === "") return fallback;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  return fallback;
};

const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3001";
const isCloudRun = process.env.K_SERVICE || /\.run\.app$/i.test(publicBaseUrl);
// Vite SPA host (different from publicBaseUrl, which is the Express API host).
// Used by OAuth flows whose callback runs on the backend but must bounce the
// user to the frontend afterwards (e.g. /auth/tasks/callback → /hub/tareas).
const frontendBaseUrl =
  process.env.FRONTEND_BASE_URL || "https://calculadora-bmc.vercel.app";

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const panelinRelaxDevAuthExplicit = /^(1|true|yes)$/i.test(
  String(process.env.PANELIN_RELAX_DEV_AUTH || "").trim(),
);

export const config = {
  appEnv,
  port: Number(process.env.PORT || 3001),
  publicBaseUrl,
  frontendBaseUrl,
  mlClientId: process.env.ML_CLIENT_ID || "742811153438318",
  mlClientSecret: process.env.ML_CLIENT_SECRET || "",
  mlAuthBase: process.env.ML_AUTH_BASE || "https://auth.mercadolibre.com.uy",
  mlApiBase: process.env.ML_API_BASE || "https://api.mercadolibre.com",
  /** Sitio ML (preguntas / búsquedas). UY = MLU. Ver https://api.mercadolibre.com/sites */
  mlSiteId: process.env.ML_SITE_ID || "MLU",
  mlRedirectUriDev:
    process.env.ML_REDIRECT_URI_DEV || "http://localhost:3001/auth/ml/callback",
  mlRedirectUriProd:
    process.env.ML_REDIRECT_URI_PROD ||
    (isCloudRun ? `${publicBaseUrl.replace(/\/$/, "")}/auth/ml/callback` : ""),
  useProdRedirect: bool(process.env.ML_USE_PROD_REDIRECT, isCloudRun),
  tokenFile: process.env.ML_TOKEN_FILE || path.resolve(".ml-tokens.enc"),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "",
  // GCS backend for Cloud Run (persistent tokens)
  tokenStorage:
    process.env.ML_TOKEN_STORAGE ||
    (isCloudRun && process.env.ML_TOKEN_GCS_BUCKET ? "gcs" : "file"),
  tokenGcsBucket: process.env.ML_TOKEN_GCS_BUCKET || "",
  tokenGcsObject: process.env.ML_TOKEN_GCS_OBJECT || "ml-tokens.enc",
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
  maxRetries: Number(process.env.ML_HTTP_MAX_RETRIES || 3),
  requestTimeoutMs: Number(process.env.ML_HTTP_TIMEOUT_MS || 15000),
  apiAuthToken: process.env.API_AUTH_TOKEN || process.env.API_KEY || "",
  /**
   * Development-only: skip API_AUTH_TOKEN checks on Panelin developer routes (chat devMode,
   * training KB, prompt editor, conversation stats). Auto-on when appEnv=development (local API);
   * override with PANELIN_RELAX_DEV_AUTH=1 on trusted staging only — never on public production.
   */
  panelinRelaxDevAuth: appEnv === "development" || panelinRelaxDevAuthExplicit,
  /**
   * Opcional — POST /api/crm/ingest-email: si está definido, el bridge IMAP puede usar solo este secreto
   * (además de API_AUTH_TOKEN). Ver docs/team/panelsim/EMAIL-ADMINISTRATOR.md
   */
  emailIngestToken: process.env.EMAIL_INGEST_TOKEN || "",
  /** Repo hermano IMAP / PANELSIM (opcional; default = carpeta hermana) */
  bmcEmailInboxRepo: process.env.BMC_EMAIL_INBOX_REPO || "",
  /**
   * Chatwoot CE — shared operator inbox + in-app Email Agent (off-stack via REST/webhooks).
   * All optional: with these unset the Chatwoot webhook + Email Agent routes degrade to 503
   * and the app still boots. See docs/team/runbooks/chatwoot-email-agent-setup.md.
   */
  chatwootApiBase: process.env.CHATWOOT_API_BASE || "",
  chatwootApiToken: process.env.CHATWOOT_API_TOKEN || "",
  chatwootAccountId: process.env.CHATWOOT_ACCOUNT_ID || "",
  chatwootInboxId: process.env.CHATWOOT_INBOX_ID || "",
  chatwootWebhookSecret: process.env.CHATWOOT_WEBHOOK_SECRET || "",
  chatwootPostNote: /^(1|true|yes|on)$/i.test(String(process.env.CHATWOOT_POST_NOTE ?? "true").trim()),
  chatwootPostDraft: /^(1|true|yes|on)$/i.test(String(process.env.CHATWOOT_POST_DRAFT ?? "false").trim()),
  /** Self base URL for server-to-server loopback (defaults to 127.0.0.1:PORT). */
  selfBaseUrl: process.env.SELF_BASE_URL || "",
  // BMC Finanzas dashboard (Google Sheets)
  bmcSheetId: process.env.BMC_SHEET_ID || "",
  bmcPagosSheetId: process.env.BMC_PAGOS_SHEET_ID || "",
  bmcCalendarioSheetId: process.env.BMC_CALENDARIO_SHEET_ID || "",
  bmcVentasSheetId: process.env.BMC_VENTAS_SHEET_ID || "",
  bmcStockSheetId: process.env.BMC_STOCK_SHEET_ID || "",
  // Wolfboard — Admin 2.0 ↔ CRM sync (dashboard :3849)
  wolfbAdminSheetId: process.env.WOLFB_ADMIN_SHEET_ID || "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0",
  wolfbAdminTab: process.env.WOLFB_ADMIN_TAB || "Admin.",
  wolfbCrmMainTab: process.env.WOLFB_CRM_MAIN_TAB || "CRM_Operativo",
  /** Libro CRM (crm_automatizado). Vacío = mismo que bmcSheetId. */
  wolfbCrmSheetId: process.env.WOLFB_CRM_SHEET_ID || "",
  wolfbCrmEnviadosTab: process.env.WOLFB_CRM_ENVIADOS_TAB || "Enviados",
  /** Dual-write Lead → Admin Cotizaciones tab "Enviados" (opt-in; default off). */
  wolfbAdminCotDualWriteEnabled: bool(process.env.WOLFB_ADMIN_COT_DUAL_WRITE, false),
  wolfbAdminCotEnviadosTab: process.env.WOLFB_ADMIN_COT_ENVIADOS_TAB || "Enviados",
  wolfbDryRun: process.env.WOLFB_DRY_RUN === "1",
  wolfbRitualLog: process.env.WOLFB_RITUAL_LOG === "1",
  wolfbCalcApiBase: process.env.WOLFB_CALC_API_BASE || "",
  /** Primera fila de datos H:K en Admin 2.0 (default 2). */
  wolfbAdminFirstDataRow: Number(process.env.WOLFB_ADMIN_FIRST_DATA_ROW || process.env.WOLFB_ADMIN_DATA_ROW || 2),
  /** MATRIZ de COSTOS y VENTAS 2026 — workbook canónico (Google Sheets nativo). */
  bmcMatrizSheetId:
    process.env.BMC_MATRIZ_SHEET_ID || "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo",
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  /** JSONL Panelin Knowledge (events-log); default docs/team/knowledge/events-log.jsonl */
  aiKnowledgeEventsLog: process.env.AI_KNOWLEDGE_EVENTS_LOG || "",
  bmcSheetSchema: process.env.BMC_SHEET_SCHEMA || "Master_Cotizaciones",
  bmcAuditTab: process.env.BMC_AUDIT_TAB || "AUDIT_LOG",
  /** Tab para reportes de bugs desde la UI (con logs y contexto). Ops debe crear la pestaña con headers una vez. */
  bugReportsTab: process.env.BMC_BUG_REPORTS_TAB || "BUG_REPORTS",
  bmcPagosTab: process.env.BMC_PAGOS_TAB || "Pagos_Pendientes",
  bmcMetasTab: process.env.BMC_METAS_TAB || "Metas_Ventas",
  bmcCalendarioTab: process.env.BMC_CALENDARIO_TAB || "Calendario de Vencimientos",
  // AI providers — suggest-response endpoint
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  openaiRealtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview",
  /** Panelin calculator chat (/api/agent/chat) — model IDs must match server allowlist or these defaults */
  anthropicChatModel: process.env.ANTHROPIC_CHAT_MODEL || "claude-opus-4-7",
  /** Set CHAT_LOG_CONVERSATIONS=true to persist conversation turns to disk in production. Default: off (devMode always logs). */
  chatLogConversations: bool(process.env.CHAT_LOG_CONVERSATIONS, false),
  // Soft per-session budget for /api/agent/chat. Default OFF — see docs/team/runbooks/PANELIN-IA-OPS.md §4.
  budgetEnabled: bool(process.env.BUDGET_ENABLED, false),
  budgetTurnsPerMin: process.env.BUDGET_TURNS_PER_MIN ? Number(process.env.BUDGET_TURNS_PER_MIN) : null,
  budgetTurnsPer5Min: process.env.BUDGET_TURNS_PER_5MIN ? Number(process.env.BUDGET_TURNS_PER_5MIN) : null,
  budgetTurnsPer24h: process.env.BUDGET_TURNS_PER_24H ? Number(process.env.BUDGET_TURNS_PER_24H) : null,
  budgetTokensPer24h: process.env.BUDGET_TOKENS_PER_24H ? Number(process.env.BUDGET_TOKENS_PER_24H) : null,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash", // 2.0-flash retired by Google 2026-06 (404 "no longer available"); 2.5-flash is the live model. Used by the SSE chat streaming path (agentChat.js) + visionExtract.
  grokApiKey: process.env.GROK_API_KEY || "",
  grokChatModel: process.env.GROK_CHAT_MODEL || "grok-3-mini",
  // Vercel AI Gateway (unified multi-provider).
  // Set AI_GATEWAY_API_KEY (or rely on VERCEL_OIDC_TOKEN populated via `vercel env pull`)
  // to route /crm/suggest-response, /crm/parse-email, /crm/ingest-email, and
  // /agent/training-kb/generate-ml-overrides through the gateway. When unset,
  // the legacy 4-SDK chain (Anthropic / OpenAI / Grok / Gemini) keeps working
  // unchanged so deploys without env wiring don't regress.
  aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY || "",
  // WhatsApp Business Cloud API
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  // Shopify (questions/quotes flow – Mercado Libre replacement)
  shopifyClientId: process.env.SHOPIFY_CLIENT_ID || "",
  shopifyClientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
  shopifyScopes:
    process.env.SHOPIFY_SCOPES ||
    "read_products,write_products,read_orders,write_orders,read_customers,read_draft_orders,write_draft_orders",
  shopifyWebhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || "",
  shopifyQuestionsSheetTab: process.env.SHOPIFY_QUESTIONS_SHEET_TAB || "Shopify_Preguntas",
  /**
   * Postgres connection string. Usado por:
   * - Modo Transportista (viajes / eventos / outbox) — `transportista-cursor-package/migrations/`.
   * - WA Cockpit (`wa_conversations`, `wa_messages`, `wa_suggestions`) — `wa-package/migrations/`.
   *
   * Si falta: ambos módulos devuelven 503 en sus endpoints; el resto del API (calc, Sheets, ML) sigue funcionando.
   * En Cloud Run: secret manager (no env-var directa). En local: `.env` (ver `.env.example`).
   * (Top-20 run 2026-05-11 #L10: doc ampliado para reflejar el doble uso.)
   */
  databaseUrl: process.env.DATABASE_URL || "",
  /** Google Tasks OAuth 2.0 client (separate from identity.authGoogle login OAuth) */
  googleTasksClientId: process.env.GOOGLE_TASKS_CLIENT_ID || "",
  googleTasksClientSecret: process.env.GOOGLE_TASKS_CLIENT_SECRET || "",
  /** PGP symmetric key used by pgp_sym_encrypt/decrypt in tasks.oauth_tokens */
  supabasePgpEncryptKey: process.env.SUPABASE_PGP_ENCRYPT_KEY || "",
  /** Static HMAC secret sent as X-Sync-Signature header by Cloud Scheduler */
  syncHmacSecret: process.env.SYNC_HMAC_SECRET || "",
  /**
   * Tareas Phase D — Google Calendar pairing for time-of-day + recurrence.
   * Reuses the Google Tasks OAuth client (with the added calendar.events scope).
   *   googleCalendarEnabled        — master kill-switch; off ⇒ tasks never pair a Calendar event.
   *   googleCalendarTimeZone       — IANA TZ for timed (dateTime) events.
   *   googleCalendarDefaultDurationMin — event length when a task has a time but no explicit end.
   */
  googleCalendarEnabled: bool(process.env.GOOGLE_CALENDAR_ENABLED, true),
  googleCalendarTimeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/Montevideo",
  googleCalendarDefaultDurationMin: Number(
    process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MIN || 30,
  ),
  /** Meta App Secret — HMAC para POST /webhooks/whatsapp (recomendado prod) */
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  /**
   * Email reply (CRM cockpit, origen=Email) — fallback casilla id used when the
   * receiving casilla is unknown for a row. Per-casilla SMTP is resolved from the
   * sibling repo's config/accounts.json (`smtp` block, reusing EMAIL_<CASILLA>_PASS).
   */
  emailReplyDefaultCasilla: process.env.EMAIL_REPLY_DEFAULT_CASILLA || "bmc-ventas",
  /**
   * Gmail-API send (user-OAuth) — preferred reply transport now that the Netuy
   * SMTP boxes are dead (domain moved to Cloudflare→Gmail). Token is minted by
   * the sibling pipeline's `gmail-auth` (scope gmail.send) on the dedicated
   * GMAIL_OAUTH_CLIENT_ID/SECRET client (separate from Drive to avoid mutual
   * refresh-token revocation). Optional GMAIL_SEND_FROM must be a verified
   * "Send mail as" alias on the authenticated account, else Gmail stamps it.
   */
  gmailSendConfigured: Boolean(
    process.env.GMAIL_INGEST_REFRESH_TOKEN &&
      process.env.GMAIL_OAUTH_CLIENT_ID &&
      process.env.GMAIL_OAUTH_CLIENT_SECRET,
  ),
  gmailSendFrom: process.env.GMAIL_SEND_FROM || "",
  /**
   * Gmail ingest poller (POST /api/email/poll-gmail, GitHub Actions cron) —
   * exact recipient allowlist of the BMC business boxes. Gmail's `to:` search
   * is fuzzy, so server-side header matching is the real gate. Comma-separated.
   */
  gmailIngestAddresses: process.env.GMAIL_INGEST_ADDRESSES || "",
  /** Bucket GCS para evidencias firmadas (opcional) */
  transportistaGcsBucket: process.env.TRANSPORTISTA_GCS_BUCKET || "",
  transportistaDriverTokenTtlHours: Number(process.env.TRANSPORTISTA_DRIVER_TOKEN_TTL_HOURS || 24),
  transportistaOutboxIntervalMs: Number(process.env.TRANSPORTISTA_OUTBOX_INTERVAL_MS || 15000),
  transportistaStrictPod: bool(process.env.TRANSPORTISTA_STRICT_POD, false),
  /** TraKtiMe — time tracking + invoicing. Reuses databaseUrl. */
  traktimeSheetId: process.env.TRAKTIME_SHEET_ID || "",
  traktimeMirrorTz: process.env.TRAKTIME_MIRROR_TZ || "America/Montevideo",
  traktimeMirrorEnabled: bool(process.env.TRAKTIME_MIRROR_ENABLED, true),
  traktimeInvoiceIssuerName:
    process.env.TRAKTIME_INVOICE_ISSUER_NAME || "METALOG SAS — BMC Uruguay",
  traktimeInvoiceIssuerRut: process.env.TRAKTIME_INVOICE_ISSUER_RUT || "21XXXXXXXXXX",
  traktimeInvoiceIssuerAddress:
    process.env.TRAKTIME_INVOICE_ISSUER_ADDRESS || "Direccion pendiente, Montevideo, Uruguay",
  traktimeInvoiceGcsBucket:
    process.env.TRAKTIME_INVOICE_GCS_BUCKET || process.env.GCS_QUOTES_BUCKET || "bmc-cotizaciones",
  /**
   * ActivityWatch (passive OS observation) — strictly OPT-IN, OFF by default.
   * Only meaningful where the API is co-located with a local aw-server (dev /
   * self-host on the operator's machine). In Cloud Run this stays disabled.
   */
  traktimeAwEnabled: bool(process.env.TRAKTIME_AW_ENABLED, false),
  traktimeAwBaseUrl: process.env.TRAKTIME_AW_BASE_URL || "http://localhost:5600",
  todoistApiToken: process.env.TODOIST_API_TOKEN || "",
  todoistBmcProjectId: process.env.TODOIST_BMC_PROJECT_ID || "6grV9QhFpvPJ79hx",
  /** WA Cockpit (F2 enricher) — flags */
  waEnricherEnabled: bool(process.env.WA_ENRICHER_ENABLED, false),
  waEnricherIntervalMs: Number(process.env.WA_ENRICHER_INTERVAL_MS || 8000),
  waEnricherBatchSize: Number(process.env.WA_ENRICHER_BATCH_SIZE || 5),
  /** WA Cockpit (F4 outbound) — rate limit */
  waOutboundRateLimitPerMin: Number(process.env.WA_OUTBOUND_RATE_LIMIT || 6),
  /** WA Cockpit (F5 purge) — TTL días para wa_messages.text */
  waTtlDays: Number(process.env.WA_TTL_DAYS || 180),
  /** GCS bucket for persistent quote PDFs — allUsers:objectViewer required. Default: bmc-cotizaciones */
  gcsQuotesBucket: process.env.GCS_QUOTES_BUCKET || "bmc-cotizaciones",
  /** Drive folder for uploaded quote HTML files (server/lib/driveUpload.js) */
  driveQuoteFolderId: process.env.DRIVE_QUOTE_FOLDER_ID || "",
  /** Allowed CORS origins — comma-separated. Defaults to Vercel prod + local dev. */
  corsOrigins: (
    process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : ["https://calculadora-bmc.vercel.app", "http://localhost:5173", "http://localhost:3001"]
  ),
  /** Comprador identity (Phase A+) — JWT signing + cookie domain + Google OAuth aud */
  identityJwtSecret: process.env.IDENTITY_JWT_SECRET || "",
  identityCookieDomain: process.env.IDENTITY_COOKIE_DOMAIN || "",
  identityCookieName: process.env.IDENTITY_COOKIE_NAME || "bmc_sess",
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  /** Sheets sync — opt-in admin sync to «Base de datos cotis de clientes» */
  sheetsClientQuotesEnabled: bool(process.env.SHEETS_CLIENT_QUOTES_ENABLED, false),
  sheetsClientQuotesTab: process.env.SHEETS_CLIENT_QUOTES_TAB || "Base de datos cotis de clientes",
  /**
   * Comma-separated emails seeded as superadmin (Phase G).
   *
   * **NEVER consult this list at runtime**: the privilege check in
   * `identityAuth.requireUser` reads `identity.role_grants` from the DB
   * exclusively. This array is consumed ONLY by the operator running
   *
   *     psql -v admins="$INTERNAL_SUPERADMIN_EMAILS" \
   *          -f supabase/migrations/20260601000002_identity_seed_superadmins.sql
   *
   * cursor[bot] round-7 W-3 invariant: a misconfigured env var (e.g.
   * trailing comma → empty entry → match-all) MUST NOT silently grant
   * superadmin. Bypassing the DB grant check from this list would create
   * a privilege-escalation window. Keep this array unused at request
   * time; if you need a runtime check, add a separate function that
   * reads role_grants from the DB.
   */
  internalSuperadminEmails: (
    process.env.INTERNAL_SUPERADMIN_EMAILS
      ? process.env.INTERNAL_SUPERADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : []
  ),
  /** KB Analytics — log missed questions for human review (opt-in; default off) */
  kbAnalyticsLogMissQuestion: bool(process.env.KB_ANALYTICS_LOG_MISS_QUESTION, false),
  /** KB Analytics — window size in days for metrics (default 30, max 365) */
  kbAnalyticsWindowMaxDays: Math.max(1, Math.min(Number(process.env.KB_ANALYTICS_WINDOW_MAX_DAYS || 90), 365)),
  /**
   * RAG v1 — recuperación de cotizaciones históricas similares vía pgvector.
   * Default OFF: activar solo después de correr la migración 0001 y embedQuotes.js.
   * Ver docs/sprint-mayo/RAG-V1.md § Checklist de activación.
   */
  ragEnabled: bool(process.env.RAG_ENABLED, false),
  /** Número de cotizaciones similares a recuperar por turno (default 5). */
  ragTopK: Math.max(1, Math.min(10, Number(process.env.RAG_TOP_K || 5))),
  /** Similitud mínima coseno para incluir un caso (0-1, default 0.70). */
  ragThreshold: Math.max(0, Math.min(1, Number(process.env.RAG_THRESHOLD || 0.70))),
  /** Omni Core — cross-channel inbox shadow writes (default OFF in prod) */
  omniWaShadowWrite: bool(process.env.OMNI_WA_SHADOW_WRITE, false),
  omniMlShadowWrite: bool(process.env.OMNI_ML_SHADOW_WRITE, false),
  omniEmailShadowWrite: bool(process.env.OMNI_EMAIL_SHADOW_WRITE, false),
  omniEventBusEnabled: bool(process.env.OMNI_EVENT_BUS_ENABLED, false),
  omniAiOrchestratorEnabled: bool(process.env.OMNI_AI_ORCHESTRATOR_ENABLED, false),
  omniAutomationEnabled: bool(process.env.OMNI_AUTOMATION_ENABLED, false),
  /**
   * WA "flip" (ADR-009 shadow→canonical). When ON, the Omni event bus is the
   * single WhatsApp processing path: the legacy in-memory map + 5-min timer +
   * duplicate callAgentOnce are gated off, and the legacy CRM-Sheets ingest +
   * auto-learn run as a durable `wa_crm_sync` job on the omni_ai_jobs queue.
   * Default OFF: ships dormant (webhook behavior byte-identical to today).
   * Instant rollback = flip back to OFF. Requires omniEventBusEnabled +
   * omniAiOrchestratorEnabled to be ON for the job pipeline to fire.
   */
  omniWaCanonical: bool(process.env.OMNI_WA_CANONICAL, false),
  /**
   * Inactivity window (ms) before a `wa_crm_sync` job runs — each new inbound WA
   * message re-stamps it, so the CRM row is created once the conversation burst
   * quiesces (full transcript), reproducing the legacy 5-min debounce on the queue.
   * Default 60s; clamp [0, 600000]. Only affects wa_crm_sync (other jobs run_after=NULL).
   */
  omniWaCrmSyncDelayMs: Math.max(0, Math.min(600000, Number(process.env.OMNI_WA_CRM_SYNC_DELAY_MS || 60000))),
  /**
   * Phase 2b — read-model convergence. When ON, the /hub/wa cockpit read endpoints
   * (/api/wa/conversations|messages|suggestions) read from the omni_* tables instead
   * of wa_*, mapped to the cockpit's existing shape. Default OFF: reads stay on wa_*.
   * Some fields are lossy (status enum, owner_op) — validate on staging before ON.
   */
  omniWaReads: bool(process.env.OMNI_WA_READS, false),
  omniAiDailyBudgetUsd: Math.max(0, Number(process.env.OMNI_AI_DAILY_BUDGET_USD || 50)),
  omniDealsSheetsAuthority: bool(process.env.OMNI_DEALS_SHEETS_AUTHORITY, true),
  otelEnabled: bool(process.env.OTEL_ENABLED, false),
  /**
   * AI Assistant control plane — master switch. Comma-separated allowlist of assistant keys
   * allowed to GENERATE AI responses. Anything not listed returns 503 assistant_disabled on its
   * AI-generation route (inbound ingest/webhooks stay ungated — no messages are lost).
   * Default `canales` in production; local API (appEnv=development) enables all assistants.
   * Keys: canales, panelin, email, wa, ml, wolfboard. `seam` (shared agentCore) is always enabled.
   * See server/lib/assistantRegistry.js for the registry.
   */
  assistantsActive: (process.env.ASSISTANTS_ACTIVE
    ? String(process.env.ASSISTANTS_ACTIVE)
    : appEnv === "development"
      ? "canales,panelin,email,wa,ml,wolfboard"
      : "canales")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  omniAiWorkerIntervalMs: Math.max(2000, Number(process.env.OMNI_AI_WORKER_INTERVAL_MS || 5000)),
  omniAiWorkerBatchSize: Math.max(1, Math.min(20, Number(process.env.OMNI_AI_WORKER_BATCH_SIZE || 5))),
  /**
   * FRT (first-response-time) breach tracker — periodic worker that records when an
   * open conversation crosses its per-channel SLA (server/lib/omni/urgency.js
   * DEFAULT_SLA_HOURS) without a first agent reply, and closes the breach out once
   * replied. Default OFF: the live "act now" signal already ships via
   * GET /omni/actions/urgent; this worker only adds a persisted historical/audit
   * trail (server/migrations/omni/012_frt_breaches.sql), useful for reporting once
   * enabled. Read-only signal, never sends anything.
   */
  omniFrtWorkerEnabled: bool(process.env.OMNI_FRT_WORKER_ENABLED, false),
  omniFrtWorkerIntervalMs: Math.max(30_000, Number(process.env.OMNI_FRT_WORKER_INTERVAL_MS || 300_000)),
  /**
   * Centralized AI brain (self-evolving, human-verified lessons) injected into the agent system prompt.
   * Default OFF: ships dormant. Flipping ON is customer-facing — do it deliberately after dev validation.
   * Source of truth = gs://bmc-ml-tokens/bmc-brain/lessons.json (shared with the sheet-quote pipeline).
   * BRAIN_LOCAL_PATH overrides with a local lessons.json for dev validation (no GCS needed).
   */
  brainEnabled: bool(process.env.VITE_FEATURE_BRAIN, false),
  brainGcsBucket: process.env.BRAIN_GCS_BUCKET || "bmc-ml-tokens",
  brainGcsObject: process.env.BRAIN_GCS_OBJECT || "bmc-brain/lessons.json",
  brainLocalPath: process.env.BRAIN_LOCAL_PATH || "",
  /** Max lessons injected per prompt (policies, not retrieval — top-N by confidence×overlap). */
  brainInjectCap: Math.max(1, Math.min(20, Number(process.env.BRAIN_INJECT_CAP || 10))),
};

export const redirectUri = () => {
  if (config.useProdRedirect) {
    if (!config.mlRedirectUriProd) {
      throw new Error("ML_REDIRECT_URI_PROD is required when ML_USE_PROD_REDIRECT=true");
    }
    return config.mlRedirectUriProd;
  }
  return config.mlRedirectUriDev;
};
