import express from "express";
import rateLimit from "express-rate-limit";
import { verifyWhatsAppSignature } from "../lib/whatsappSignature.js";
import { verifyMLSignature } from "../lib/mlSignature.js";
import { authorizeMlWebhook, cloudRunPeerIp, mlWebhookRateKey } from "../lib/mlWebhookAuth.js";
import { config } from "../config.js";
import { createMlWebhookBuffer, createMlWebhookProcessor } from "../lib/mlWebhookService.js";

// This module begins the monolith decomposition (Phase 1 from the audit).
// The raw body parsers for /webhooks/whatsapp and /webhooks/shopify remain in server/index.js
// (they must run before json parsing). We mount this router after those parsers.

const router = express.Router();
const mlWebhookBuffer = createMlWebhookBuffer(250);
const mlWebhookProcessor = createMlWebhookProcessor({ config, buffer: mlWebhookBuffer });

const mlWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: mlWebhookRateKey,
  message: { ok: false, error: "rate_limited" },
});

// ML webhook (signature verification + basic handling)
router.post("/ml", mlWebhookLimiter, async (req, res, next) => {
  try {
    const mlSigVerified = verifyMLSignature({
      clientSecret: config.mlClientSecret,
      signatureHeader: req.headers["x-signature"],
      dataId: req.query.id ?? req.body?.id,
      requestId: req.headers["x-request-id"],
    });
    const decision = authorizeMlWebhook({
      mlSigVerified,
      peerIp: cloudRunPeerIp(req),
      webhookVerifyToken: config.webhookVerifyToken,
      receivedToken:
        req.query.verify_token ||
        req.headers["x-webhook-token"] ||
        req.headers.authorization,
    });
    if (!decision.accept) {
      const error = decision.reason === "invalid_webhook_token"
        ? "Invalid webhook token"
        : "Invalid webhook signature";
      req.log?.warn({ reason: decision.reason, via: decision.via }, "ML webhook: invalid HMAC signature — rejected");
      return res.status(401).json({ ok: false, error });
    }
    if (decision.via === "ip_allowlist") {
      req.log?.info({ peerIp: decision.peerIp }, "ML webhook: accepted from published notification IP");
    }

    // Await before ack — Cloud Run kills fire-and-forget after 200 (min-instances=0).
    const outcome = await mlWebhookProcessor.handleWebhook({
      body: req.body,
      query: req.query,
      headers: req.headers,
      autoMode: { fullAuto: false },
    });

    if (!outcome.ok) {
      return res.status(503).json({
        ok: false,
        error: "pipeline_failed",
        eventId: outcome.event.id,
      });
    }

    res.status(200).json({ ok: true, eventId: outcome.event.id });
  } catch (err) {
    next(err);
  }
});

// WhatsApp verification (GET)
router.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    res.set("Content-Type", "text/plain");
    return res.status(200).send(String(challenge ?? ""));
  }
  res.status(403).send("Forbidden");
});

// WhatsApp messages (POST) - raw body already parsed by middleware in index.js
router.post("/whatsapp", async (req, res, next) => {
  try {
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
      req.log?.error("WHATSAPP_APP_SECRET is not configured — rejecting webhook for security");
      return res.status(503).json({ ok: false, error: "Webhook security not configured" });
    }

    let body = {};
    try {
      if (raw.length) body = JSON.parse(raw.toString("utf8"));
    } catch {
      return res.status(200).json({ ok: true });
    }

    res.status(200).json({ ok: true });

    // TODO (next iteration): move full processWaConversation + waConversations map + inactivity loop here
    // For now the heavy lifting stays in index.js to keep this extraction incremental.
  } catch (err) {
    next(err);
  }
});

// Shopify webhook is intentionally left in index.js for this step
// (it has its own raw parser and different processing).

export default router;