import crypto from "node:crypto";
import { mlWebhookToOmniEvent, extractMlWebhookResourceId } from "./omni/adapters/mlWebhook.js";
import { normalizeAndPersist } from "./omni/normalizer.js";
import { dispatchAdminInbound, mercadoLibreQuestionFields } from "./adminInboundDispatch.js";

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
  getSheets,
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

  async function appendQuestionAdminRow({ notification }) {
    if (!config?.adminInboundRows) return { ok: true, skipped: "flag_off" };
    let question = null;
    try {
      question = await fetchResource({ ml, notification, topic: "questions" });
    } catch (err) {
      logger?.warn?.({ err: err?.message }, "ML admin inbound question fetch failed");
      return { ok: false, error: "question_fetch_failed" };
    }
    return dispatchAdminInbound(
      config,
      mercadoLibreQuestionFields({ notification, question }),
      { logger, getSheets },
    );
  }

  async function processNotification({ body, headers, autoMode } = {}) {
    const topic = mlWebhookTopic({ body, headers });
    if (!SUPPORTED_TOPICS.has(topic)) return { ok: true, skipped: "unsupported_topic", topic };

    const notification = { ...(body || {}), topic };
    const resourceId = extractMlWebhookResourceId(notification);
    // CRM sync is the durable primary for questions — let it throw so the route
    // can 503 and Mercado Libre retries. Omni/Admin stay best-effort.
    const [omniResult, syncResult, adminResult] = await Promise.all([
      persistWebhookToOmni({ notification, topic }).catch((err) => {
        logger?.warn?.({ err: err?.message, topic, resourceId }, "ML omni webhook persist failed");
        return null;
      }),
      topic === "questions"
        ? triggerQuestionCrmSync({ resourceId, autoMode })
        : Promise.resolve(null),
      topic === "questions"
        ? appendQuestionAdminRow({ notification }).catch((err) => {
          logger?.warn?.({ err: err?.message, resourceId }, "ML admin inbound row failed");
          return { ok: false, error: "admin_inbound_failed" };
        })
        : Promise.resolve(null),
    ]);
    return { ok: true, topic, resourceId, omni: omniResult, sync: syncResult, admin: adminResult };
  }

  /**
   * Persist + CRM sync must finish before the HTTP ack. Cloud Run
   * (--min-instances=0) throttles CPU after the response; fire-and-forget
   * processNotification was killed after Mercado Libre already got 200 →
   * permanent drop (no retry). Same class as Meta IG/FB #1314.
   *
   * @returns {Promise<{ event: object, ok: boolean, result?: object, error?: string }>}
   */
  async function handleWebhook({ body, query, headers, autoMode } = {}) {
    const event = buffer.push(buildMlWebhookEvent({ body, query, headers }));
    logger?.info?.({ eventId: event.id, topic: event.headers.topic }, "MercadoLibre webhook received");
    try {
      const result = await processNotification({ body, headers, autoMode });
      return { event, ok: true, result };
    } catch (err) {
      logger?.error?.({ err }, "ML webhook pipeline failed");
      return { event, ok: false, error: err?.message || "pipeline_failed" };
    }
  }

  return {
    buffer,
    handleWebhook,
    processNotification,
    _autoAnswerResourceIds: autoAnswerResourceIds,
  };
}
