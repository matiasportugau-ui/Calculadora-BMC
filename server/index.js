import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { buildAgentCapabilitiesManifest } from "./agentCapabilitiesManifest.js";
import { buildVersionInfo } from "./lib/versionInfo.js";
import { syncUnansweredQuestions as syncMLCRM } from "./ml-crm-sync.js";
import { autoAnswerPipeline } from "./lib/mlAutoAnswer.js";
import { getGoogleAuthClient } from "./lib/googleAuthCache.js";
import { defaultTailAHAK, rangeAHAK } from "./lib/crmOperativoLayout.js";
import { createTokenStore } from "./tokenStore.js";
import { createMercadoLibreClient } from "./mercadoLibreClient.js";
import calcRouter from "./routes/calc.js";
import deepResearchRouter from "./routes/deepResearch.js";
import agentChatRouter from "./routes/agentChat.js";
import agentTrainingRouter from "./routes/agentTraining.js";
import agentConversationsRouter from "./routes/agentConversations.js";
import agentVoiceRouter from "./routes/agentVoice.js";
import agentTranscribeRouter from "./routes/agentTranscribe.js";
import agentFeedbackRouter from "./routes/agentFeedback.js";
import legacyQuoteRouter from "./routes/legacyQuote.js";
import createBmcDashboardRouter from "./routes/bmcDashboard.js";
import { createFollowupsRouter } from "./routes/followups.js";
import createShopifyRouter from "./routes/shopify.js";
import createMlSearchRouter from "./routes/mlSearch.js";
import createMlEtlRunRouter from "./routes/mlEtlRun.js";
import teamAssistRouter from "./routes/teamAssist.js";
import createTransportistaRouter from "./routes/transportista.js";
import createWaRouter from "./routes/wa.js";
import createTraktimeRouter from "./routes/traktime.js";
import createActivityRouter from "./routes/activity.js";
import { createQuotesRouter } from "./routes/quotes.js";
import * as waConfigModule from "./lib/waConfig.js";
const { primeWaConfig, getFlag: getWaFlag } = waConfigModule;
import { initWaOperatorAuth } from "./lib/waOperatorAuth.js";
import { initIdentityAuth } from "./lib/identityAuth.js";
import cookieParser from "cookie-parser";
import { setWaConfigModuleForQuoteParams } from "./lib/waQuoteParams.js";
import { initWaWebhooks } from "./lib/waWebhooks.js";
import { startWaSlaWorker } from "./lib/waSlaWorker.js";
import { startWaFollowupsWorker } from "./lib/waFollowupsWorker.js";
import { createWolfboardRouter } from "./routes/wolfboard.js";
import marketingRouter from "./routes/marketing.js";
import { createBugsRouter } from "./routes/bugs.js";
import { createSuperAgentRouter } from "./routes/superAgent.js";
import createPanelinInternalRouter from "./routes/panelinInternal.js";
import { requireServiceOrUser } from "./middleware/requireServiceOrUser.js";
import aiAnalyticsRouter from "./routes/aiAnalytics.js";
import { createPdfRouter } from "./routes/pdf.js";
import planInterpretRouter from "./routes/planInterpret.js";
import authGoogleRouter from "./routes/authGoogle.js";
import authMfaRouter, { initAuthMfa } from "./routes/authMfa.js";
import { startOrphanCloseScheduler } from "./jobs/closeOrphanSessions.js";
import identityMeRouter from "./routes/identityMe.js";
import identityAdminRouter from "./routes/identityAdmin.js";
import identityAnalyticsRouter from "./routes/identityAnalytics.js";
import clientesCustomersRouter from "./routes/clientes/customers.js";
import clientesFollowupsRouter from "./routes/clientes/followups.js";
import quoteExportRouter from "./routes/quoteExport.js";
import tasksRouter from "./routes/tasks.js";
import tasksOAuthRouter from "./routes/tasksOAuth.js";
import tasksSyncRouter from "./routes/tasksSync.js";
import { getTransportistaPool } from "./lib/transportistaDb.js";
import { startTransportistaOutboxWorker } from "./lib/transportistaOutboxWorker.js";
import "./lib/marketIntel/scheduler.js"; // registers daily ETL cron at 03:00 UTC
import { getTraktimePool } from "./lib/traktimeDb.js";
import { startTraktimeMirrorWorker } from "./lib/traktimeMirrorWorker.js";
import { startWaEnricherWorker } from "./lib/waEnricherWorker.js";
import { getWaPool } from "./lib/waDb.js";
import { verifyWhatsAppSignature } from "./lib/whatsappSignature.js";
import { verifyMLSignature } from "./lib/mlSignature.js";
import { normalizeMlAnswerCurrencyText } from "./lib/mlAnswerText.js";
import { callAgentOnce } from "./lib/agentCore.js";
import { extractLearnablePairs, } from "./lib/autoLearnExtractor.js";
import { addTrainingEntry } from "./lib/trainingKB.js";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

if (config.panelinRelaxDevAuth) {
  logger.warn(
    "PANELIN_RELAX_DEV_AUTH is enabled — Panelin developer endpoints skip API_AUTH_TOKEN checks. Do not use this on production APIs exposed to the public internet."
  );
}

// Phase 0 security hardening: fail loud in production if critical webhook secrets are missing
const isProd = config.appEnv === "production" || process.env.NODE_ENV === "production";
if (isProd) {
  if (!config.whatsappAppSecret) {
    logger.error("FATAL: WHATSAPP_APP_SECRET is not set in production — WhatsApp webhooks will be rejected");
  }
  if (!config.mlClientSecret) {
    logger.error("FATAL: ML_CLIENT_SECRET is not set in production — MercadoLibre webhooks will be rejected");
  }
}

