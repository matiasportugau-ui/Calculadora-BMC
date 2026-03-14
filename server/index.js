import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config.js";
import { createTokenStore } from "./tokenStore.js";
import { createMercadoLibreClient } from "./mercadoLibreClient.js";
import calcRouter from "./routes/calc.js";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("CORS not allowed"));
  },
}));

// Basic rate limiting — in-memory, sufficient for single-instance
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ ok: false, error: "Too many requests, try again later" });
  }
  next();
});

// Cleanup rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

app.use(express.json({ limit: "1mb" }));
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
  filePath: config.tokenFile,
  encryptionKey: config.tokenEncryptionKey,
  logger,
});
const ml = createMercadoLibreClient({ config, tokenStore, logger });

const missingConfig = () => {
  const missing = [];
  if (!config.mlClientId) missing.push("ML_CLIENT_ID");
  if (!config.mlClientSecret) missing.push("ML_CLIENT_SECRET");
  if (!config.mlRedirectUriDev) missing.push("ML_REDIRECT_URI_DEV");
  if (config.useProdRedirect && !config.mlRedirectUriProd) {
    missing.push("ML_REDIRECT_URI_PROD");
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

app.get("/health", asyncHandler(async (req, res) => {
  const tokens = await ml.getStoredTokens();
  const missing = missingConfig();
  res.json({
    ok: true,
    appEnv: config.appEnv,
    hasTokens: Boolean(tokens?.access_token),
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

app.get("/ml/items/:id", asyncHandler(async (req, res) => {
  const payload = await ml.requestWithRetries({
    method: "GET",
    path: `/items/${req.params.id}`,
  });
  res.json(payload);
}));

app.get("/ml/questions", asyncHandler(async (req, res) => {
  const path = req.query.id ? `/questions/${req.query.id}` : "/questions/search";
  const payload = await ml.requestWithRetries({
    method: "GET",
    path,
    query: req.query.id ? undefined : req.query,
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
  const path = req.query.id ? `/orders/${req.query.id}` : "/orders/search";
  const payload = await ml.requestWithRetries({
    method: "GET",
    path,
    query: req.query.id ? undefined : req.query,
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
