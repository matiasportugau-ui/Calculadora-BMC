// ═══════════════════════════════════════════════════════════════════════════
// Central API client — single entry point for frontend → backend calls.
//
// Replaces the ~119 scattered `fetch()` call sites that each re-implemented
// (inconsistently) base-URL resolution, auth headers, JSON parsing, timeouts
// and error handling. Built on top of getCalcApiBase() so URL resolution stays
// identical to the existing convention.
//
// Encodes the project's error contract for Sheets-backed routes (see CLAUDE.md):
//   - 503            → Sheets/source unavailable  → ApiError.isServiceUnavailable
//   - 200 + empty    → no data (not an error)     → result.empty === true
//   - never 500 for Sheets failures (the UI relies on this)
// ═══════════════════════════════════════════════════════════════════════════

import { getCalcApiBase } from "./calcApiBase.js";

const DEFAULT_TIMEOUT_MS = 20_000;
/** Same key as CRM cockpit / wolfboard modules (`useAdminCotizaciones`). */
export const COCKPIT_TOKEN_KEY = "bmc_cockpit_token";

let memoryKey = "";
let cockpitTokenFetch = null;

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
 * Ensures `x-api-key` / Bearer is available for authenticated API routes.
 * Falls back to GET /api/crm/cockpit-token (browser Origin allowlist) when env/storage are empty.
 */
export async function ensureApiKey() {
  const existing = apiKeySync();
  if (existing) return existing;
  if (typeof fetch === "undefined") return "";

  if (!cockpitTokenFetch) {
    cockpitTokenFetch = fetch(apiUrl("/api/crm/cockpit-token"), { credentials: "omit" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        const t = r.ok && d?.ok ? String(d?.token || "").trim() : "";
        if (t) {
          memoryKey = t;
          try {
            localStorage.setItem(COCKPIT_TOKEN_KEY, t);
          } catch {
            /* ignore quota / private mode */
          }
        }
        return t;
      })
      .catch(() => "")
      .finally(() => {
        cockpitTokenFetch = null;
      });
  }
  return cockpitTokenFetch;
}

async function resolveRequestApiKey({ allowRuntimeFetch = false } = {}) {
  const existing = apiKeySync();
  if (existing) return existing;
  return allowRuntimeFetch ? ensureApiKey() : "";
}

/** Resolve a path against the canonical API base. Absolute URLs pass through. */
export function apiUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getCalcApiBase();
  const p = String(path).startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Treats null / "" / [] / {} as "no data" per the 200-empty contract. */
export function isEmptyPayload(data) {
  if (data == null) return true;
  if (typeof data === "string") return data.trim() === "";
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data).length === 0;
  return false;
}

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, kind = "http", cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.kind = kind; // "http" | "network" | "timeout"
    if (cause) this.cause = cause;
  }

  /** 503 = upstream source (Sheets/CRM) unavailable; callers should degrade, not crash. */
  get isServiceUnavailable() {
    return this.status === 503;
  }

  get isTimeout() {
    return this.kind === "timeout";
  }

  get isNetwork() {
    return this.kind === "network";
  }
}

async function buildHeaders(extra, hasBody, { allowRuntimeAuthFetch = false } = {}) {
  const h = { ...(extra || {}) };
  if (hasBody && !h["Content-Type"] && !h["content-type"]) {
    h["Content-Type"] = "application/json";
  }
  const key = await resolveRequestApiKey({ allowRuntimeFetch: allowRuntimeAuthFetch });
  if (key && !h["x-api-key"]) h["x-api-key"] = key;
  if (key && !h.Authorization && !h.authorization) h.Authorization = `Bearer ${key}`;
  return h;
}

/**
 * Low-level request returning the raw Response, with timeout + base-URL
 * resolution + auth headers applied. Prefer apiGet/apiPost for JSON.
 * Set `requireApiKey: true` only for routes that need the shared API token;
 * public routes must not trigger the runtime cockpit-token fallback.
 */
export async function apiFetch(path, opts = {}) {
  const {
    method = "GET",
    body,
    headers,
    credentials,
    requireApiKey = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = opts;

  const hasBody = body != null;
  const isJsonBody = hasBody && typeof body !== "string" && !(body instanceof FormData);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Honor a caller-provided signal alongside our timeout.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(apiUrl(path), {
      method,
      headers: await buildHeaders(headers, hasBody, {
        allowRuntimeAuthFetch: Boolean(requireApiKey),
      }),
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

/**
 * JSON request. Resolves to `{ data, status, empty }` on success.
 * Throws ApiError on non-2xx (503 carries isServiceUnavailable).
 */
export async function apiRequest(path, opts = {}) {
  const res = await apiFetch(path, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new ApiError(message, { status: res.status, data });
  }

  return { data, status: res.status, empty: isEmptyPayload(data) };
}

export function apiGet(path, opts = {}) {
  return apiRequest(path, { ...opts, method: "GET" });
}

export function apiPost(path, body, opts = {}) {
  return apiRequest(path, { ...opts, method: "POST", body });
}
