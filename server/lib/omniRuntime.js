import { getOmniPool } from "./omniDb.js";
import { verifyWhatsAppSignature } from "./whatsappSignature.js";
import {
  upsertOmniThread,
  insertOmniMessageIfNew,
  insertOmniAttachment,
  enqueueOmniOutbox,
  listThreadsPendingFlush,
  classifyInboundTextHeuristic,
} from "./omniRepository.js";
import { flushOmniThreadToCrm } from "./omniFlush.js";
import { syncDialogoToSheets } from "./omniCrmSync.js";
import { maybeOmniAutoReply } from "./omniAutoReply.js";
import { extractMetaMessagingEvents } from "./omniMetaWebhook.js";
import {
  claimNextOmniOutboxJob,
  completeOmniJob,
  processOmniOutboxJob,
} from "./omniOutboxProcessor.js";

const WA_INACTIVITY_MS = 5 * 60 * 1000;

function safeWebhookChallenge(value) {
  const challenge = String(value ?? "");
  // Meta challenge tokens are short URL-safe strings; reject anything else.
  if (!/^[A-Za-z0-9._-]{1,256}$/.test(challenge)) return null;
  return challenge;
}

/**
 * @param {object} msg WhatsApp Cloud payload message
 */
function extractWhatsAppBodyText(msg) {
  const t =
    msg.text?.body ||
    msg.button?.text ||
    msg.interactive?.button_reply?.title ||
    msg.interactive?.list_reply?.title ||
    msg.caption ||
    "";
  if (t) return t;
  if (msg.type && msg.type !== "text") return `(${msg.type})`;
  return "";
}

/**
 * @param {import("express").Application} app
 * @param {{ config: object, logger: object, asyncHandler: function }} deps
 */
