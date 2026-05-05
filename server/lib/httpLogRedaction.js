const REDACTED = "[REDACTED]";

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "code",
  "key",
  "refresh_token",
  "token",
  "x-api-key",
]);

export function redactSensitiveUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return rawUrl;

  return rawUrl.replace(/([?&])([^=&#]+)=([^&#]*)/g, (match, sep, key) => {
    if (!SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) return match;
    return `${sep}${key}=${REDACTED}`;
  });
}
