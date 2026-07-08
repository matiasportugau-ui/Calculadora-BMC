import { sendMetaMessage } from "./metaSend.js";

export async function sendIgReply({ config, recipientId, text, lastCustomerAt, tag, fetchImpl, now }) {
  return sendMetaMessage({
    pageToken: config?.igPageToken,
    recipientId,
    text,
    lastCustomerAt,
    tag,
    fetchImpl,
    now,
  });
}
