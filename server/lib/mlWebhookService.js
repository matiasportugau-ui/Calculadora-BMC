import crypto from "node:crypto";
import { mlWebhookToOmniEvent, extractMlWebhookResourceId } from "./omni/adapters/mlWebhook.js";
import { normalizeAndPersist } from "./omni/normalizer.js";

const SUPPORTED_TOPICS = new Set(["questions", "messages"]);

export function createMlWebhookBuffer(maxEvents = 250) {
  const events = [];
  return {
    push(event) {
      events.unshift(event);
      if (events.length > maxEvents) events.pop();
      return event;
    },
    list() {
      return [...events];
    },
    count() {
      return events.length;
    },
  };
}

export function mlWebhookTopic({ body, headers } = {}) {
  return String(body?.topic || headers?.["x-topic"] || headers?.topic || "").trim().toLowerCase();
}

export function buildMlWebhookEvent({ body, query, headers } = {}) {
  return {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    body,
    query,
    headers: {
      "x-request-id": headers?.["x-request-id"],
      topic: headers?.["x-topic"] || headers?.topic,
      "x-signature": headers?.["x-signature"],
    },
  };
}

export async function defaultFetchMlWebhookResource({ ml, notification, topic }) {
  const resource = String(notification?.resource || "").trim();
  if (resource.startsWith("/")) {
    return ml.requestWithRetries({ method: "GET", path: resource });
  }
  const resourceId = extractMlWebhookResourceId(notification);
  if (topic === "questions" && resourceId) {
    return ml.requestWithRetries({ method: "GET", path: `/questions/${resourceId}` });
  }
  return null;
}

export function createMlWebhookProcessor({
  ml,
  config,
  logger,
  syncMLCRM,
  autoAnswerPipeline,
  fetchResource = defaultFetchMlWebhookResource,
  persistOmni = normalizeAndPersist,
  buffer = createMlWebhookBuffer(),
} = {}) {
  const autoAnswerResourceIds = new Set();

  async function persistWebhookToOmni({ notification, topic }) {
    if (!config?.omniMlShadowWrite) return null;
    const resourcePayload = await fetchResource({ ml, notification, topic });
    const event = mlWebhookToOmniEvent({ notification, resourcePayload, topic });
    if (!event) return null;
    return persistOmni(event, { databaseUrl: config.databaseUrl, logger });
  }

  async function triggerQuestionCrmSync({ resourceId, autoMode }) {
    if (!config?.bmcSheetId || !syncMLCRM) return { synced: 0 };
    const credsPath = config.googleApplicationCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS || "";
    const syncResult = await syncMLCRM({ ml, sheetId: config.bmcSheetId, credsPath, logger });

    if (autoMode?.fullAuto && autoAnswerPipeline && Array.isArray(syncResult.rows) && syncResult.rows.length > 0) {
      const rows = syncResult.rows.filter((row) => {
        const qid = String(row.questionId || "");
        if (!qid) return false;
        if (resourceId && qid !== String(resourceId)) return false;
        if (autoAnswerResourceIds.has(qid)) return false;
        autoAnswerResourceIds.add(qid);
        return true;
      });
      if (rows.length > 0) {
        logger?.info?.({ count: rows.length }, "ML auto-mode ON — running auto-answer pipeline");
        const { answered } = await autoAnswerPipeline({ rows, ml, sheetId: config.bmcSheetId, credsPath, config, logger });
        logger?.info?.({ answered }, "ML auto-answer pipeline complete");
        syncResult.autoAnswered = answered;
      }
    }
    return syncResult;
  }

  async function processNotification({ body, headers, autoMode } = {}) {
    const topic = mlWebhookTopic({ body, headers });
    if (!SUPPORTED_TOPICS.has(topic)) return { ok: true, skipped: "unsupported_topic", topic };

    const notification = { ...(body || {}), topic };
    const resourceId = extractMlWebhookResourceId(notification);
    const [omniResult, syncResult] = await Promise.all([
      persistWebhookToOmni({ notification, topic }).catch((err) => {
        logger?.warn?.({ err: err?.message, topic, resourceId }, "ML omni webhook persist failed");
        return null;
      }),
      topic === "questions"
        ? triggerQuestionCrmSync({ resourceId, autoMode })
        : Promise.resolve(null),
    ]);
    return { ok: true, topic, resourceId, omni: omniResult, sync: syncResult };
  }

  function handleWebhook({ body, query, headers, autoMode } = {}) {
    const event = buffer.push(buildMlWebhookEvent({ body, query, headers }));
    logger?.info?.({ eventId: event.id, topic: event.headers.topic }, "MercadoLibre webhook received");
    processNotification({ body, headers, autoMode }).catch((err) => {
      logger?.error?.({ err }, "ML webhook pipeline failed");
    });
    return event;
  }

  return {
    buffer,
    handleWebhook,
    processNotification,
    _autoAnswerResourceIds: autoAnswerResourceIds,
  };
}
