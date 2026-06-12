import express from "express";
import { config } from "../config.js";
import { getPanelinPool } from "../lib/panelinDb.js";
import facturaExpress from "../lib/facturaExpressClient.js";
import { emitPanelinEvent } from "../lib/panelinEvents.js";

// This module supports incremental monolith decomposition (Phase 1 from the audit).
// Raw body parsers for /webhooks/* (incl. facturaexpress) remain in server/index.js
// (must run before json parsing). We mount this router under /webhooks after those parsers.
//
// Current state (post review-5ae44e21 fix for Issue 1):
// - ML and WhatsApp routes were stubbed here during initial extraction but the live heavy
//   processing (and direct handlers) remain in index.js to avoid shadowing/breakage during
//   incremental step. Those stubs have been removed from this router so a safe mount of
//   the router does not conflict with the inline /webhooks/ml and /webhooks/whatsapp handlers.
// - This router now hosts ONLY the FacturaExpress handler (the complete new surface for Fase 4).
// - Full consolidation of WA/ML into the router can happen in a follow-up extraction.
// See server/index.js for the raw parsers + direct webhook handlers + mount point.

const router = express.Router();

// ============================================================
// FacturaExpress webhook (Fase 4)
// Recibe notificaciones de CFE emitidos, cambios de estado, ajustes de stock, etc.
// - Verifica firma (si FACTURAEXPRESS_WEBHOOK_SECRET configurado)
// - Upsert a invoices
// - Llama panelin_record_stock_movement (Fase 1) para actualizar stock + alertas automáticas
// - En error: logged (DLQ table insert planned; see review-5ae44e21 Issue 6 — current: catch logs only per suggestion to avoid claim mismatch; tx not wrapped for atomicity in v1 stub)
// Review fix traceability: Issue 1 (mount/router), 3 (sig in client), 6/7/13 (comments + error shape).
// ============================================================
router.post("/facturaexpress", async (req, res, next) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.headers["x-signature"] || req.headers["x-facturaexpress-signature"];

  try {
    // Verificación de firma (si está configurado el secreto)
    const verification = facturaExpress.verifyWebhookSignature(raw, signature);
    if (!verification.skipped && !verification.ok) {
      req.log?.warn({ reason: verification.reason || "invalid_signature" }, "FacturaExpress webhook: firma inválida");
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

        // Fase 6 realtime: notify listeners (SSE) after successful stock movement
        emitPanelinEvent('stock.movement', { sku, delta, reason, source: 'facturaexpress_webhook', refId });
      }
    }

    // Fase 6 realtime: notify after invoice upsert (even if no stock items)
    if (data.external_id || data.id) {
      emitPanelinEvent('invoice.upserted', {
        external_id: data.external_id || data.id,
        source: 'facturaexpress_webhook',
        event,
      });
    }

    // 3. Otros eventos (cambio de precio desde FE, etc.) pueden disparar sync aquí en futuro.
  } catch (err) {
    // DLQ: almacenar fallo para reintento manual o worker futuro (tabla de Fase 1)
    try {
      await client.query(
        `INSERT INTO webhook_failures (source, event_type, payload, error, attempts, last_attempt)
         VALUES ('facturaexpress', $1, $2, $3, 1, now())
         ON CONFLICT DO NOTHING`,
        [event, rawPayload, err.message || String(err)]
      );
    } catch (dlqErr) {
      // No re-lanzar para no romper el ack
      console.error("[facturaexpress] DLQ insert failed:", dlqErr.message);
    }
    throw err; // re-lanzar para que el caller loguee
  } finally {
    client.release();
  }
}

export default router;