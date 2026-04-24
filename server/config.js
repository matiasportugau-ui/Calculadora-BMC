import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const bool = (value, fallback = false) => {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
};

const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3001";
const isCloudRun = process.env.K_SERVICE || /\.run\.app$/i.test(publicBaseUrl);

export const config = {
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  publicBaseUrl,
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
  /** Repo hermano IMAP / PANELSIM (opcional; default = carpeta hermana) */
  bmcEmailInboxRepo: process.env.BMC_EMAIL_INBOX_REPO || "",
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
  // AI providers — suggest-response endpoint
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  openaiRealtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview",
  /** Panelin calculator chat (/api/agent/chat) — model IDs must match server allowlist or these defaults */
  anthropicChatModel: process.env.ANTHROPIC_CHAT_MODEL || "claude-opus-4-7",
  /** Set CHAT_LOG_CONVERSATIONS=true to persist conversation turns to disk in production. Default: off (devMode always logs). */
  chatLogConversations: bool(process.env.CHAT_LOG_CONVERSATIONS, false),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash",
  grokApiKey: process.env.GROK_API_KEY || "",
  grokChatModel: process.env.GROK_CHAT_MODEL || "grok-3-mini",
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
  /** Postgres — Modo Transportista (viajes / eventos / outbox) */
  databaseUrl: process.env.DATABASE_URL || "",
  /** Meta App Secret — HMAC para POST /webhooks/whatsapp (recomendado prod) */
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET || "",
  /** Bucket GCS para evidencias firmadas (opcional) */
  transportistaGcsBucket: process.env.TRANSPORTISTA_GCS_BUCKET || "",
  transportistaDriverTokenTtlHours: Number(process.env.TRANSPORTISTA_DRIVER_TOKEN_TTL_HOURS || 24),
  transportistaOutboxIntervalMs: Number(process.env.TRANSPORTISTA_OUTBOX_INTERVAL_MS || 15000),
  transportistaStrictPod: bool(process.env.TRANSPORTISTA_STRICT_POD, false),
  /** GCS bucket for persistent quote PDFs — allUsers:objectViewer required. Default: bmc-cotizaciones */
  gcsQuotesBucket: process.env.GCS_QUOTES_BUCKET || "bmc-cotizaciones",
  /** Allowed CORS origins — comma-separated. Defaults to Vercel prod + local dev. */
  corsOrigins: (
    process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : ["https://calculadora-bmc.vercel.app", "http://localhost:5173", "http://localhost:3001"]
  ),
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
