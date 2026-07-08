export function buildMlWriteHeaders(config, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = String(config?.apiAuthToken || "").trim();
  if (token) {
    headers["x-api-key"] = token;
  }
  return headers;
}
