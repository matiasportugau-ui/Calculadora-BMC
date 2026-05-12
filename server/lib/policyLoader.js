/**
 * Loads the unified commercial policy (IVA, listas, disclaimers, tono) from
 * docs/team/policies/comercial-chat-ml-shopify.json once per process.
 *
 * Falls back to inline DEFAULTS if the file is missing or malformed so the
 * server never crashes on policy issues — the rule is "policy is additive,
 * never load-bearing for boot". Tests assert both paths.
 *
 * Consumers: server/lib/chatPrompts.js (PR siguiente), scripts ML/Shopify.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const POLICY_PATH = path.join(repoRoot, "docs", "team", "policies", "comercial-chat-ml-shopify.json");

const DEFAULTS = Object.freeze({
  version: "default",
  currency: "USD",
  iva: { pct: 22, exhibicion: "siempre IVA discriminado", redondeo_dec: 2 },
  listas: { publicar_nombre_publico: false, internas: ["web", "venta"], default: "web" },
  disclaimers: {
    validez_horas: 48,
    flete_incluido_default: false,
    flete_nota: "El flete no está incluido salvo aclaración explícita.",
    stock_nota: "Sujeto a disponibilidad al momento de la confirmación.",
  },
  tono: {
    panelin: { estilo: "consultivo, español rioplatense", max_chars: null },
    ml: { estilo: "directo", max_chars: 600 },
    shopify: { estilo: "informativo", max_chars: 800 },
  },
  checklist_pre_release: [],
});

let _cache = null;
let _loadedFrom = null;

function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function shapeIsValid(p) {
  if (!isPlainObject(p)) return false;
  if (!isPlainObject(p.iva) || !Number.isFinite(p.iva.pct)) return false;
  if (!isPlainObject(p.listas) || !Array.isArray(p.listas.internas)) return false;
  if (!isPlainObject(p.disclaimers) || !Number.isFinite(p.disclaimers.validez_horas)) return false;
  if (!isPlainObject(p.tono)) return false;
  return true;
}

/**
 * @param {{ force?: boolean, customPath?: string }} [opts]
 * @returns {{policy: object, source: "file"|"defaults", path: string|null}}
 */
export function loadCommercialPolicy(opts = {}) {
  if (_cache && !opts.force && !opts.customPath) {
    return { policy: _cache, source: _loadedFrom || "defaults", path: _loadedFrom === "file" ? POLICY_PATH : null };
  }
  const filePath = opts.customPath || POLICY_PATH;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!shapeIsValid(parsed)) {
      throw new Error("policy shape invalid");
    }
    _cache = parsed;
    _loadedFrom = "file";
    return { policy: parsed, source: "file", path: filePath };
  } catch {
    _cache = DEFAULTS;
    _loadedFrom = "defaults";
    return { policy: DEFAULTS, source: "defaults", path: null };
  }
}

/** Test-only: clear the in-memory cache so each test sees a fresh load. */
export function _resetPolicyCacheForTests() {
  _cache = null;
  _loadedFrom = null;
}

/** Convenience getters used by callers that don't need the full object. */
export function getIvaPct() {
  return loadCommercialPolicy().policy.iva.pct;
}
export function getValidezHoras() {
  return loadCommercialPolicy().policy.disclaimers.validez_horas;
}
export function getFleteNota() {
  return loadCommercialPolicy().policy.disclaimers.flete_nota;
}

export { DEFAULTS as POLICY_DEFAULTS };
