/**
 * Descarga media de WhatsApp Cloud API (Graph).
 * @param {{ mediaId: string, accessToken: string, graphVersion?: string }} opts
 */
export async function downloadWhatsAppMedia({ mediaId, accessToken, graphVersion = "v21.0" }) {
  const metaUrl = `https://graph.facebook.com/${graphVersion}/${mediaId}`;
  const head = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const headJson = await head.json().catch(() => ({}));
  if (!head.ok) {
    throw new Error(headJson?.error?.message || `media head ${head.status}`);
  }
  const url = headJson.url;
  const mime = headJson.mime_type || "application/octet-stream";
  if (!url) throw new Error("missing media url");

  const bin = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!bin.ok) {
    const t = await bin.text();
    throw new Error(`media download ${bin.status}: ${t.slice(0, 200)}`);
  }
  const buf = Buffer.from(await bin.arrayBuffer());
  return { buffer: buf, mimeType: mime };
}