const app = express();
app.disable("x-powered-by"); // hide Express signature (defense in depth)
app.set("trust proxy", 1);   // honor X-Forwarded-* from Cloud Run / Vercel proxy
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser requests (curl, Cloud Run health checks, server-to-server)
      if (!origin) return cb(null, true);
      // Allow chrome-extension://* (BMC WA Cockpit extension and any sibling)
      if (origin.startsWith("chrome-extension://")) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      cb(Object.assign(new Error(`CORS: origin not allowed — ${origin}`), { status: 403 }));
    },
    credentials: true,
  })
);

// Security headers (OAuth 2.1–aligned)
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// WhatsApp + Shopify webhooks need raw body (HMAC / signature verification)
app.use("/webhooks/whatsapp", (req, res, next) => {
  if (req.method !== "POST") return next();
  return express.raw({ type: "application/json", limit: "20mb" })(req, res, next);
});
app.use("/webhooks/shopify", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.path === "/webhooks/shopify" && req.method === "POST") return next();
  if (req.path === "/webhooks/whatsapp" && req.method === "POST") return next();
  return express.json({ limit: "1mb" })(req, res, next);
});
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
  })
);

// Replaced in-memory Map with persistent store (Phase 0 security fix).
// See server/lib/oauthStateStore.js
import { oauthStateStore } from "./lib/oauthStateStore.js";
const webhookEvents = [];
const maxWebhookEvents = 250;

// ── ML auto-mode (persisted to disk; resets to false on Cloud Run cold start) ──
const ML_AUTOMODE_FILE = path.join(__dirname, ".ml-automode.json");
let autoMode = { fullAuto: false };
try { autoMode = JSON.parse(fs.readFileSync(ML_AUTOMODE_FILE, "utf8")); } catch { /* first run */ }

const tokenStore = createTokenStore({
  storageType: config.tokenStorage,
  filePath: config.tokenFile,
  gcsBucket: config.tokenGcsBucket,
  gcsObject: config.tokenGcsObject,
  encryptionKey: config.tokenEncryptionKey,
  logger,
});
const ml = createMercadoLibreClient({ config, tokenStore, logger });

const missingConfig = () => {
  const missing = [];
  if (!config.mlClientId) missing.push("ML_CLIENT_ID");
  if (!config.mlClientSecret) missing.push("ML_CLIENT_SECRET");
  if (!config.useProdRedirect && !config.mlRedirectUriDev) missing.push("ML_REDIRECT_URI_DEV");
  if (config.useProdRedirect && !config.mlRedirectUriProd) {
    missing.push("PUBLIC_BASE_URL o ML_REDIRECT_URI_PROD");
  }
  return missing;
};

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const ensureValidState = async (state) => {
  // Atomic single-use consume: returns the payload exactly once; a reused,
  // expired, or unknown state yields null and aborts the flow.
  const entry = await oauthStateStore.consume(state);
  if (!entry) return null;
  return entry;
};

/** Single discovery manifest for AI agents (Calculator + Dashboard + UI pointers) */
app.get("/capabilities", (req, res) => {
  res.json(buildAgentCapabilitiesManifest(config));
});

/**
 * Consolidated version/build info: commit SHA + CALCULATOR_DATA_VERSION + build/deploy
 * timestamps. Foundation for prod-vs-git-vs-local drift detection (scripts/reconcile-version.mjs).
 * Read-only, secret-free.
 */
app.get("/version", (_req, res) => {
  res.json(buildVersionInfo());
});

app.get("/health", asyncHandler(async (req, res) => {
  let tokens = null;
  let mlTokenStoreOk = true;
  try {
    tokens = await ml.getStoredTokens();
  } catch (err) {
    mlTokenStoreOk = false;
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "health: ML token store read failed");
  }
  const missing = missingConfig();
  const credsPath =
    config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
  const hasSheets = !!(
    config.bmcSheetId &&
    credsPath &&
    fs.existsSync(path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath))
  );
  let sheets_diagnostics = null;
  if (hasSheets) {
    try {
      const diagResult = await Promise.race([
        (async () => {
          const authClient = await getGoogleAuthClient("https://www.googleapis.com/auth/spreadsheets.readonly");
          const client = google.sheets({ version: "v4", auth: authClient });
          const meta = await client.spreadsheets.get({
            spreadsheetId: config.bmcSheetId,
            fields: "sheets.properties.title",
          });
          const tabs = (meta.data.sheets || []).map((s) => s.properties?.title || "");
          const primaryTab = config.bmcSheetSchema === "CRM_Operativo" ? "CRM_Operativo" : "Master_Cotizaciones";
          const missing_tabs = [primaryTab].filter((t) => !tabs.includes(t));
          return { ok: missing_tabs.length === 0, tabs, missing: missing_tabs };
        })(),
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: false, error: "timeout" }), 3000)
        ),
      ]);
      sheets_diagnostics = diagResult;
    } catch (e) {
      sheets_diagnostics = { ok: false, error: e.message };
    }
  }

  res.json({
    ok: true,
    appEnv: config.appEnv,
    hasTokens: Boolean(tokens?.access_token),
    mlTokenStoreOk,
    hasSheets,
    sheets_diagnostics,
    missingConfig: missing,
  });
}));

// RUM: Core Web Vitals from the Vite app (sendBeacon) — register before any `app.use("/api", …)` so it is not shadowed
app.post(
  "/api/vitals",
  express.text({ type: ["text/plain", "application/json"], limit: "32768" }),
  (_req, res) => {
    res.status(204).end();
  },
);

