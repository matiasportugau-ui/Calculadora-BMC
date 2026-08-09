/**
 * Shared HTTP loopback client for the in-process /calc/* surface.
 *
 * Every internal caller (AE-agent tools, WA cockpit, panelin internal tools)
 * goes through one host construction rule — `127.0.0.1:${config.port}` — so
 * the calc routes stay the single source of truth for math, advisory text,
 * warnings and BOM shape. Using loopback (not publicBaseUrl) avoids a self-
 * directed DNS round-trip in Cloud Run and keeps dev/prod parity.
 *
 * `postCotizarPdf` falls back to publicBaseUrl once on a transport-level
 * failure so the PDF path keeps working in any rare topology where the
 * loopback bind hasn't completed yet (e.g. a fast first request during boot).
 */
import { config } from "../config.js";

function loopbackBase() {
  return `http://127.0.0.1:${config.port || 3001}`;
}

function publicFallbackBase() {
  return (config.publicBaseUrl || loopbackBase()).replace(/\/$/, "");
}

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  return `${b}${p.startsWith("/") ? p : "/" + p}`;
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

async function postJson(path, body, { signal, base } = {}) {
  const url = joinUrl(base || loopbackBase(), path);
  const headers = { "Content-Type": "application/json" };
  if (!base && config.apiAuthToken) {
    headers.Authorization = `Bearer ${config.apiAuthToken}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
    signal,
  });
  const parsed = await parseJsonResponse(res);
  return normalizeResult(res, parsed);
}

async function getJson(path, { query, signal, base } = {}) {
  let url = joinUrl(base || loopbackBase(), path);
  if (query && typeof query === "object") {
    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v != null) qp.set(k, String(v));
    }
    const qs = qp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const res = await fetch(url, { method: "GET", signal });
  const parsed = await parseJsonResponse(res);
  return normalizeResult(res, parsed);
}

export async function postCotizar(body, opts = {}) {
  return postJson("/calc/cotizar", body, opts);
}

export async function postPresupuestoLibre(body, opts = {}) {
  return postJson("/calc/cotizar/presupuesto-libre", body, opts);
}

/**
 * PDF generation. On transport error (loopback unreachable), falls back once
 * to publicBaseUrl. HTTP-level errors (4xx/5xx) are NOT retried — they came
 * from the calc handler and would be deterministic.
 */
export async function postCotizarPdf(body, opts = {}) {
  try {
    return await postJson("/calc/cotizar/pdf", body, opts);
  } catch (err) {
    const fallback = publicFallbackBase();
    if (!fallback || fallback === loopbackBase()) throw err;
    console.warn(
      JSON.stringify({
        event: "ae_agent_quote_pdf_fallback",
        reason: err?.message || String(err),
      }),
    );
    return postJson("/calc/cotizar/pdf", body, { ...opts, base: fallback });
  }
}

export async function getCalcEndpoint(path, opts = {}) {
  return getJson(path, opts);
}

export const _internal = { loopbackBase, publicFallbackBase, joinUrl };
