import { metaMessagingWebhookToOmniEvents } from "./metaMessaging.js";

export function messengerWebhookToOmniEvents(body) {
  return metaMessagingWebhookToOmniEvents({ body, channel: "fb", source: "fb_webhook" });
}
