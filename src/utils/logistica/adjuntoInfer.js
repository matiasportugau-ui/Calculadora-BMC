/**
 * Adjunto PDF → paneles/accesorios inference for Logística.
 * Proxy-first via POST /api/envios/adjunto-fetch, then browser fallback only when useful.
 *
 * @typedef {{ paneles: any[], accesorios: any[], warnings: string[], source: string, proxyAttempted?: boolean, browserAttempted?: boolean, ok?: boolean, userMessage?: string }} AdjuntoInferResult
 */

import {
  adjuntoUrlMissingHint,
  extractAdjuntoHttpsUrl,
  extractGoogleDriveFileId as extractDriveIdFromUrl,
  isAdjuntoAllowedHost,
} from "./adjuntoUrl.js";

/**
 * @param {string} url
 * @returns {string}
 */
export function extractGoogleDriveFileId(url) {
  return extractDriveIdFromUrl(url);
}

/**
 * @param {string} url
 * @returns {"drive"|"dropbox"|"other"|""}
 */
export function classifyAdjuntoHost(url) {
  try {
    const cleaned = extractAdjuntoHttpsUrl(url) || String(url || "").trim();
    const host = new URL(cleaned).hostname.toLowerCase();
    if (!host || !isAdjuntoAllowedHost(host)) {
      // Still classify non-allowed https as "other" for browser fallback attempts
      if (host) return "other";
      return "";
    }
    if (
      host === "drive.google.com" ||
      host === "docs.google.com" ||
      host.endsWith(".googleusercontent.com")
    ) {
      return "drive";
    }
    if (
      host === "www.dropbox.com" ||
      host === "dropbox.com" ||
      host === "dl.dropbox.com" ||
      host === "dl.dropboxusercontent.com" ||
      host.endsWith(".dropboxusercontent.com")
    ) {
      return "dropbox";
    }
    return "other";
  } catch {
    return "";
  }
}

/**
 * Browser CORS almost always fails for Drive view/download URLs.
 * Prefer proxy only; do not spam console with doomed browser fetch.
 * @param {string} url
 */
export function shouldSkipBrowserAdjuntoFetch(url) {
  return classifyAdjuntoHost(url) === "drive";
}

/**
 * @param {string} url
 * @returns {string}
 */
export function toFetchablePdfUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) return `https://drive.google.com/uc?export=download&id=${driveId}`;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host === "www.dropbox.com" || host === "dropbox.com" || host === "dl.dropbox.com") {
      u.searchParams.set("dl", "1");
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return raw;
}

/**
 * Map server/proxy error codes → short Spanish operator message.
 * @param {string} code
 * @param {{ status?: number, message?: string }} [extra]
 */
export function formatAdjuntoProxyError(code, extra = {}) {
  const c = String(code || "").trim();
  const status = extra.status;
  const msg = String(extra.message || "").trim();
  switch (c) {
    case "Unauthorized":
    case "unauthorized":
      return "Proxy adjunto: no autorizado (token API inválido o ausente en el frontend).";
    case "url_host_forbidden":
    case "url_https_required":
    case "url_credentials_forbidden":
    case "url_invalid":
      return "Proxy adjunto: URL no permitida (solo Drive/Dropbox https).";
    case "file_too_large":
      return "Proxy adjunto: archivo demasiado grande (máx ~12 MB).";
    case "too_many_redirects":
    case "redirect_missing_location":
      return "Proxy adjunto: demasiados redirects o redirect inválido.";
    case "drive_fetch_status":
      return `Proxy adjunto: origen respondió ${status || "error"} (revisar permisos del PDF).`;
    case "drive_fetch_failed":
      return `Proxy adjunto: no se pudo descargar${msg ? ` (${msg})` : ""}.`;
    case "API_AUTH_TOKEN not configured — envios API disabled":
      return "Proxy adjunto: API sin API_AUTH_TOKEN (503).";
    default:
      if (status === 401) return "Proxy adjunto: no autorizado (401).";
      if (status === 503) return "Proxy adjunto: API no disponible (503).";
      if (status) return `Proxy adjunto HTTP ${status}${msg ? `: ${msg}` : c ? ` (${c})` : ""}.`;
      if (c) return `Proxy adjunto: ${c}${msg ? ` — ${msg}` : ""}.`;
      if (msg) return `Proxy adjunto: ${msg}`;
      return "Proxy adjunto: error desconocido.";
  }
}

/**
 * Operator-facing one-liner for autoLoadMsg / badges.
 * @param {AdjuntoInferResult} result
 */
export function summarizeAdjuntoInfer(result) {
  if (!result) return "";
  if (result.ok && (result.paneles?.length || result.accesorios?.length)) {
    if (result.source === "adjunto_proxy") return "Adjunto leído vía proxy API.";
    if (result.source === "adjunto_browser") return "Adjunto leído por descarga directa (fallback).";
    return "Adjunto leído.";
  }
  if (result.userMessage) return result.userMessage;
  const w = (result.warnings || []).filter(Boolean);
  return w[0] || "No se pudo leer el adjunto.";
}

