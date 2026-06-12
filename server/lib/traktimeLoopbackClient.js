/**
 * Shared HTTP loopback client for the in-process /api/traktime/* surface.
 *
 * Mirrors calcLoopbackClient.js, with one difference: TraKtiMe routes are
 * guarded by requireUser() (a user JWT), not the open /calc surface. So every
 * call forwards a user bearer token — the AI agent acts *as* the user whose
 * identity is present. Without a token the caller gets a clear auth error
 * rather than a silent 401: you cannot read a user's time without their
 * identity.
 *
 * Provenance: writes include `source: "ae_agent"` so a future audit can tell
 * agent-driven entries apart from manual ones (the routes ignore it today).
 */
import { config } from "../config.js";

function loopbackBase() {
  return `http://127.0.0.1:${config.port || 3001}`;
}

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  return `${b}${p.startsWith("/") ? p : "/" + p}`;
}

function authHeaders(authToken) {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text.slice(0, 200) };
  }
  return parsed;
}

function normalizeResult(res, parsed) {
  const httpOk = res.ok;
  const bodyOk = parsed?.ok !== false;
  return {
    ok: httpOk && bodyOk,
    status: res.status,
    body: parsed,
    error: parsed?.error || (httpOk ? null : `HTTP ${res.status}`),
  };
}

export async function tkGet(path, { query, authToken, signal, base } = {}) {
  let url = joinUrl(base || loopbackBase(), path);
  if (query && typeof query === "object") {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v != null) qp.set(k, String(v));
    }
    const qs = qp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const res = await fetch(url, { method: "GET", headers: authHeaders(authToken), signal });
  return normalizeResult(res, await parseJsonResponse(res));
}

export async function tkPost(path, body, { authToken, signal, base } = {}) {
  const url = joinUrl(base || loopbackBase(), path);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify(body || {}),
    signal,
  });
  return normalizeResult(res, await parseJsonResponse(res));
}

// ─── Named helpers (one per TraKtiMe endpoint the agent can drive) ──────────
export const getTimerCurrent = (opts) => tkGet("/api/traktime/timer/current", opts);
export const startTimer = (body, opts = {}) =>
  tkPost("/api/traktime/timer/start", { ...body, source: "ae_agent" }, opts);
export const stopTimer = (opts) => tkPost("/api/traktime/timer/stop", { source: "ae_agent" }, opts);
export const listEntries = (query, opts = {}) =>
  tkGet("/api/traktime/entries", { ...opts, query });
export const createEntry = (body, opts = {}) =>
  tkPost("/api/traktime/entries", { ...body, source: "ae_agent" }, opts);
export const getDayReport = (query, opts = {}) =>
  tkGet("/api/traktime/day-report", { ...opts, query });
export const getMonthReport = (query, opts = {}) =>
  tkGet("/api/traktime/month-report", { ...opts, query });
export const getBillableReport = (query, opts = {}) =>
  tkGet("/api/traktime/reports/billable", { ...opts, query });

export const _internal = { loopbackBase, joinUrl };
