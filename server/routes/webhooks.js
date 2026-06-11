import express from "express";
import crypto from "node:crypto";
import { verifyWhatsAppSignature } from "../lib/whatsappSignature.js";
import { verifyMLSignature } from "../lib/mlSignature.js";
import { config } from "../config.js";
import { getPanelinPool } from "../lib/panelinDb.js";
import facturaExpress from "../lib/facturaExpressClient.js";

// This module begins the monolith decomposition (Phase 1 from the audit).
// The raw body parsers for /webhooks/whatsapp and /webhooks/shopify remain in server/index.js
// (they must run before json parsing). We mount this router after those parsers.

const router = express.Router();

// ML webhook (signature verification + basic handling)
router.post("/ml", async (req, res, next) => {
  try {
    const mlSigVerified = verifyMLSignature({
      clientSecret: config.mlClientSecret,
      signatureHeader: req.headers["x-signature"],
      dataId: req.query.id ?? req.body?.id,
      requestId: req.headers["x-request-id"],
    });

    if (!mlSigVerified.skipped && !mlSigVerified.ok) {
      req.log?.warn({ reason: mlSigVerified.reason }, "ML webhook: invalid HMAC signature — rejected");
      return res.status(401).json({ ok: false, error: "Invalid webhook signature" });
    }
    if (mlSigVerified.reason === "secret_not_configured") {
      req.log?.error("ML_CLIENT_SECRET is not configured — rejecting webhook for security");
      return res.status(503).json({ ok: false, error: "Webhook security not configured" });
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

    req.log?.info({ topic: req.headers["x-topic"] }, "MercadoLibre webhook received");

    // TODO (next iteration): move event buffering + CRM sync trigger here or to a service
    res.status(200).json({ ok: true });
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

// ============================================================
// FacturaExpress webhook (Fase 4)
// Recibe notificaciones de CFE emitidos, cambios de estado, ajustes de stock, etc.
// Almacena fallos en webhook_failures (DLQ de Fase 1).
// En eventos que afectan stock → llama panelin_record_stock_movement (trigger de stock).
// ============================================================
router.post("/facturaexpress", async (req, res, next) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers["x-signature"] || req.headers["x-facturaexpress-signature"];

  try {
    // Verificación de firma (si está configurado el secreto)
    const verification = facturaExpress.verifyWebhookSignature(raw, signature);
    if (!verification.skipped && !verification.ok) {
      req.log?.warn({ reason: "invalid_signature" }, "FacturaExpress webhook: firma inválida");
      return res.status(401).json({ ok: false, error: "invalid_signature" });
    }

    let payload = {};
    try {
      payload = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      return res.status(200).json({ ok: true }); // ack de todos modos
    }

    const event = payload.event || payload.type || "unknown";
    const data = payload.data || payload;

    req.log?.info({ event, hasExternalId: !!data.external_id }, "FacturaExpress webhook recibido");

    // Procesar de forma asíncrona (no bloquear respuesta)
    processFacturaExpressWebhook({ event, data, rawPayload: payload }).catch((e) => {
      req.log?.error({ err: e, event }, "[facturaexpress] procesamiento async falló");
    });

    // Responder rápido al proveedor
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function processFacturaExpressWebhook({ event, data, rawPayload }) {
  const pool = getPanelinPool(config.databaseUrl || process.env.DATABASE_URL);
  if (!pool) {
    throw new Error("panelin DB no disponible para procesar webhook FacturaExpress");
  }

  const client = await pool.connect();
  try {
    // 1. Persistir la factura si viene información (sync inbound)
    if (data.external_id || data.id) {
      const externalId = data.external_id || data.id;
      await client.query(
        `INSERT INTO invoices (external_id, number, date, client_name, total_usd, status, source, raw)
         VALUES ($1, $2, $3, $4, $5, $6, 'facturaexpress', $7)
         ON CONFLICT (external_id) DO UPDATE SET
           status = EXCLUDED.status,
           raw = EXCLUDED.raw,
           number = COALESCE(EXCLUDED.number, invoices.number)`,
        [
          externalId,
          data.number || data.cfe_number || null,
          data.date || data.emission_date || null,
          data.client_name || data.receptor || null,
          data.total || data.total_usd || null,
          data.status || event,
          rawPayload,
        ]
      );
    }

    // 2. Si el evento o payload indica movimiento de stock (venta, emisión de factura con ítems, ajuste)
    // Ejemplo de payload esperado del proveedor: { items: [{sku: "...", qty: -3}], reason: "venta" }
    const items = data.items || data.lineas || (data.sku ? [{ sku: data.sku, qty: data.qty || data.delta }] : []);
    if (items.length > 0) {
      for (const item of items) {
        const sku = item.sku || item.codigo || item.product_sku;
        const delta = Number(item.qty ?? item.cantidad ?? item.delta ?? 0);
        if (!sku || !delta) continue;

        const reason = item.reason || (event.includes("invoice") ? "venta" : "facturaexpress_webhook");
        const refId = data.external_id || data.id || data.cfe_id || "webhook";

        // Usa la función de Fase 1 (control de negativo + alertas + movimiento)
        await client.query(
          `SELECT panelin_record_stock_movement($1, 'principal', $2, $3, 'facturaexpress_webhook', $4)`,
          [sku, delta, reason, refId]
        );
      }
    }

    // 3. Otros eventos (cambio de precio desde FE, etc.) pueden disparar sync aquí en futuro.
  } finally {
    client.release();
  }
}

export default router;