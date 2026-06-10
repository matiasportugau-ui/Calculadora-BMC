// ═══════════════════════════════════════════════════════════════════════════
// Public API client — anonymous / calculator reads (no auth headers).
//
// Operator/cockpit routes: use `operatorApiClient.js` (explicit opt-in).
//
// Encodes the project's error contract for Sheets-backed routes (see CLAUDE.md):
//   - 503            → Sheets/source unavailable  → ApiError.isServiceUnavailable
//   - 200 + empty    → no data (not an error)     → result.empty === true
//   - never 500 for Sheets failures (the UI relies on this)
// ═══════════════════════════════════════════════════════════════════════════

import { getCalcApiBase } from "./calcApiBase.js";

const DEFAULT_TIMEOUT_MS = 20_000;

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

function buildHeaders(extra, hasBody) {
  const h = { ...(extra || {}) };
  if (hasBody && !h["Content-Type"] && !h["content-type"]) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

/**
 * Low-level public request (no auth). Prefer apiGet/apiPost for JSON.
 */
export async function apiFetch(path, opts = {}) {
  const {
    method = "GET",
    body,
    headers,
    credentials,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
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
      headers: buildHeaders(headers, hasBody),
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