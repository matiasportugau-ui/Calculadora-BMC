import { verifyWhatsAppSignature } from "../whatsappSignature.js";
import { normalizeAndPersist } from "./normalizer.js";
import { igWebhookToOmniEvents } from "./adapters/igWebhook.js";
import { messengerWebhookToOmniEvents } from "./adapters/messengerWebhook.js";

export function verifyMetaWebhookSubscribe(req, verifyToken) {
  const mode = req?.query?.["hub.mode"];
  const token = req?.query?.["hub.verify_token"];
  const challenge = req?.query?.["hub.challenge"];
  if (mode === "subscribe" && token === verifyToken) {
    return { ok: true, status: 200, body: String(challenge ?? "") };
  }
  return { ok: false, status: 403, body: "Forbidden" };
}

function adapterFor(channel) {
  if (channel === "ig") return igWebhookToOmniEvents;
  if (channel === "fb") return messengerWebhookToOmniEvents;
  throw new Error(`unsupported_meta_channel:${channel}`);
}

/**
 * Meta webhooks require quick 200s. This helper returns the HTTP ack plus a
 * promise for best-effort persistence so routes can ack before DB work.
 * @param {{ channel:"ig"|"fb", enabled:boolean, appSecret:string, rawBodyBuffer:Buffer,
 * signatureHeader?:string, config:object, logger?:object, persist?:Function }} args
 */
export function handleMetaMessagingWebhook(args) {
  const { channel, enabled, appSecret, rawBodyBuffer, signatureHeader, config, logger } = args;
  if (!enabled) {
    logger?.debug?.({ channel }, "Meta messaging webhook ignored because flag is OFF");
    return { status: 200, body: { ok: true, skipped: "flag_off" }, processing: Promise.resolve([]) };
  }

  const verified = verifyWhatsAppSignature({ appSecret, rawBodyBuffer, signatureHeader });
  if (!verified.skipped && !verified.ok) {
    return { status: 401, body: { ok: false, error: "invalid webhook signature" }, processing: Promise.resolve([]) };
  }
  if (verified.reason === "secret_not_configured") {
    logger?.error?.({ channel }, "Meta app secret is not configured — rejecting webhook for security");
    return { status: 503, body: { ok: false, error: "Webhook security not configured" }, processing: Promise.resolve([]) };
  }

  let body = {};
  try {
    if (rawBodyBuffer?.length) body = JSON.parse(rawBodyBuffer.toString("utf8"));
  } catch {
    return { status: 200, body: { ok: true }, processing: Promise.resolve([]) };
  }

  const events = adapterFor(channel)(body);
  const persist = args.persist || normalizeAndPersist;
  const processing = Promise.all(
    events.map((event) =>
      persist(event, { databaseUrl: config.databaseUrl, logger }).catch((err) => {
        logger?.warn?.({ err: err?.message, idempotency_key: event.idempotency_key }, "Meta omni persist failed");
        return null;
      }),
    ),
  );
  return { status: 200, body: { ok: true, events: events.length }, processing };
}
