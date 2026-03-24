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
import { createTokenStore } from "./tokenStore.js";
import { createMercadoLibreClient } from "./mercadoLibreClient.js";
import calcRouter from "./routes/calc.js";
import legacyQuoteRouter from "./routes/legacyQuote.js";
import createBmcDashboardRouter from "./routes/bmcDashboard.js";
import createShopifyRouter from "./routes/shopify.js";

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

// Shopify webhook needs raw body for HMAC; skip json for that path
app.use("/webhooks/shopify", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.path === "/webhooks/shopify" && req.method === "POST") return next();
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
  const tokens = await ml.getStoredTokens();
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
    hasSheets,
    missingConfig: missing,
  });
}));

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
  const tokens = await ml.getStoredTokens();
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
  const payload = await ml.requestWithRetries({
    method: "POST",
    path: "/answers",
    body: {
      question_id: Number(req.params.id),
      text: req.body.text,
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
  res.status(200).json({ ok: true, eventId: event.id });
}));

app.get("/webhooks/ml/events", asyncHandler(async (req, res) => {
  res.json({ ok: true, count: webhookEvents.length, events: webhookEvents });
}));

app.use("/calc", calcRouter);
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

app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      appEnv: config.appEnv,
      publicBaseUrl: config.publicBaseUrl,
    },
    "MercadoLibre connector server started"
  );
});
