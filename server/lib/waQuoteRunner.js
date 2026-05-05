/**
 * WA Cockpit — orquestador de cotización desde un chat.
 * Llama a /calc/cotizar internamente (loopback HTTP), persiste en wa_quotes,
 * arma el link público (PUBLIC_BASE_URL/calc/cotizar… NO sirve para cliente final;
 * usamos /finanzas o /calculadora con query) y opcionalmente sincroniza col AH del Sheet.
 *
 * No depende de Postgres directamente; recibe el pool por parámetro.
 */
import { config } from "../config.js";
import { extractQuoteParams, paramsToCalcBody } from "./waQuoteParams.js";

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "");
  return `${b}${p.startsWith("/") ? p : "/" + p}`;
}

/** Llama POST /calc/cotizar en este mismo backend (loopback). */
async function callLocalCotizar(body, { signal } = {}) {
  // En Cloud Run usamos publicBaseUrl; en dev local apuntamos a localhost:port.
  const base =
    config.appEnv === "development"
      ? `http://localhost:${config.port || 3001}`
      : (config.publicBaseUrl || `http://localhost:${config.port || 3001}`).replace(/\/$/, "");
  const url = joinUrl(base, "/calc/cotizar");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/**
 * Construye un link "compartible" hacia el preview/PDF.
 * Por ahora devolvemos un link a /calculadora con query mínima — F4 puede subir PDF a GCS y reemplazar.
 */
function buildShareLink({ params }) {
  const base = (config.publicBaseUrl || "").replace(/\/$/, "");
  if (!base) return null;
  const qp = new URLSearchParams();
  if (params?.metros != null) qp.set("m2", String(params.metros));
  if (params?.espesor != null) qp.set("esp", String(params.espesor));
  if (params?.familia) qp.set("fam", params.familia);
  if (params?.scope) qp.set("scope", params.scope);
  if (params?.color) qp.set("color", params.color);
  return `${base}/calculadora?${qp.toString()}`;
}

/**
 * Punto de entrada — usado por el enricher (auto) y por el endpoint manual del cockpit.
 *
 * @param {object} opts
 * @param {import("pg").Pool} opts.pool
 * @param {string} opts.chatId
 * @param {string} opts.text   — texto a parsear (último mensaje del cliente)
 * @param {string|null} [opts.triggerMsgId]
 * @param {boolean} [opts.generatedByAi=true]
 * @param {string} [opts.forceParams] — JSON string con params overridden (modo manual)
 * @returns {Promise<{ok: boolean, quote?: object, reason?: string}>}
 */
export async function runWaQuote({ pool, chatId, text, triggerMsgId, generatedByAi = true, forceParams = null }) {
  if (!pool) return { ok: false, reason: "no_pool" };
  if (!chatId) return { ok: false, reason: "no_chat_id" };

  let params = null;
  if (forceParams) {
    try {
      const obj = typeof forceParams === "string" ? JSON.parse(forceParams) : forceParams;
      params = { ...obj, ready: true, confidence: 1 };
    } catch {
      return { ok: false, reason: "bad_force_params" };
    }
  } else {
    params = extractQuoteParams(text || "");
    if (!params || !params.ready) {
      return { ok: false, reason: "params_not_ready", params };
    }
  }

  const body = paramsToCalcBody(params);
  if (!body) return { ok: false, reason: "params_to_body_failed", params };

  let calcResult;
  try {
    calcResult = await callLocalCotizar(body);
  } catch (e) {
    return { ok: false, reason: "calc_call_failed", error: e instanceof Error ? e.message : String(e) };
  }
  if (!calcResult.ok || calcResult.body?.ok === false) {
    return {
      ok: false,
      reason: "calc_returned_error",
      status: calcResult.status,
      detail: calcResult.body?.error || null,
    };
  }

  const totalUsd =
    calcResult.body?.total_sin_iva_usd ??
    calcResult.body?.totals?.total_sin_iva ??
    null;
  const totalIvaUsd =
    calcResult.body?.total_con_iva_usd ?? calcResult.body?.totals?.total_con_iva ?? null;
  const bomSummary = Array.isArray(calcResult.body?.bom)
    ? calcResult.body.bom.map((g) => ({ grupo: g.grupo, items: g.items?.length ?? 0 }))
    : null;

  const link = buildShareLink({ params });

  const ins = await pool.query(
    `insert into wa_quotes
       (chat_id, trigger_msg_id, generated_by_ai, params, total_usd, total_iva_usd, bom_summary, link, status, meta)
     values ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, 'draft', $9::jsonb)
     returning quote_id, chat_id, link, total_usd, total_iva_usd, generated_at, status`,
    [
      chatId,
      triggerMsgId || null,
      Boolean(generatedByAi),
      JSON.stringify(params),
      totalUsd,
      totalIvaUsd,
      JSON.stringify(bomSummary),
      link,
      JSON.stringify({ calc_response_keys: Object.keys(calcResult.body || {}).slice(0, 20) }),
    ],
  );

  return { ok: true, quote: ins.rows[0] };
}
