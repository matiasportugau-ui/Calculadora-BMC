/**
 * /whatsapp/* — internal WhatsApp Cloud API surface (Meta direct route).
 *
 *   POST /whatsapp/send   { to?, text?, template?: {name, lang?, components?}, context_message_id? }
 *                         → { ok, message_id: "wamid...", to, wa_id, message_status, fallback }
 *
 * Auth: static API_AUTH_TOKEN (Bearer or X-Api-Key) via requireAuth. `to` defaults to
 * WHATSAPP_TEST_RECIPIENT and — because this endpoint bypasses the consent + 24h checks
 * that POST /api/wa/outbound enforces — only that number is accepted unless
 * WHATSAPP_SEND_ALLOW_ANY=1.
 *
 * The webhook itself (GET/POST /whatsapp/webhook) is registered in server/index.js
 * next to /webhooks/whatsapp because it needs the raw-body parser and the inbound
 * pipeline that lives there.
 */
import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { WhatsAppApiError, sendWhatsAppTemplate, sendWhatsAppText } from "../lib/whatsappOutbound.js";

const KIND_STATUS = {
  recipient_not_allowed: 422,
  outside_24h_window: 422,
  undeliverable: 422,
  token_invalid: 401,
  rate_limited: 429,
  server_error: 502,
  unknown: 502,
};

export const PORTAL_HINTS = {
  recipient_not_allowed:
    "Meta 131030: the recipient is not in the test number's allow-list. App Dashboard → WhatsApp → API Setup → 'To' → Manage phone number list → add the number and confirm the OTP (max 5 numbers on the free test number).",
  outside_24h_window:
    "Meta 131047: the 24h customer-service window is closed. Send an approved template (set WHATSAPP_FALLBACK_TEMPLATE_NAME) or ask the recipient to message the business number first.",
  token_invalid:
    "Meta 190: WHATSAPP_ACCESS_TOKEN is invalid or expired. Generate a permanent System User token (Business Settings → Users → System users → Generate token, whatsapp_business_messaging + whatsapp_business_management) and rotate it (scripts/wa-refresh-access-token.sh).",
  undeliverable: "Meta 131026: the number is not a WhatsApp user or cannot receive messages.",
  rate_limited: "Meta throttled the send after retries — wait and try again.",
  server_error: "Meta returned a server error after retries — try again later.",
};

function clientKey(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createWhatsAppCloudRouter(config, logger = console) {
  const router = express.Router();
  const sendLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    message: { ok: false, error: "rate_limited" },
  });

  router.post("/send", sendLimiter, requireAuth, express.json({ limit: "64kb" }), async (req, res) => {
    const log = req.log || logger;
    const accessToken = config.whatsappAccessToken;
    const phoneNumberId = config.whatsappPhoneNumberId;
    if (!accessToken || !phoneNumberId) {
      const missing = [];
      if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
      if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
      return res.status(503).json({ ok: false, error: "whatsapp_not_configured", missing });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const to = String(body.to || config.whatsappTestRecipient || "").replace(/\D/g, "");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const template = body.template && typeof body.template === "object" && body.template.name ? body.template : null;
    if (!to) return res.status(400).json({ ok: false, error: "to_required", hint: "Pass `to` (E.164 digits) or set WHATSAPP_TEST_RECIPIENT." });
    if (!text && !template) return res.status(400).json({ ok: false, error: "text_or_template_required" });
    const allowed = config.whatsappSendAllowAny || (config.whatsappTestRecipient && to === config.whatsappTestRecipient);
    if (!allowed) {
      return res.status(400).json({
        ok: false,
        error: "recipient_not_allowed",
        hint: "POST /whatsapp/send only targets WHATSAPP_TEST_RECIPIENT unless WHATSAPP_SEND_ALLOW_ANY=1 (it skips consent/24h checks).",
      });
    }

    const common = { to, accessToken, phoneNumberId, logger: log };
    try {
      const data = template
        ? await sendWhatsAppTemplate({
            ...common,
            name: String(template.name),
            lang: template.lang || template.language || config.whatsappFallbackTemplateLang,
            components: Array.isArray(template.components) ? template.components : undefined,
          })
        : await sendWhatsAppText({
            ...common,
            text,
            contextMessageId: body.context_message_id ? String(body.context_message_id) : undefined,
            fallbackTemplate: config.whatsappFallbackTemplateName
              ? { name: config.whatsappFallbackTemplateName, lang: config.whatsappFallbackTemplateLang }
              : null,
          });
      const messageId = data?.messages?.[0]?.id ?? null;
      log.info?.(
        { event: "wa_send", to, message_id: messageId, kind: template ? "template" : "text", fallback: data?.fallback ?? null },
        "[WA] /whatsapp/send ok",
      );
      return res.json({
        ok: true,
        message_id: messageId,
        to,
        wa_id: data?.contacts?.[0]?.wa_id ?? null,
        message_status: data?.messages?.[0]?.message_status ?? null,
        fallback: data?.fallback ?? null,
      });
    } catch (e) {
      if (e instanceof WhatsAppApiError) {
        const status = KIND_STATUS[e.kind] || 502;
        log.warn?.(
          { event: "wa_send_failed", to, kind: e.kind, code: e.code, graph_status: e.graphStatus, fbtrace_id: e.fbtraceId },
          "[WA] /whatsapp/send failed",
        );
        return res.status(status).json({
          ok: false,
          error: e.kind,
          code: e.code,
          message: e.message,
          fbtrace_id: e.fbtraceId,
          details: e.details,
          hint: PORTAL_HINTS[e.kind] || null,
        });
      }
      log.error?.({ err: e?.message, to }, "[WA] /whatsapp/send error");
      return res.status(502).json({ ok: false, error: "send_failed", message: e?.message || "send failed" });
    }
  });

  return router;
}

export default createWhatsAppCloudRouter;
