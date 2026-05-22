/**
 * parsePdfGolden.js — Extrae goldens (total + líneas BOM) de un PDF de
 * cotización enviado desde la planilla Enviados.
 *
 * Estrategia:
 *   1. Resolver URL → URL descargable (Drive shared → uc?export=download)
 *   2. Descargar bytes (fetch)
 *   3. pdf-parse → texto plano
 *   4. Regex sobre el texto para:
 *        - total sin/con IVA
 *        - líneas de panel (qty + familia + espesor + dim)
 *
 * Devuelve siempre un objeto con `status` y campos null cuando no extraíble.
 * Falla a "no_text"/"download_error" en vez de crashear — la ingesta puede
 * continuar y completarse a mano.
 *
 * pdf-parse es opcional: si no está instalado, devuelve status: "dep_missing"
 * con un mensaje claro.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DRIVE_FILE_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_RE = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
const DRIVE_UC_RE = /drive\.google\.com\/uc\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+)/;

export function resolvePdfUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  for (const re of [DRIVE_FILE_RE, DRIVE_OPEN_RE, DRIVE_UC_RE]) {
    const m = trimmed.match(re);
    if (m) {
      return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    }
  }
  if (/\.pdf(\?|$)/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

async function downloadToTmp(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `evals-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);
  fs.writeFileSync(tmp, buf);
  return { tmp, bytes: buf.length };
}

let pdfParseModule = null;
async function loadPdfParse() {
  if (pdfParseModule) return pdfParseModule;
  try {
    const mod = await import("pdf-parse");
    pdfParseModule = mod.default || mod;
    return pdfParseModule;
  } catch {
    return null;
  }
}

const NUM_RE = "(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

const TOTAL_SIN_IVA_PATTERNS = [
  new RegExp(`total\\s*sin\\s*iva[^\\d]*${NUM_RE}`, "i"),
  new RegExp(`subtotal\\s*sin\\s*iva[^\\d]*${NUM_RE}`, "i"),
  new RegExp(`neto\\s*sin\\s*iva[^\\d]*${NUM_RE}`, "i"),
];
const TOTAL_CON_IVA_PATTERNS = [
  new RegExp(`total\\s*con\\s*iva[^\\d]*${NUM_RE}`, "i"),
  new RegExp(`total\\s*final[^\\d]*${NUM_RE}`, "i"),
  new RegExp(`total\\s*usd[^\\d]*${NUM_RE}`, "i"),
];

function parseAmount(raw) {
  if (!raw) return null;
  // "1.234,56" → 1234.56 ; "1,234.56" → 1234.56 ; "1234.56" → 1234.56
  const s = String(raw).trim();
  if (/^\d+([.,]\d{3})+[.,]\d{1,2}$/.test(s)) {
    return Number(s.replace(/[.,](?=.*[.,])/g, "").replace(",", "."));
  }
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d+$/.test(s)) return Number(s);
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function extractTotals(text) {
  const out = { total_sin_iva_usd: null, total_con_iva_usd: null };
  for (const re of TOTAL_SIN_IVA_PATTERNS) {
    const m = text.match(re);
    if (m) {
      out.total_sin_iva_usd = parseAmount(m[1]);
      break;
    }
  }
  for (const re of TOTAL_CON_IVA_PATTERNS) {
    const m = text.match(re);
    if (m) {
      out.total_con_iva_usd = parseAmount(m[1]);
      break;
    }
  }
  return out;
}

const PANEL_LINE_RE =
  /(\d+)\s*(?:un|u\.|x)?\s*(?:panel(?:es)?\s+)?(isodec|isoroof|isopanel|isowall|isofrig)[^0-9\n]*?(\d{2,3})\s*mm[^\n]*?(\d+[.,]\d+)?\s*(?:x|por)?\s*(\d+[.,]\d+)?/gi;

function extractBomLines(text) {
  const lines = [];
  const matches = text.matchAll(PANEL_LINE_RE);
  for (const m of matches) {
    lines.push({
      raw: m[0].trim().replace(/\s+/g, " "),
      qty: m[1] ? Number(m[1]) : null,
      familia: m[2]?.toUpperCase() || null,
      espesor: m[3] ? Number(m[3]) : null,
      largo: m[4] ? Number(m[4].replace(",", ".")) : null,
      ancho: m[5] ? Number(m[5].replace(",", ".")) : null,
    });
    if (lines.length >= 50) break;
  }
  return lines;
}

/**
 * @param {string} pdfUrl URL del PDF (Drive shared o directo).
 * @returns {Promise<{status, source_url, resolved_url, total_sin_iva_usd, total_con_iva_usd, bom_lines, raw_text_sample, error?}>}
 */
export async function parsePdfGolden(pdfUrl) {
  const result = {
    status: "unknown",
    source_url: pdfUrl,
    resolved_url: null,
    total_sin_iva_usd: null,
    total_con_iva_usd: null,
    bom_lines: [],
    raw_text_sample: null,
  };
  const resolved = resolvePdfUrl(pdfUrl);
  if (!resolved) {
    result.status = "invalid_url";
    return result;
  }
  result.resolved_url = resolved;

  const pdfParse = await loadPdfParse();
  if (!pdfParse) {
    result.status = "dep_missing";
    result.error = "pdf-parse no instalado. Ejecutar: npm install pdf-parse";
    return result;
  }

  let tmpFile = null;
  try {
    const { tmp } = await downloadToTmp(resolved);
    tmpFile = tmp;
    const dataBuffer = fs.readFileSync(tmp);
    const parsed = await pdfParse(dataBuffer);
    const text = (parsed?.text || "").replace(/ /g, " ");
    if (!text || text.length < 50) {
      result.status = "no_text";
      result.error = "PDF descargado pero sin texto extraíble (¿escaneo? ¿imagen?)";
      return result;
    }
    result.raw_text_sample = text.slice(0, 800);
    const totals = extractTotals(text);
    result.total_sin_iva_usd = totals.total_sin_iva_usd;
    result.total_con_iva_usd = totals.total_con_iva_usd;
    result.bom_lines = extractBomLines(text);
    if (!result.total_sin_iva_usd && !result.total_con_iva_usd) {
      result.status = "no_total";
    } else {
      result.status = "parsed";
    }
    return result;
  } catch (err) {
    result.status = "download_error";
    result.error = err?.message || String(err);
    return result;
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    }
  }
}
