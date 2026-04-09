/**
 * Envío saliente Messenger / Instagram (Graph API).
 */

/**
 * @param {{ accessToken: string, psid: string, text: string, graphVersion?: string }} opts
 */
export async function sendMessengerText({ accessToken, psid, text, graphVersion = "v21.0" }) {
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;
  const body = {
    recipient: { id: String(psid) },
    messaging_type: "RESPONSE",
    message: { text: String(text || "").slice(0, 2000) },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Messenger send ${res.status}`);
  }
  return data;
}

/**
 * @param {{ accessToken: string, instagramAccountId: string, igsid: string, text: string, graphVersion?: string }} opts
 */
export async function sendInstagramText({
  accessToken,
  instagramAccountId,
  igsid,
  text,
  graphVersion = "v21.0",
}) {
  const url = `https://graph.facebook.com/${graphVersion}/${instagramAccountId}/messages`;
  const body = {
    recipient: { id: String(igsid) },
    message: { text: String(text || "").slice(0, 1000) },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Instagram send ${res.status}`);
  }
  return data;
}
