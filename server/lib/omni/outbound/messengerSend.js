import { sendMetaMessage } from "./metaSend.js";

export async function sendMessengerReply({ config, recipientId, text, lastCustomerAt, tag, fetchImpl, now }) {
  return sendMetaMessage({
    pageToken: config?.fbPageToken,
    recipientId,
    text,
    lastCustomerAt,
    tag,
    fetchImpl,
    now,
  });
}
