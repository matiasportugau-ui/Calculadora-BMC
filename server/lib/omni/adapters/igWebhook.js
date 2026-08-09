import { metaMessagingWebhookToOmniEvents } from "./metaMessaging.js";

export function igWebhookToOmniEvents(body) {
  return metaMessagingWebhookToOmniEvents({ body, channel: "ig", source: "ig_webhook" });
}
