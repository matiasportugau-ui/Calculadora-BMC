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
import { syncUnansweredQuestions as syncMLCRM } from "./ml-crm-sync.js";
import { defaultTailAHAK, rangeAHAK } from "./lib/crmOperativoLayout.js";
import { createTokenStore } from "./tokenStore.js";
import { createMercadoLibreClient } from "./mercadoLibreClient.js";
import calcRouter from "./routes/calc.js";
import agentChatRouter from "./routes/agentChat.js";
import agentTrainingRouter from "./routes/agentTraining.js";
import agentConversationsRouter from "./routes/agentConversations.js";
import agentVoiceRouter from "./routes/agentVoice.js";
import legacyQuoteRouter from "./routes/legacyQuote.js";
import createBmcDashboardRouter from "./routes/bmcDashboard.js";
import { createFollowupsRouter } from "./routes/followups.js";
import createShopifyRouter from "./routes/shopify.js";
import teamAssistRouter from "./routes/teamAssist.js";
import createTransportistaRouter from "./routes/transportista.js";
import { createWolfboardRouter } from "./routes/wolfboard.js";
import { createSuperAgentRouter } from "./routes/superAgent.js";
import { getTransportistaPool } from "./lib/transportistaDb.js";
import { startTransportistaOutboxWorker } from "./lib/transportistaOutboxWorker.js";
import { verifyWhatsAppSignature } from "./lib/whatsappSignature.js";
import { normalizeMlAnswerCurrencyText } from "./lib/mlAnswerText.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

const app = express();
app.use(cors());

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
app.use(
  pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
  })
);

const stateTtlMs = 10 * 60 * 1000;
const oauthStates = new Map();
const webhookEvents = [];
const maxWebhookEvents = 250;

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

const ensureValidState = (state) => {
  const createdAt = oauthStates.get(state);
  if (!createdAt) return false;
  const expired = Date.now() - createdAt > stateTtlMs;
  oauthStates.delete(state);
  return !expired;
};

/** Single discovery manifest for AI agents (Calculator + Dashboard + UI pointers) */
app.get("/capabilities", (req, res) => {
  res.json(buildAgentCapabilitiesManifest(config));
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
  res.json({
    ok: true,
    appEnv: config.appEnv,
    hasTokens: Boolean(tokens?.access_token),
    mlTokenStoreOk,
    hasSheets,
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
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now());
  const authUrl = ml.buildAuthUrl(state);

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
  if (!state || !ensureValidState(String(state))) {
    return res.status(400).json({ ok: false, error: "Invalid or expired OAuth state" });
  }

  const tokens = await ml.exchangeCodeForTokens(String(code));
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
    syncMLCRM({ ml, sheetId: config.bmcSheetId, credsPath, logger: req.log })
      .catch((err) => req.log.error({ err }, "ML→CRM webhook sync failed"));
  }

  res.status(200).json({ ok: true, eventId: event.id });
}));

app.get("/webhooks/ml/events", asyncHandler(async (req, res) => {
  res.json({ ok: true, count: webhookEvents.length, events: webhookEvents });
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

        // Generar respuesta IA para col AF
        const aiResp = await fetch(`http://localhost:${config.port}/api/crm/suggest-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consulta: d.resumen_pedido, origen: "WA-Auto",
            cliente: d.cliente, observaciones: d.observaciones,
          }),
        });
        const ai = await aiResp.json();
        if (ai.ok && ai.respuesta) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `'CRM_Operativo'!AF${crmRow}:AG${crmRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[ai.respuesta, ai.provider || ""]] },
          });
        }

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
  if (verified.skipped && config.appEnv !== "test") {
    logger.warn("WHATSAPP_APP_SECRET unset — POST /webhooks/whatsapp HMAC verification skipped");
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
app.use("/api", agentChatRouter);
app.use("/api", agentTrainingRouter);
app.use("/api", agentConversationsRouter);
app.use("/api", agentVoiceRouter);
// Follow-up tracker (local store) — mount before dashboard so routes are unambiguous
app.use("/api", createFollowupsRouter());
app.use("/api", createTransportistaRouter(config, logger));
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
// Wolfboard admin — must be before the broad /api router
app.use("/api/wolfboard", createWolfboardRouter(config));
// BMC Finanzas dashboard: API under /api, static UI at /finanzas
app.use("/api", createBmcDashboardRouter(config));
// Shopify integration v4 (questions/quotes – Mercado Libre replacement)
app.use(createShopifyRouter(config, logger));

const dashboardDir = path.join(__dirname, "../docs/bmc-dashboard-modernization/dashboard");
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
  req.log.error(
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

app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      appEnv: config.appEnv,
      publicBaseUrl: config.publicBaseUrl,
    },
    "MercadoLibre connector server started"
  );
  if (transportistaPool) {
    startTransportistaOutboxWorker({ config, logger, pool: transportistaPool });
  }
});