app.get("/auth/ml/start", asyncHandler(async (req, res) => {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");
  await oauthStateStore.set(state, { codeVerifier });
  const authUrl = ml.buildAuthUrl(state, codeChallenge);

  if (req.query.mode === "json") {
    return res.json({ authUrl, state });
  }
  return res.redirect(authUrl);
}));

app.get("/auth/ml/callback", asyncHandler(async (req, res) => {
  const { code, error, error_description: errorDescription, state } = req.query;
  if (error) {
    return res.status(400).json({
      ok: false,
      error: String(error),
      errorDescription: errorDescription ? String(errorDescription) : "",
    });
  }
  if (!code) {
    return res.status(400).json({ ok: false, error: "Missing code in callback querystring" });
  }
  const stateEntry = await ensureValidState(String(state));
  if (!state || !stateEntry) {
    return res.status(400).json({ ok: false, error: "Invalid or expired OAuth state" });
  }

  const tokens = await ml.exchangeCodeForTokens(String(code), stateEntry.codeVerifier);
  return res.json({
    ok: true,
    userId: tokens.user_id,
    scope: tokens.scope,
    expiresAt: tokens.expires_at,
  });
}));

app.get("/auth/ml/status", asyncHandler(async (req, res) => {
  let tokens;
  try {
    tokens = await ml.getStoredTokens();
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "auth/ml/status: token store read failed");
    return res.status(503).json({ ok: false, message: "Token store unavailable" });
  }
  if (!tokens?.access_token) {
    return res.status(404).json({ ok: false, message: "No token stored yet" });
  }
  return res.json({
    ok: true,
    userId: tokens.user_id,
    scope: tokens.scope,
    updatedAt: tokens.updated_at,
    expiresAt: tokens.expires_at,
  });
}));

app.get("/ml/users/me", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: "/users/me",
  });
  res.json(payload);
}));

app.get("/ml/users/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/users/${req.params.id}`,
  });
  res.json(payload);
}));

app.get("/ml/listings", asyncHandler(async (req, res) => {
  const { status = "active", limit = 50, offset = 0 } = req.query;
  const sellerId = await ml.resolveSellerId();
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/users/${sellerId}/items/search?status=${status}&limit=${limit}&offset=${offset}`,
  });
  res.json(payload);
}));

app.get("/ml/items/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/items/${req.params.id}`,
  });
  res.json(payload);
}));

app.patch("/ml/items/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "PUT",
    path: `/items/${req.params.id}`,
    body: req.body,
  });
  res.json(payload);
}));

app.post("/ml/items/:id/description", asyncHandler(async (req, res) => {
  const { text } = req.body;
  try {
    const payload = await ml.requestWithRetries({
      method: "POST",
      path: `/items/${req.params.id}/description`,
      body: { plain_text: text },
    });
    res.json(payload);
  } catch (e) {
    if (e.payload?.message?.includes("already has a description")) {
      const payload = await ml.requestWithRetries({
        method: "PUT",
        path: `/items/${req.params.id}/description`,
        body: { plain_text: text },
      });
      res.json(payload);
    } else throw e;
  }
}));

app.get("/ml/questions", asyncHandler(async (req, res) => {
  if (req.query.id) {
    const payload = await ml.requestWithRetries({
      method: "GET",
      path: `/questions/${req.query.id}`,
    });
    return res.json(payload);
  }
  // Solo parámetros que ML acepta en /questions/search (evita invalid_query_string por query basura)
  const allowedKeys = new Set([
    "seller_id",
    "item",
    "item_id",
    "api_version",
    "site_id",
    "offset",
    "limit",
    "status",
  ]);
  const query = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (allowedKeys.has(k) && v != null && String(v) !== "") {
      query[k] = v;
    }
  }
  if (!query.seller_id) {
    const sellerId = await ml.resolveSellerId();
    if (sellerId) query.seller_id = sellerId;
  }
  if (!query.seller_id) {
    return res.status(400).json({
      ok: false,
      error:
        "Missing seller_id: complete OAuth (/auth/ml/start) or pass ?seller_id=… so /questions/search is valid.",
    });
  }
  if (query.api_version == null || query.api_version === "") {
    query.api_version = "4";
  }
  if (query.site_id == null || query.site_id === "") {
    query.site_id = config.mlSiteId;
  }
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: "/questions/search",
    query,
  });
  res.json(payload);
}));

app.get("/ml/questions/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/questions/${req.params.id}`,
  });
  res.json(payload);
}));

app.post("/ml/questions/:id/answer", asyncHandler(async (req, res) => {
  if (!req.body?.text) {
    return res.status(400).json({ ok: false, error: "Missing body.text" });
  }
  const text = normalizeMlAnswerCurrencyText(req.body.text);
  const payload = await ml.requestWithRetries({
    method: "POST",
    path: "/answers",
    body: {
      question_id: Number(req.params.id),
      text,
    },
  });
  res.json(payload);
}));

app.get("/ml/orders", asyncHandler(async (req, res) => {
  if (req.query.id) {
    const payload = await ml.requestWithRetries({
      method: "GET",
      path: `/orders/${req.query.id}`,
    });
    return res.json(payload);
  }
  const allowedKeys = new Set([
    "seller",
    "seller.id",
    "offset",
    "limit",
    "order.status",
    "sort",
    "tags",
  ]);
  const query = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (allowedKeys.has(k) && v != null && String(v) !== "") {
      query[k] = v;
    }
  }
  const sellerId = await ml.resolveSellerId();
  // ML documenta /orders/search?seller=ID; marketplace a veces usa seller.id — alinear caller con el vendedor del token
  if (!query.seller && !query["seller.id"] && sellerId) {
    query.seller = sellerId;
  }
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: "/orders/search",
    query,
  });
  res.json(payload);
}));

