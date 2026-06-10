// ═══════════════════════════════════════════════════════════════════════════
// Operator API client — explicit auth for hub / cockpit routes only.
//
// Phase B (S5): prefer identity JWT from BmcAuthProvider (setOperatorJwtGetter).
// Fallback: Vite env aliases or bmc_cockpit_token override in localStorage (dev/CI).
// GET /api/crm/cockpit-token is deprecated — do not fetch from hub UI.
// ═══════════════════════════════════════════════════════════════════════════

import {
  apiUrl,
  ApiError,
  isEmptyPayload,
} from "./apiClient.js";

/** Same key as CRM cockpit / wolfboard modules (`useAdminCotizaciones`). */
export const COCKPIT_TOKEN_KEY = "bmc_cockpit_token";

const DEFAULT_TIMEOUT_MS = 20_000;

let memoryKey = "";
let jwtGetter = () => "";

/** Register identity JWT supplier (called from BmcAuthProvider). */
export function setOperatorJwtGetter(fn) {
  jwtGetter = typeof fn === "function" ? fn : () => "";
}

/** Pure: Vite env aliases for the server `API_AUTH_TOKEN`. */
export function resolveApiKeyFromEnv(env = {}) {
  return String(env.VITE_API_AUTH_TOKEN || env.VITE_BMC_API_AUTH_TOKEN || "").trim();
}

/** Pure: read persisted cockpit token (browser localStorage in production). */
export function resolveApiKeyFromStorage(readItem = () => "") {
  try {
    return String(readItem(COCKPIT_TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
}

function apiKeySync() {
  const jwt = String(jwtGetter() || "").trim();
  if (jwt) return jwt;
  if (memoryKey) return memoryKey;
  const fromEnv =
    typeof import.meta !== "undefined" ? resolveApiKeyFromEnv(import.meta.env || {}) : "";
  if (fromEnv) return fromEnv;
  if (typeof localStorage !== "undefined") {
    return resolveApiKeyFromStorage((k) => localStorage.getItem(k));
  }
  return "";
}

/**
 * @deprecated cockpit-token endpoint removed in Phase B PR3. Returns "".
 */
export async function fetchCockpitTokenOperatorCredential() {
  return "";
}

/** @param {{ fetchCockpitToken?: boolean }} [opts] */
export async function ensureOperatorToken(_opts = {}) {
  return apiKeySync();
}

async function buildOperatorHeaders(extra, hasBody, opts) {
  const h = { ...(extra || {}) };
  if (hasBody && !h["Content-Type"] && !h["content-type"]) {
    h["Content-Type"] = "application/json";
  }
  const key = await ensureOperatorToken(opts);
  if (key && !h["x-api-key"]) h["x-api-key"] = key;
  if (key && !h.Authorization && !h.authorization) h.Authorization = `Bearer ${key}`;
  return h;
}

/**
 * Authenticated fetch — use only for operator/cockpit routes.
 */
export async function operatorFetch(path, opts = {}) {
  const {
    method = "GET",
    body,
    headers,
    credentials,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    fetchCockpitToken = false,
  } = opts;

  const hasBody = body != null;
  const isJsonBody = hasBody && typeof body !== "string" && !(body instanceof FormData);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(apiUrl(path), {
      method,
      headers: await buildOperatorHeaders(headers, hasBody, { fetchCockpitToken }),
      body: isJsonBody ? JSON.stringify(body) : body,
      credentials,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new ApiError(`Tiempo de espera agotado (${timeoutMs}ms)`, {
        kind: "timeout",
        cause: err,
      });
    }
    throw new ApiError(err?.message || "Error de red", { kind: "network", cause: err });
  } finally {
    clearTimeout(timer);
  }
}

export async function operatorRequest(path, opts = {}) {
  const res = await operatorFetch(path, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new ApiError(message, { status: res.status, data });
  }

  return { data, status: res.status, empty: isEmptyPayload(data) };
}

export function operatorGet(path, opts = {}) {
  return operatorRequest(path, { ...opts, method: "GET" });
}

export function operatorPost(path, body, opts = {}) {
  return operatorRequest(path, { ...opts, method: "POST", body });
}