export function registerOmniRuntime(app, { config, logger, asyncHandler }) {
  const omniPool = getOmniPool({
    omniDatabaseUrl: config.omniDatabaseUrl,
    databaseUrl: config.databaseUrl,
  });

  const internalBase = () => `http://127.0.0.1:${config.port}`;

  /** @type {Map<string, { messages: Array<{from:string,text:string,ts:string}>, contactName: string, lastUpdate: number }>} */
  const waConversationsLegacy = new Map();

  setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [k, v] of waConversationsLegacy) {
      if (v.lastUpdate < cutoff) waConversationsLegacy.delete(k);
    }
  }, 60 * 60 * 1000);

  async function processWaConversationLegacy(chatId, conv) {
    const dialogo = conv.messages.map((m) => `${m.ts.slice(11, 16)} - ${m.from}: ${m.text}`).join("\n");
    logger.info(`[WA] Processing conversation (legacy) for ${chatId} (${conv.messages.length} msgs)`);
    await syncDialogoToSheets({
      config,
      logger,
      dialogo,
      externalContactId: chatId,
      origen: "WA-Auto",
      baseUrl: internalBase(),
    });
    waConversationsLegacy.delete(chatId);
  }

  setInterval(() => {
    const now = Date.now();
    if (!omniPool) {
      for (const [chatId, conv] of waConversationsLegacy.entries()) {
        if (now - conv.lastUpdate >= WA_INACTIVITY_MS && conv.messages.length > 0) {
          logger.info(`[WA] Auto-trigger legacy: ${chatId}`);
          processWaConversationLegacy(chatId, conv);
        }
      }
    }
  }, 60 * 1000);

  if (omniPool) {
    setInterval(async () => {
      try {
        const rows = await listThreadsPendingFlush(omniPool, WA_INACTIVITY_MS);
        for (const th of rows) {
          logger.info({ threadId: th.id }, "[omni] Auto-flush thread");
          await flushOmniThreadToCrm(omniPool, config, logger, th, internalBase());
        }
      } catch (e) {
        logger.warn({ err: e.message }, "[omni] flush sweep failed");
      }
    }, 60 * 1000);

    setInterval(async () => {
      try {
        const job = await claimNextOmniOutboxJob(omniPool);
        if (!job) return;
        try {
          await processOmniOutboxJob(omniPool, config, logger, job);
          await completeOmniJob(omniPool, job.id, null);
        } catch (err) {
          logger.warn({ err: err.message, jobId: job.id }, "[omni] outbox job failed");
          await completeOmniJob(omniPool, job.id, err.message);
        }
      } catch (e) {
        logger.warn({ err: e.message }, "[omni] outbox tick failed");
      }
    }, 10 * 1000);
  }

  app.get("/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = safeWebhookChallenge(req.query["hub.challenge"]);
    if (mode === "subscribe" && token === config.whatsappVerifyToken && challenge) {
      return res.type("text/plain").status(200).send(challenge);
    }
    res.status(403).send("Forbidden");
  });

  app.get("/webhooks/meta", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = safeWebhookChallenge(req.query["hub.challenge"]);
    const verify = config.metaWebhookVerifyToken || config.whatsappVerifyToken;
    if (mode === "subscribe" && token === verify && challenge) {
      return res.type("text/plain").status(200).send(challenge);
    }
    res.status(403).send("Forbidden");
  });

  app.post(
    "/webhooks/whatsapp",
    asyncHandler(async (req, res) => {
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
        const chatId = msg.from;
        const contactName = value.contacts?.[0]?.profile?.name || msg.from;
        const wamid = msg.id || `${chatId}-${msg.timestamp || Date.now()}`;
        const bodyText = extractWhatsAppBodyText(msg);

        if (!omniPool) {
          const text = msg.text?.body || msg.caption || "";
          if (!text) continue;
          if (!waConversationsLegacy.has(chatId)) {
            waConversationsLegacy.set(chatId, { messages: [], contactName, lastUpdate: Date.now() });
          }
          const conv = waConversationsLegacy.get(chatId);
          conv.messages.push({ from: contactName, text, ts: new Date().toISOString() });
          conv.lastUpdate = Date.now();
          if (text.includes("🚀")) {
            processWaConversationLegacy(chatId, conv);
          }
          continue;
        }

        try {
          const threadRow = await upsertOmniThread(omniPool, {
            channel: "whatsapp",
            externalThreadId: String(chatId),
            contactName,
            defaultMode: config.omniModeDefault,
          });
          const heuristic = classifyInboundTextHeuristic(bodyText);
          const ins = await insertOmniMessageIfNew(omniPool, {
            channel: "whatsapp",
            externalMessageId: String(wamid),
            threadId: threadRow.id,
            bodyText: bodyText || null,
            rawPayload: msg,
            consultaTipo: heuristic.consulta_tipo,
            classificationScore: heuristic.classification_score,
          });
          if (ins.skipped) continue;

          const mediaPairs = [];
          if (msg.type === "image" && msg.image?.id) mediaPairs.push(["image", msg.image.id]);
          if (msg.type === "audio" && msg.audio?.id) mediaPairs.push(["audio", msg.audio.id]);
          if (msg.type === "video" && msg.video?.id) mediaPairs.push(["video", msg.video.id]);
          if (msg.type === "document" && msg.document?.id) mediaPairs.push(["document", msg.document.id]);
          for (const [kind, mid] of mediaPairs) {
            const aid = await insertOmniAttachment(omniPool, {
              messageId: ins.messageId,
              mediaKind: kind,
              whatsappMediaId: String(mid),
            });
            await enqueueOmniOutbox(omniPool, "wa_media_download", {
              attachmentId: aid,
              messageId: ins.messageId,
            });
          }

          const fullThread = await omniPool.query(`select * from omni_threads where id = $1`, [threadRow.id]);
          const th = fullThread.rows[0];

          if (bodyText.includes("🚀")) {
            await flushOmniThreadToCrm(omniPool, config, logger, th, internalBase());
          } else {
            await maybeOmniAutoReply(
              omniPool,
              config,
              logger,
              { id: th.id, channel: "whatsapp", external_thread_id: th.external_thread_id },
              ins.messageId,
              heuristic.consulta_tipo,
              bodyText,
            );
          }
        } catch (e) {
          logger.error({ err: e.message }, "[omni] whatsapp inbound failed");
        }
      }
    }),
  );

  app.post(
    "/webhooks/meta",
    asyncHandler(async (req, res) => {
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

      let body = {};
      try {
        if (raw.length) body = JSON.parse(raw.toString("utf8"));
      } catch {
        return res.status(200).json({ ok: true });
      }
      res.status(200).json({ ok: true });

      if (!omniPool) {
        logger.warn("[omni] POST /webhooks/meta ignored — database not configured");
        return;
      }

      const events = extractMetaMessagingEvents(body);
      for (const ev of events) {
        try {
          const ch = ev.channel;
          const threadRow = await upsertOmniThread(omniPool, {
            channel: ch,
            externalThreadId: ev.senderId,
            contactName: null,
            defaultMode: config.omniModeDefault,
          });
          const heuristic = classifyInboundTextHeuristic(ev.text);
          const ins = await insertOmniMessageIfNew(omniPool, {
            channel: ch,
            externalMessageId: ev.messageId,
            threadId: threadRow.id,
            bodyText: ev.text || null,
            rawPayload: ev.raw,
            consultaTipo: heuristic.consulta_tipo,
            classificationScore: heuristic.classification_score,
          });
          if (ins.skipped) continue;

          const fullThread = await omniPool.query(`select * from omni_threads where id = $1`, [threadRow.id]);
          const th = fullThread.rows[0];
          if (ev.text.includes("🚀")) {
            await flushOmniThreadToCrm(omniPool, config, logger, th, internalBase());
          } else {
            await maybeOmniAutoReply(
              omniPool,
              config,
              logger,
              { id: th.id, channel: ch, external_thread_id: th.external_thread_id },
              ins.messageId,
              heuristic.consulta_tipo,
              ev.text,
            );
          }
        } catch (e) {
          logger.error({ err: e.message }, "[omni] meta inbound failed");
        }
      }
    }),
  );
}
