/**
 * chatwoot.js — inbound webhook from the self-hosted Chatwoot shared inbox.
 *
 * Flow (see plan: BMC Shared Operator Inbox via Chatwoot):
 *   Chatwoot (shared email inbox) --webhook--> POST /api/chatwoot/webhook
 *     1. verify shared secret (CHATWOOT_WEBHOOK_SECRET)
 *     2. only act on incoming customer email messages
 *     3. normalize → { remitente, asunto, cuerpo, conversationId }
 *     4. extract structured BMC lead (extractEmailLead) — reused by the agent too
 *     5. write the lead to CRM_Operativo via the EXISTING /api/crm/ingest-email
 *        endpoint (one Sheets-writer path), authenticated server-to-server
 *     6. optional: post the structured lead back as a Chatwoot PRIVATE NOTE so
 *        operators see triage inline; optional draft reply note. NEVER auto-send.
 *
 * Boot-safe: with CHATWOOT_* unset, the route returns 503 "not configured" and
 * the app still starts. Server-to-server only (no browser origin).
 */

import { Router } from "express";
import crypto from "node:crypto";
import {
  isChatwootConfigured,
  postPrivateNote,
  setLabels,
} from "../lib/chatwootClient.js";
import { extractEmailLead } from "../lib/emailLeadIngest.js";

function bool(v, dflt = false) {
  if (v == null || v === "") return dflt;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

/** Timing-safe compare for the shared webhook secret. */
function secretMatches(provided) {
  const expected = process.env.CHATWOOT_WEBHOOK_SECRET || "";
  if (!expected) return false;
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Normalize a Chatwoot webhook payload into a flat email shape. */
function normalize(payload = {}) {
  // Chatwoot sends event + nested objects. We support message_created and
  // conversation_created. Shapes vary slightly by version; be defensive.
  const event = payload.event || payload.event_type || "";
  const conv = payload.conversation || payload.current_conversation || {};
  const conversationId =
    payload.conversation_id || conv.id || payload.id || null;
  const messageType =
    payload.message_type || payload.messageType || conv.last_non_activity_message?.message_type;
  const contact =
    payload.sender || conv.meta?.sender || conv.contact_inbox?.contact || {};
  const remitente = contact.email || contact.identifier || payload.sender_email || "";
  const asunto =
    conv.additional_attributes?.mail_subject ||
    payload.additional_attributes?.mail_subject ||
    conv.subject ||
    "";
  const cuerpo =
    payload.content ||
    conv.last_non_activity_message?.content ||
    payload.processed_message_content ||
    "";
  return { event, conversationId, messageType, remitente, asunto, cuerpo };
}

/** Is this an inbound customer message we should process? */
function isIncomingCustomerEmail(n) {
  if (!n.cuerpo || !String(n.cuerpo).trim()) return false;
  if (n.event && !["message_created", "conversation_created"].includes(n.event)) return false;
  // message_type: "incoming" | 0 means from the customer; ignore outgoing/agent.
  if (n.messageType != null && !["incoming", 0, "0"].includes(n.messageType)) return false;
  return true;
}

export default function createChatwootRouter(config = {}) {
  const router = Router();
  const POST_NOTE = bool(process.env.CHATWOOT_POST_NOTE, true);
  const POST_DRAFT = bool(process.env.CHATWOOT_POST_DRAFT, false);

  // Health/config probe (mirrors GET /health style).
  router.get("/chatwoot/health", (_req, res) => {
    res.json({
      ok: true,
      configured: isChatwootConfigured(),
      hasWebhookSecret: Boolean(process.env.CHATWOOT_WEBHOOK_SECRET),
      postNote: POST_NOTE,
      postDraft: POST_DRAFT,
    });
  });

  router.post("/chatwoot/webhook", async (req, res) => {
    // 1. Gate: feature configured + secret valid.
    if (!isChatwootConfigured()) {
      return res.status(503).json({ ok: false, error: "chatwoot_not_configured" });
    }
    const provided =
      req.headers["x-chatwoot-webhook-secret"] ||
      req.query?.secret ||
      req.body?.secret ||
      "";
    if (!secretMatches(provided)) {
      return res.status(401).json({ ok: false, error: "bad_secret" });
    }

    const n = normalize(req.body || {});

    // 2. Respond 200 FAST; do AI/Sheets work async (Chatwoot retries on slow
    //    webhooks → would create duplicate CRM rows).
    res.status(200).json({ ok: true, accepted: true });

    if (!isIncomingCustomerEmail(n)) return;

    // 3. Async pipeline (fire-and-forget; never throws to the HTTP layer).
    setImmediate(async () => {
      try {
        const extracted = await extractEmailLead({
          remitente: n.remitente,
          asunto: n.asunto,
          cuerpo: n.cuerpo,
        });
        if (!extracted.ok) {
          req.log?.warn?.({ err: extracted.error }, "chatwoot: extract failed");
          return;
        }

        // 4. Write lead to CRM via the existing endpoint (single Sheets path).
        const base = config.selfBaseUrl || `http://127.0.0.1:${config.port || 3001}`;
        const token = config.emailIngestToken || config.apiAuthToken || "";
        try {
          await fetch(`${base}/api/crm/ingest-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              remitente: n.remitente,
              asunto: n.asunto,
              cuerpo: n.cuerpo,
              messageId: n.conversationId ? `chatwoot:${n.conversationId}` : undefined,
              origen: "Email",
            }),
          });
        } catch (e) {
          req.log?.warn?.({ err: String(e?.message || e) }, "chatwoot: CRM ingest forward failed");
        }

        // 5. Optional: post triage back into Chatwoot as a private note.
        if (POST_NOTE && n.conversationId) {
          const L = extracted.lead;
          const note = [
            "🤖 *Lead BMC (auto-triage)*",
            `Cliente: ${L.cliente || "—"}`,
            `Tel: ${L.telefono || "—"} · Ubicación: ${L.ubicacion || "—"}`,
            `Categoría: ${L.categoria || "—"} · Urgencia: ${L.urgencia || "—"}`,
            `Tipo: ${L.tipo_cliente || "—"} · Prob. cierre: ${L.probabilidad_cierre || "—"}`,
            `Cotización formal: ${L.cotizacion_formal || "—"} · Validar stock: ${L.validar_stock || "—"}`,
            "",
            `Resumen: ${L.resumen_pedido || "—"}`,
            L.observaciones ? `Obs: ${L.observaciones}` : "",
          ]
            .filter(Boolean)
            .join("\n");
          try {
            await postPrivateNote(n.conversationId, note);
            const labels = [];
            if (L.urgencia && /hoy|24h/i.test(L.urgencia)) labels.push("urgente");
            if (/^si/i.test(L.cotizacion_formal || "")) labels.push("cotizacion-formal");
            labels.push("lead");
            if (labels.length) await setLabels(n.conversationId, labels).catch(() => {});
          } catch (e) {
            req.log?.warn?.({ err: String(e?.message || e) }, "chatwoot: note/labels failed");
          }
        }

        // 6. Draft reply is gated off by default; the in-app Email Agent owns drafting.
      } catch (e) {
        req.log?.error?.({ err: String(e?.message || e) }, "chatwoot: webhook pipeline error");
      }
    });
  });

  return router;
}