app.get("/ml/orders/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/orders/${req.params.id}`,
  });
  res.json(payload);
}));

app.post("/webhooks/ml", asyncHandler(async (req, res) => {
  // Layer 1: HMAC signature verification (Gap #1 fix)
  // ML signs: "id:{data.id};request-id:{x-request-id};ts:{ts}" with ML_CLIENT_SECRET
  const mlSigVerified = verifyMLSignature({
    clientSecret: config.mlClientSecret,
    signatureHeader: req.headers["x-signature"],
    dataId: req.query.id ?? req.body?.id,
    requestId: req.headers["x-request-id"],
  });
  if (!mlSigVerified.skipped && !mlSigVerified.ok) {
    req.log.warn({ reason: mlSigVerified.reason }, "ML webhook: invalid HMAC signature — rejected");
    return res.status(401).json({ ok: false, error: "Invalid webhook signature" });
  }
  if (mlSigVerified.skipped && config.appEnv !== "test") {
    req.log.warn("ML_CLIENT_SECRET unset — POST /webhooks/ml HMAC verification skipped");
  }

  // Layer 2: verify token (second layer — kept for defence in depth)
  if (config.webhookVerifyToken) {
    const received =
      req.query.verify_token ||
      req.headers["x-webhook-token"] ||
      req.headers.authorization;
    if (String(received) !== String(config.webhookVerifyToken)) {
      return res.status(401).json({ ok: false, error: "Invalid webhook token" });
    }
  }

  const event = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    body: req.body,
    query: req.query,
    headers: {
      "x-request-id": req.headers["x-request-id"],
      topic: req.headers["x-topic"],
      "x-signature": req.headers["x-signature"],
    },
  };
  webhookEvents.unshift(event);
  if (webhookEvents.length > maxWebhookEvents) webhookEvents.pop();

  req.log.info({ eventId: event.id, topic: event.headers.topic }, "MercadoLibre webhook received");

  // Trigger ML→CRM sync cuando llega una pregunta nueva (fire-and-forget — responde 200 de inmediato)
  const topic = req.body?.topic || req.headers["x-topic"];
  if (topic === "questions" && config.bmcSheetId) {
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    (async () => {
      try {
        const syncResult = await syncMLCRM({ ml, sheetId: config.bmcSheetId, credsPath, logger: req.log });
        if (autoMode.fullAuto && syncResult.rows?.length > 0) {
          req.log.info({ count: syncResult.rows.length }, "ML auto-mode ON — running auto-answer pipeline");
          const { answered } = await autoAnswerPipeline({
            rows:      syncResult.rows,
            ml,
            sheetId:   config.bmcSheetId,
            credsPath,
            config,
            logger:    req.log,
          });
          req.log.info({ answered }, "ML auto-answer pipeline complete");
        }
      } catch (err) {
        req.log.error({ err }, "ML→CRM webhook pipeline failed");
      }
    })();
  }

  res.status(200).json({ ok: true, eventId: event.id });
}));

app.get("/webhooks/ml/events", asyncHandler(async (req, res) => {
  res.json({ ok: true, count: webhookEvents.length, events: webhookEvents });
}));

// ── ML auto-mode API ──────────────────────────────────────────────────────────
app.get("/api/ml/auto-mode", (_req, res) => {
  res.json({ ok: true, autoMode });
});

app.post("/api/ml/auto-mode", asyncHandler(async (req, res) => {
  const tkn = config.apiAuthToken;
  if (tkn) {
    const auth = req.headers.authorization || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (bearer !== tkn) return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") return res.status(400).json({ ok: false, error: "body.enabled must be boolean" });
  autoMode = { fullAuto: enabled };
  try { fs.writeFileSync(ML_AUTOMODE_FILE, JSON.stringify(autoMode)); } catch { /* ephemeral env */ }
  req.log.info({ autoMode }, "ML auto-mode updated");
  res.json({ ok: true, autoMode });
}));

// ── WhatsApp Business Cloud API webhook ──
const waConversations = new Map(); // chatId → { messages: [], lastUpdate }

// Limpieza de conversaciones viejas (>24h) cada hora
setInterval(() => {
  const cutoff = Date.now() - 24*60*60*1000;
  for (const [k, v] of waConversations) {
    if (v.lastUpdate < cutoff) waConversations.delete(k);
  }
}, 60*60*1000);

// GET — verificación Meta
app.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    res.set("Content-Type", "text/plain");
    return res.status(200).send(String(challenge ?? ""));
  }
  res.status(403).send("Forbidden");
});