/**
 * Same resolution as geocode / ventas-csv / drafts (prod Vercel has VITE_API_AUTH_TOKEN).
 */
export function resolveEnviosAuthToken() {
  if (typeof import.meta === "undefined") return "";
  return String(
    import.meta.env?.VITE_BMC_API_AUTH_TOKEN || import.meta.env?.VITE_API_AUTH_TOKEN || "",
  ).trim();
}

/**
 * @param {string} base64
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * @param {ArrayBuffer} buffer
 * @param {string} url
 * @param {string} contentType
 * @param {(buf: ArrayBuffer, opts?: object) => Promise<{ text: string, warnings: string[] }>} extractTextFromPdfArrayBuffer
 * @param {(text: string) => { paneles: any[], accesorios: any[], warnings: string[] }} parseLogisticaFromAdjuntoText
 * @param {string[]} prefixWarnings
 * @param {string} source
 * @returns {Promise<AdjuntoInferResult>}
 */
async function parseBufferAsCargo(
  buffer,
  url,
  contentType,
  extractTextFromPdfArrayBuffer,
  parseLogisticaFromAdjuntoText,
  prefixWarnings,
  source,
) {
  const ctype = String(contentType || "").toLowerCase();
  const bytes = new Uint8Array(buffer);
  const isPdf =
    ctype.includes("pdf") || /\.pdf(\?|$)/i.test(url) || (bytes.length > 0 && bytes[0] === 0x25);

  if (isPdf) {
    const pdf = await extractTextFromPdfArrayBuffer(buffer, { maxPages: 20 });
    const parsed = parseLogisticaFromAdjuntoText(pdf.text || "");
    const paneles = parsed.paneles || [];
    const accesorios = parsed.accesorios || [];
    return {
      paneles,
      accesorios,
      warnings: [...prefixWarnings, ...pdf.warnings, ...(parsed.warnings || [])],
      source,
      ok: paneles.length > 0 || accesorios.length > 0,
      userMessage:
        paneles.length || accesorios.length
          ? source === "adjunto_proxy"
            ? "Adjunto leído vía proxy API."
            : "Adjunto leído por descarga directa."
          : "Adjunto descargado pero no se detectaron paneles/accesorios en el texto.",
    };
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const parsed = parseLogisticaFromAdjuntoText(text || "");
  const paneles = parsed.paneles || [];
  const accesorios = parsed.accesorios || [];
  return {
    paneles,
    accesorios,
    warnings: [...prefixWarnings, ...(parsed.warnings || [])],
    source,
    ok: paneles.length > 0 || accesorios.length > 0,
    userMessage:
      paneles.length || accesorios.length
        ? "Adjunto texto leído."
        : "Adjunto descargado pero sin líneas de panel/accesorio detectables.",
  };
}

/**
 * Proxy-first adjunto inference.
 *
 * @param {string} url
 * @param {{
 *   token?: string,
 *   apiBase?: string,
 *   extractTextFromPdfArrayBuffer: Function,
 *   parseLogisticaFromAdjuntoText: Function,
 *   fetchImpl?: typeof fetch,
 * }} deps
 * @returns {Promise<AdjuntoInferResult>}
 */
export async function inferPanelsAndAccessoriesFromPdf(url, deps) {
  const warnings = [];
  if (!url) {
    return {
      paneles: [],
      accesorios: [],
      warnings: ["Sin URL de adjunto."],
      source: "none",
      ok: false,
      userMessage: "Sin URL de adjunto.",
    };
  }

  // Normalize messy ENCARGO cells before any network call
  const normalizedUrl = extractAdjuntoHttpsUrl(url) || "";
  if (!normalizedUrl) {
    const hint = adjuntoUrlMissingHint(url);
    return {
      paneles: [],
      accesorios: [],
      warnings: [hint],
      source: "adjunto_failed",
      proxyAttempted: false,
      browserAttempted: false,
      ok: false,
      userMessage: hint,
    };
  }

  const {
    extractTextFromPdfArrayBuffer,
    parseLogisticaFromAdjuntoText,
    fetchImpl = typeof fetch !== "undefined" ? fetch.bind(globalThis) : null,
  } = deps || {};

  if (!extractTextFromPdfArrayBuffer || !parseLogisticaFromAdjuntoText || !fetchImpl) {
    return {
      paneles: [],
      accesorios: [],
      warnings: ["Inferencia de adjunto mal configurada (deps)."],
      source: "none",
      ok: false,
      userMessage: "Error interno al leer adjunto.",
    };
  }

  const token = String(deps.token || resolveEnviosAuthToken() || "").trim();
  let apiBase = deps.apiBase;
  if (apiBase == null) {
    try {
      const { getCalcApiBase } = await import("../calcApiBase.js");
      apiBase = typeof getCalcApiBase === "function" ? getCalcApiBase() : "";
    } catch {
      apiBase = "";
    }
  }
  apiBase = String(apiBase || "").replace(/\/+$/, "");

  let proxyAttempted = false;
  let browserAttempted = false;

  // 1) Proxy first whenever we have a token (required by requireCrmAuth)
  if (token) {
    proxyAttempted = true;
    const endpoint = `${apiBase}/api/envios/adjunto-fetch`;
    try {
      const proxyRes = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const j = await proxyRes.json().catch(() => ({}));
      if (proxyRes.ok && j.ok && j.base64) {
        const buffer = base64ToArrayBuffer(j.base64);
        const result = await parseBufferAsCargo(
          buffer,
          normalizedUrl,
          j.contentType || "",
          extractTextFromPdfArrayBuffer,
          parseLogisticaFromAdjuntoText,
          ["Adjunto vía proxy API."],
          "adjunto_proxy",
        );
        return { ...result, proxyAttempted, browserAttempted };
      }
      const errCode = j.error || (proxyRes.ok ? "proxy_empty" : "http_error");
      warnings.push(
        formatAdjuntoProxyError(errCode, {
          status: proxyRes.status,
          message: j.message,
        }),
      );
    } catch (e) {
      warnings.push(
        formatAdjuntoProxyError("drive_fetch_failed", {
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  } else {
    warnings.push(
      "Sin token API (VITE_API_AUTH_TOKEN / VITE_BMC_API_AUTH_TOKEN) — no se puede usar el proxy de adjuntos. Drive fallará por CORS; Dropbox puede funcionar en descarga directa.",
    );
  }

  // 2) Browser fallback — skip Drive (CORS); allow Dropbox/other public
  if (shouldSkipBrowserAdjuntoFetch(normalizedUrl)) {
    const userMessage =
      "No se pudo leer el PDF de Drive. Revisá permisos de enlace (cualquiera con el link) o configurá el proxy API (token). No se intenta descarga en el navegador (CORS).";
    warnings.push(userMessage);
    return {
      paneles: [],
      accesorios: [],
      warnings,
      source: "adjunto_failed",
      proxyAttempted,
      browserAttempted: false,
      ok: false,
      userMessage,
    };
  }

  browserAttempted = true;
  const fetchUrl = toFetchablePdfUrl(normalizedUrl);
  let res;
  try {
    res = await fetchImpl(fetchUrl, { mode: "cors", credentials: "omit" });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const userMessage = `Descarga directa del adjunto falló (${detail}). Si es Dropbox/Drive, usá enlace público o el proxy API.`;
    warnings.push(userMessage);
    return {
      paneles: [],
      accesorios: [],
      warnings,
      source: "adjunto_failed",
      proxyAttempted,
      browserAttempted,
      ok: false,
      userMessage,
    };
  }
  if (!res.ok) {
    const userMessage = `Adjunto no accesible por descarga directa (HTTP ${res.status}). Revisá permisos del PDF.`;
    warnings.push(userMessage);
    return {
      paneles: [],
      accesorios: [],
      warnings,
      source: "adjunto_failed",
      proxyAttempted,
      browserAttempted,
      ok: false,
      userMessage,
    };
  }

  const buffer = await res.arrayBuffer();
  const result = await parseBufferAsCargo(
    buffer,
    fetchUrl,
    res.headers.get("content-type") || "",
    extractTextFromPdfArrayBuffer,
    parseLogisticaFromAdjuntoText,
    [...warnings, "Adjunto vía descarga directa (fallback navegador)."],
    "adjunto_browser",
  );
  return { ...result, proxyAttempted, browserAttempted };
}

/**
 * Badge for stop list UI.
 * @param {{ adjuntoMeta?: object, pdfLink?: string, paneles?: any[] }} stop
 */
export function getAdjuntoBadge(stop) {
  if (!stop?.pdfLink) return { label: "Sin adjunto", tone: "warning" };
  const meta = stop.adjuntoMeta;
  if (!meta) {
    return stop.paneles?.length
      ? { label: "Adjunto (cargado)", tone: "success" }
      : { label: "Adjunto pendiente", tone: "warning" };
  }
  if (meta.source === "adjunto_proxy" && meta.ok) {
    return { label: "Adjunto OK · proxy", tone: "success" };
  }
  if (meta.source === "adjunto_browser" && meta.ok) {
    return { label: "Adjunto OK · browser", tone: "success" };
  }
  if (meta.source === "adjunto_failed" || meta.ok === false) {
    return { label: "Adjunto falló", tone: "danger" };
  }
  return { label: "Adjunto", tone: "neutral" };
}
