import express from "express";
import { verifyWhatsAppSignature } from "../lib/whatsappSignature.js";
import { verifyMLSignature } from "../lib/mlSignature.js";
import { config } from "../config.js";

// This module begins the monolith decomposition (Phase 1 from the audit).
// The raw body parsers for /webhooks/whatsapp and /webhooks/shopify remain in server/index.js
// (they must run before json parsing). We mount this router after those parsers.
//
// For ML and WhatsApp POST handlers, this router only performs signature verification.
// If the signature is invalid it rejects immediately; otherwise it calls next() so
// the legacy handlers in index.js continue to process the business logic (CRM sync, etc).

const router = express.Router();

// ML webhook (signature verification only — legacy handler in index.js does CRM sync)
router.post("/ml", (req, res, next) => {
  try {
    const mlSigVerified = verifyMLSignature({
      clientSecret: config.mlClientSecret,
      signatureHeader: req.headers["x-signature"],
      dataId: req.query.id ?? req.body?.id,
      requestId: req.headers["x-request-id"],
    });

    if (!mlSigVerified.skipped && !mlSigVerified.ok) {
      if (mlSigVerified.reason === "secret_not_configured") {
        req.log?.error("ML_CLIENT_SECRET is not configured — rejecting webhook for security");
        return res.status(503).json({ ok: false, error: "Webhook security not configured" });
      }
      req.log?.warn({ reason: mlSigVerified.reason }, "ML webhook: invalid HMAC signature — rejected");
      return res.status(401).json({ ok: false, error: "Invalid webhook signature" });
    }

    if (config.webhookVerifyToken) {
      const received =
        req.query.verify_token ||
        req.headers["x-webhook-token"] ||
        req.headers.authorization;
      if (String(received) !== String(config.webhookVerifyToken)) {
        return res.status(401).json({ ok: false, error: "Invalid webhook token" });
      }
    }

    // Signature valid — pass through to legacy handler for CRM sync + event buffering
    next();
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

// WhatsApp messages (POST) — signature verification only; legacy handler processes messages
router.post("/whatsapp", (req, res, next) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const sig = req.headers["x-hub-signature-256"];

    const verified = verifyWhatsAppSignature({
      appSecret: config.whatsappAppSecret,
      rawBodyBuffer: raw,
      signatureHeader: sig,
    });

    if (!verified.skipped && !verified.ok) {
      if (verified.reason === "secret_not_configured") {
        req.log?.error("WHATSAPP_APP_SECRET is not configured — rejecting webhook for security");
        return res.status(503).json({ ok: false, error: "Webhook security not configured" });
      }
      return res.status(401).json({ ok: false, error: "invalid webhook signature" });
    }

    // Signature valid — pass through to legacy handler for CRM processing
    next();
  } catch (err) {
    next(err);
  }
});

// Shopify webhook is intentionally left in index.js for this step
// (it has its own raw parser and different processing).

export default router;