// POST — mensajes entrantes
// Note: rate-limiting is intentionally omitted on this endpoint. Meta's Cloud API
// retries on 5xx; an over-aggressive limiter would cause webhook delivery failures.
// Unauthorized requests are blocked by HMAC signature verification above.
// ── Procesar conversación WA completa → CRM + Form responses ──
async function processWaConversation(chatId, conv) {
  const dialogo = conv.messages
    .map(m => `${m.ts.slice(11,16)} - ${m.from}: ${m.text}`)
    .join("\n");

  logger.info(`[WA] Processing conversation for ${chatId} (${conv.messages.length} msgs)`);

  try {
    const parseResp = await fetch(`http://localhost:${config.port}/api/crm/parse-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dialogo }),
    });
    const parsed = await parseResp.json();

    if (parsed.ok && parsed.data) {
      const d = parsed.data;
      const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
      if (config.bmcSheetId && credsPath) {
        const { google } = await import("googleapis");
        const auth = new google.auth.GoogleAuth({
          keyFile: credsPath,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
        const sheetId = config.bmcSheetId;
        const now = new Date().toISOString();

        // Form responses 1 — primera fila con col C (Cliente) vacía
        const formClientes = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId, range: "'Form responses 1'!C2:C200",
        });
        const formRows = formClientes.data.values || [];
        let formRow = formRows.length + 2;
        for (let i = 0; i < formRows.length; i++) {
          if (!formRows[i][0] || !formRows[i][0].toString().trim()) { formRow = i + 2; break; }
        }

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'Form responses 1'!A${formRow}:P${formRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[
            now, now, d.cliente || "", d.telefono || chatId,
            d.ubicacion || "", "WA-Auto", d.resumen_pedido || "", d.categoria || "",
            d.urgencia || "", d.cotizacion_formal || "", d.tipo_cliente || "",
            d.vendedor || "", d.observaciones || "", d.validar_stock || "No",
            d.probabilidad_cierre || "", dialogo,
          ]] },
        });

        // CRM_Operativo — primera fila con col C (Cliente) vacía a partir de fila 4
        const crmClientes = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId, range: "'CRM_Operativo'!C4:C500",
        });
        const crmVals = crmClientes.data.values || [];
        let crmRow = crmVals.length + 4;
        for (let i = 0; i < crmVals.length; i++) {
          if (!crmVals[i][0] || !crmVals[i][0].toString().trim()) { crmRow = i + 4; break; }
        }

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!B${crmRow}:K${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[
            now, d.cliente || "", d.telefono || chatId,
            d.ubicacion || "", "WA-Auto", d.resumen_pedido || "",
            d.categoria || "", "", "Pendiente", d.vendedor || "",
          ]] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!R${crmRow}:T${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[d.probabilidad_cierre || "", d.urgencia || "", d.validar_stock || "No"]] },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'CRM_Operativo'!V${crmRow}:W${crmRow}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [[d.tipo_cliente || "", d.observaciones || ""]] },
        });

        // Generar respuesta IA para col AF — usa agente unificado (canal: wa + KB)
        let ai = { ok: false };
        try {
          const waMessages = conv.messages.map((m) => ({
            role: "user",
            content: `${m.from}: ${m.text}`,
          }));
          const result = await callAgentOnce(waMessages, { channel: "wa" });
          ai = { ok: true, respuesta: result.text, provider: result.provider };
        } catch (aiErr) {
          logger.warn(`[WA] agentCore failed for ${chatId}: ${aiErr.message}`);
        }
        if (ai.ok && ai.respuesta) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'CRM_Operativo'!AF${crmRow}:AG${crmRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[ai.respuesta, ai.provider || ""]] },
          });
        }

        // Autolearn: extraer pares Q→A del intercambio WA para el KB unificado
        setImmediate(() => {
          const waTurns = conv.messages.map((m) => ({ role: "user", content: m.text }));
          if (ai.ok && ai.respuesta) waTurns.push({ role: "assistant", content: ai.respuesta });
          extractLearnablePairs(waTurns, { source: "wa", convId: chatId })
            .then((pairs) => {
              for (const p of pairs) {
                addTrainingEntry({
                  question: p.question, goodAnswer: p.goodAnswer,
                  badAnswer: p.badAnswer || "", category: p.category || "conversational",
                  context: `[WA] ${p.rationale || ""}`, source: p.source || "autolearned",
                  status: p.confidence >= 0.92 ? "active" : "pending",
                  confidence: p.confidence, convId: p.convId || chatId,
                });
              }
              if (pairs.length > 0) logger.info(`[WA] autolearn: ${pairs.length} KB candidates from ${chatId}`);
            })
            .catch(() => {});
        });

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: rangeAHAK(crmRow),
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [defaultTailAHAK()] },
        });

        logger.info(`[WA] ✓ Conversation processed → CRM row ${crmRow}, Form row ${formRow}, provider: ${ai.provider || "none"}`);
      }
    }
  } catch (err) {
    logger.error(`[WA] ✗ parse-conversation failed for ${chatId}: ${err.message}`);
  }

  waConversations.delete(chatId);
}

// ── Auto-trigger: procesar conversaciones inactivas (5 min sin mensajes) ──
const WA_INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [chatId, conv] of waConversations.entries()) {
    if (now - conv.lastUpdate >= WA_INACTIVITY_MS && conv.messages.length > 0) {
      logger.info(`[WA] Auto-trigger: ${chatId} inactive for 5min (${conv.messages.length} msgs)`);
      processWaConversation(chatId, conv);
    }
  }
}, 60 * 1000); // revisar cada 1 minuto

app.post("/webhooks/whatsapp", asyncHandler(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const sig = req.headers["x-hub-signature-256"];
  const verified = verifyWhatsAppSignature({
    appSecret: config.whatsappAppSecret,
    rawBodyBuffer: raw,
    signatureHeader: sig,
  });
  if (!verified.skipped && !verified.ok) {
    return res.status(401).json({ ok: false, error: "invalid webhook signature" });
  }
  if (verified.reason === "secret_not_configured") {
    logger.error("WHATSAPP_APP_SECRET is not configured — rejecting webhook for security");
    return res.status(503).json({ ok: false, error: "Webhook security not configured" });
  }

  let body = {};
  try {
    if (raw.length) body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(200).json({ ok: true });
  }

  res.status(200).json({ ok: true });

  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // ── Delivery status updates (delivered / read / failed) ──────────────────
  // WhatsApp sends `statuses` in the same payload as messages.
  // Wire status updates into wa_messages.status for the cockpit.
  if (value?.statuses?.length) {
    const waPoolForStatus = getWaPool(config.databaseUrl);
    if (waPoolForStatus) {
      const VALID_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
      for (const statusUpdate of value.statuses) {
        const msgId = statusUpdate.id;
        const newStatus = statusUpdate.status;
        if (!msgId || !newStatus || !VALID_STATUSES.has(newStatus)) continue;
        const statusMeta = {
          status_ts: statusUpdate.timestamp
            ? new Date(Number(statusUpdate.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
        };
        if (newStatus === "failed" && statusUpdate.errors) {
          statusMeta.wa_errors = statusUpdate.errors;
        }
        try {
          // Prevent status regression (e.g. don't move from 'read' back to 'delivered').
          // WhatsApp delivers statuses out-of-order and retries on failures.
          // Rank: sent=1 < delivered=2 < read=3 < failed=4
          await waPoolForStatus.query(
            `update wa_messages
                set status = $1,
                    meta = coalesce(meta, '{}'::jsonb) || $2::jsonb
              where msg_id = $3
                and (
                  case status
                    when 'sent'      then 1
                    when 'delivered' then 2
                    when 'read'      then 3
                    when 'failed'    then 4
                    else 0
                  end
                ) < (
                  case $1
                    when 'sent'      then 1
                    when 'delivered' then 2
                    when 'read'      then 3
                    when 'failed'    then 4
                    else 0
                  end
                )`,
            [newStatus, JSON.stringify(statusMeta), String(msgId)],
          );
        } catch (e) {
          logger.warn({ err: e?.message, msg_id: msgId, status: newStatus }, "WA status-update DB write failed");
        }
      }
    }
  }

  if (!value?.messages) return;

  for (const msg of value.messages) {
    const chatId = msg.from; // número del cliente
    const contactName = value.contacts?.[0]?.profile?.name || msg.from;
    const text = msg.text?.body || msg.caption || "";
    if (!text) continue;

    if (!waConversations.has(chatId)) {
      waConversations.set(chatId, { messages: [], contactName, lastUpdate: Date.now() });
    }
    const conv = waConversations.get(chatId);
    conv.messages.push({ from: contactName, text, ts: new Date().toISOString() });
    conv.lastUpdate = Date.now();

    logger.info(`[WA] Message from ${contactName} (${chatId}), total: ${conv.messages.length}`);

    // F4 — espejar inbound Cloud API en Postgres wa_messages para que el cockpit
    // SPA tenga vista unificada con los mensajes scrapeados via extensión.
    try {
      const waPoolForWebhook = getWaPool(config.databaseUrl);
      if (waPoolForWebhook) {
        const phoneDigits = String(chatId || "").replace(/\D/g, "").slice(0, 32);
        await waPoolForWebhook.query(
          `insert into wa_conversations (chat_id, phone, contact_name)
           values ($1, $2, $3)
           on conflict (chat_id) do update
             set phone = coalesce(wa_conversations.phone, excluded.phone),
                 contact_name = coalesce(wa_conversations.contact_name, excluded.contact_name),
                 updated_at = now()`,
          [chatId, phoneDigits || null, contactName],
        );
        const tsIso = new Date(Number(msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now())).toISOString();
        await waPoolForWebhook.query(
          `insert into wa_messages
             (msg_id, chat_id, ts, direction, type, text, source, raw, meta)
           values ($1, $2, $3::timestamptz, 'in', $4, $5, 'cloud_api', $6::jsonb, $7::jsonb)
           on conflict (msg_id) do nothing`,
          [
            String(msg.id || `cloud_in_${chatId}_${Date.now()}`),
            chatId,
            tsIso,
            String(msg.type || "text"),
            text,
            JSON.stringify(msg),
            JSON.stringify({ webhook: true }),
          ],
        );
        await waPoolForWebhook.query(
          `update wa_conversations
             set last_msg_at = greatest(coalesce(last_msg_at, '1970-01-01'::timestamptz), $2::timestamptz),
                 last_msg_in_at = greatest(coalesce(last_msg_in_at, '1970-01-01'::timestamptz), $2::timestamptz),
                 updated_at = now()
           where chat_id = $1`,
          [chatId, tsIso],
        );
      }
    } catch (e) {
      logger.warn({ err: e?.message, chat_id: chatId }, "WA webhook → wa_messages mirror failed");
    }

    // 🚀 = trigger manual inmediato (opcional, sigue funcionando)
    if (text.includes("🚀")) {
      logger.info(`[WA] 🚀 manual trigger for ${chatId}`);
      processWaConversation(chatId, conv);
    }
  }
}));

app.use("/calc", calcRouter);
// Asistente "equipo" (OpenAI) — /api/team-assist/* (antes del dashboard para no colisionar)
app.use("/api/team-assist", teamAssistRouter);
app.use("/api", authGoogleRouter);
app.use("/api", authMfaRouter);
app.use(identityMeRouter);
app.use(identityAdminRouter);
app.use(identityAnalyticsRouter);
app.use(clientesCustomersRouter);
app.use(clientesFollowupsRouter);
app.use(quoteExportRouter);
app.use("/api", agentChatRouter);
app.use("/api", agentTrainingRouter);
app.use("/api", agentConversationsRouter);
app.use("/api", agentFeedbackRouter);
app.use("/api", agentVoiceRouter);
app.use("/api", agentTranscribeRouter);
app.use("/api", aiAnalyticsRouter);
// Follow-up tracker (local store) — mount before dashboard so routes are unambiguous
app.use("/api", createFollowupsRouter());
app.use("/api", createTransportistaRouter(config, logger));
app.use("/api", createWaRouter(config, logger));
app.use(createTraktimeRouter(config, logger));
app.use(createActivityRouter(config, logger));
// Diagnostic endpoint (dev only) — must be before createBmcDashboardRouter catch-all
{
  const _isDev = config.appEnv === "development";
  if (_isDev) {
    app.get("/api/diagnostic", (req, res) => {
      const credsPath =
        config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
      const hasSheets = !!(
        config.bmcSheetId &&
        credsPath &&
        fs.existsSync(path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath))
      );
      res.json({
        ok: true,
        version: "1.0",
        appEnv: config.appEnv,
        envVarsPresent: [
          "BMC_SHEET_ID",
          "GOOGLE_APPLICATION_CREDENTIALS",
          "ML_CLIENT_ID",
          "ML_CLIENT_SECRET",
          "SHOPIFY_CLIENT_ID",
          "SHOPIFY_CLIENT_SECRET",
        ].filter((k) => !!process.env[k]),
        hasSheets,
        port: config.port,
      });
    });
  }
}
// SuperAgent tool — single-call quoting for AI agents
app.use("/api/agent", createSuperAgentRouter(config));
// Presupuestación Orchestrator — testing y ejecución interna del conductor
import presupOrchestratorRouter from "./routes/internal/presupOrchestrator.js";

// Panelin interno — RBAC discovery + tool catalog (Bearer API_AUTH_TOKEN)
app.use("/api/internal/panelin", createPanelinInternalRouter(config));
app.use("/api/internal/presup", presupOrchestratorRouter);

// Public Panelin surfaces (operator dashboard realtime + PIM publish worker) — ROOT AUTH FIX
// Enforce requireServiceOrUser (static API_AUTH_TOKEN for service/cron/dashboard calls, or opted user JWT).
// This is the structural root fix for the recurring "no auth on /api/panelin" security findings.
// All endpoints in createPanelinRouter (events, products, stock, invoices, sync, debug) now inherit the guard.
app.use("/api/panelin", requireServiceOrUser(), createPanelinRouter(config));
// Wolfboard admin — must be before the broad /api router
app.use("/api/wolfboard", createWolfboardRouter(config));
// Market Intelligence — competitor price monitoring, ETL, alerts, mystery shopping
// Auth applied per-route inside the router (same pattern as followups.js, mlEtlRun.js)
app.use("/api/marketing", marketingRouter);
app.use("/api/bugs", createBugsRouter(config));
// PDF generation (Playwright/Chromium server-side — vectorial quality)
app.use("/api/pdf", createPdfRouter());
app.use("/api", deepResearchRouter);
app.use("/api", planInterpretRouter);
// ML search (competitors lookup) — Bearer API_AUTH_TOKEN, 30-min TTL cache, 60 req/min
app.use(createMlSearchRouter({ ml, config, logger }));
// Price monitor ETL trigger / status — Bearer API_AUTH_TOKEN
app.use(createMlEtlRunRouter({ config, logger }));
// Quote counter (atomic global counter, annual reset)
app.use("/api", createQuotesRouter(config));
// BMC Finanzas dashboard: API under /api, static UI at /finanzas
app.use("/api", createBmcDashboardRouter(config));
// Shopify integration v4 (questions/quotes – Mercado Libre replacement)
app.use(createShopifyRouter(config, logger));
// Tareas (Google Tasks bidirectional mirror) — Phase 0 stubs return 501
// CRUD under /api/tasks/* (Bearer JWT via requireUser inside router)
app.use("/api/tasks", tasksRouter);
// OAuth PKCE flow for Google Tasks scope — /auth/tasks/{init,callback,revoke}
app.use("/auth/tasks", tasksOAuthRouter);
// Cloud Scheduler sync target (HMAC-verified) — /sync/google-tasks/pull
app.use("/sync", tasksSyncRouter);

const dashboardDir = path.join(__dirname, "../docs/bmc-dashboard-modernization/dashboard");
const hasFinanzasDashboard = fs.existsSync(path.join(dashboardDir, "index.html"));
const isDev = config.appEnv === "development";
if (isDev) {
  app.get("/api/dev/dashboard-mtime", (req, res) => {
    try {
      const files = ["index.html", "app.js", "styles.css"];
      let max = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(dashboardDir, f));
        if (stat.mtimeMs > max) max = stat.mtimeMs;
      }
      res.json({ mtime: max });
    } catch {
      res.json({ mtime: 0 });
    }
  });
}
app.use(
  "/finanzas",
  (req, res, next) => {
    if (isDev) res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    next();
  },
  express.static(dashboardDir, { index: "index.html" })
);

// Calculadora BMC (Vite SPA) — served from /calculadora when dist exists
const calcDistDir = path.join(__dirname, "../dist");
if (fs.existsSync(calcDistDir)) {
  app.use(
    "/calculadora",
    (req, res, next) => {
      if (isDev) res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      next();
    },
    express.static(calcDistDir, { index: "index.html" })
  );
  // SPA fallback: /calculadora/logistica etc. (no fichero estático) → index.html
  app.get(/^\/calculadora(\/.*)?$/, (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!req.accepts("html")) return next();
    if (req.path.startsWith("/calculadora/assets/")) return next();
    const base = path.basename(req.path);
    if (base.includes(".") && !req.path.endsWith("/") && path.extname(req.path).toLowerCase() !== ".html") {
      return next();
    }
    res.sendFile(path.join(calcDistDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// Avoid 404s when ngrok/browsers hit the API root or favicon (traffic audit: EXPORT_SEAL)
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});
app.get("/", (req, res) => {
  if (req.accepts("html")) {
    res.redirect(302, "/finanzas");
    return;
  }
  res.status(404).json({ ok: false, error: "Not found", path: req.path });
});

app.use("/", legacyQuoteRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found", path: req.path });
});

app.use((error, req, res, _next) => {
  const status = Number(error.status || 500);
  const logger = req.log || console;
  logger.error(
    {
      err: error,
      path: error.path,
      payload: error.payload,
    },
    "Request failed"
  );
  res.status(status).json({
    ok: false,
    error: error.message || "Unhandled server error",
    details: error.payload || null,
  });
});

const transportistaPool = getTransportistaPool(config.databaseUrl);

// Cleanups capturados en el listen callback. Inicializados a noop para que
// el shutdown handler sea seguro aunque la señal llegue antes del listen.
let stopTransportista = () => {};
let stopTraktimeMirror = () => {};
let stopWaEnricher = () => {};
let stopWaSla = () => {};
let stopWaFollowups = () => {};

const server = app.listen(config.port, async () => {
  logger.info(
    {
      port: config.port,
      appEnv: config.appEnv,
      publicBaseUrl: config.publicBaseUrl,
      hasFinanzasDashboard,
      dashboardDir,
    },
    "MercadoLibre connector server started"
  );
  if (transportistaPool) {
    stopTransportista = startTransportistaOutboxWorker({ config, logger, pool: transportistaPool });
  }
  // TraKtiMe nightly Sheets mirror (no-op if TRAKTIME_SHEET_ID unset or disabled).
  {
    const traktimePool = getTraktimePool(config.databaseUrl);
    if (traktimePool) {
      stopTraktimeMirror = startTraktimeMirrorWorker({ config, logger, pool: traktimePool });
    }
  }
  // WA Cockpit — F-A4: prime config (settings + flags + LISTEN/NOTIFY) y auth.
  // Se hace ANTES de los workers para que lean ya el cache caliente.
  const waPool = getWaPool(config.databaseUrl);
  if (waPool) {
    try {
      await primeWaConfig({ pool: waPool, logger });
      initWaOperatorAuth({ pool: waPool, logger });
      // Comprador identity reuses the same Postgres pool.
      initIdentityAuth({ pool: waPool, logger });
      initAuthMfa({ pool: waPool, logger });
      initWaWebhooks({ pool: waPool, logger });
      setWaConfigModuleForQuoteParams(waConfigModule);
      // Hourly TTL pass: insert synthetic auth.session.end for users idle
      // > ACTIVITY_LOG_ORPHAN_TTL_HOURS (default 24h) so the activity log
      // captures session boundaries even when the browser dies silently.
      startOrphanCloseScheduler({ pool: waPool, logger });
    } catch (e) {
      logger.warn({ err: e }, "WA config/auth prime failed (continúo sin runtime config)");
    }
  }

  // WA Cockpit enricher (F2) — gobernado por flag enricher.enabled (DB) o el
  // fallback histórico WA_ENRICHER_ENABLED=true (.env). El flag DB tiene prioridad.
  const enricherFlagOn = (() => {
    try { return getWaFlag("enricher.enabled"); } catch { return false; }
  })();
  if (waPool && (enricherFlagOn || config.waEnricherEnabled)) {
    stopWaEnricher = startWaEnricherWorker({ config, logger, pool: waPool });
    logger.info(
      { source: enricherFlagOn ? "flag" : "env" },
      "WA enricher worker started",
    );
  }

  // WA Cockpit — SLA worker (Missive-style), governed by flag slaTracking.enabled.
  // El worker mismo chequea el flag en cada tick → no duplicamos lógica acá.
  if (waPool) {
    stopWaSla = startWaSlaWorker({ logger, pool: waPool });
    stopWaFollowups = startWaFollowupsWorker({ logger, pool: waPool });
    logger.info("WA sla + followups workers started");
  }
});

// ── Graceful shutdown ──
// Cloud Run otorga ~10s entre SIGTERM y SIGKILL. Disparamos los cleanups de
// los workers (que abortan batches in-flight) y cerramos el HTTP server. Si
// algo se cuelga, el setTimeout fuerza el exit a los 8s para no perder el
// grace period.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutdown signal received");

  try { stopTransportista(); } catch (e) { logger.warn({ err: e?.message }, "stopTransportista failed"); }
  try { stopTraktimeMirror(); } catch (e) { logger.warn({ err: e?.message }, "stopTraktimeMirror failed"); }
  try { stopWaEnricher(); } catch (e) { logger.warn({ err: e?.message }, "stopWaEnricher failed"); }
  try { stopWaSla(); } catch (e) { logger.warn({ err: e?.message }, "stopWaSla failed"); }
  try { stopWaFollowups(); } catch (e) { logger.warn({ err: e?.message }, "stopWaFollowups failed"); }

  server.close((err) => {
    if (err) logger.error({ err: err?.message }, "server.close error");
    logger.info("HTTP server closed, exiting");
    process.exit(0);
  });

  setTimeout(() => {
    logger.warn("forced exit after 8s grace");
    process.exit(0);
  }, 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
