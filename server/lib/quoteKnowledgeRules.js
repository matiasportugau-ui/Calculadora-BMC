/**
 * quoteKnowledgeRules.js — Conocimiento rules wired into code (BQ/HITL pack 2026-10-11).
 *
 * Source of truth for the rule text:
 *   docs/team/knowledge/CONOCIMIENTO-COMPARATIVE-2026-10-11.md
 *   BQ: chatbot-bmc-live.bmc_quote_knowledge.fact_quote_io (n≈2054, ~36% sample)
 *
 * Wired rules (see the comparative doc §D selection matrix):
 *   #4  familia — IsoPanel (techo) → preferir IsoDec ................. suggestFamiliaForUso
 *   #5  familia — IsoDec (pared) → evaluar IsoPanel .................. suggestFamiliaForUso
 *   #7  pricing — banda de sanidad USD/m² ............................ sanityCheckUsdPerM2
 *   #1* comercial — ML/CL pedir familia+espesor antes de cotizar ..... needsClarifyForIncompleteLead
 *   (guard) scenario router — intención del texto vs escenario ....... inferQuoteIntentFromUserText
 *                                                                      buildQuoteIntentConflict
 *
 * The module is pure (no I/O, no config) so it is safe to call from
 * validators, interpreters and the WA/agent paths, and unit-testable offline.
 *
 * NOTE: bands are calibrated on the ~36% Dropbox sample; re-harden them after
 * the full archive run (comparative doc §E.5) before treating them as hard.
 */

// ── Rule #7 — USD/m² sanity band ──────────────────────────────────────────

/**
 * Banda típica por familia (rule #7) + banda dura global.
 * `typical` = centro observado; la banda dura marca <40 o >100 para revisión.
 */
export const USD_M2 = Object.freeze({
  /** Mediana global observada (~USD 56/m², ticket mediano ~USD 2.4k). */
  median: 56,
  /** Banda dura: fuera de esto se marca para revisión humana antes de enviar. */
  hardMin: 40,
  hardMax: 100,
  /** Desvío relativo al `typical` de la familia que dispara un aviso suave. */
  softDeviation: 0.3,
});

/** Centro típico observado por familia (rule #7). Claves canónicas (upper). */
export const USD_M2_TYPICAL_BY_FAMILIA = Object.freeze({
  ISOPANEL: 46,
  ISOPANEL_EPS: 46,
  ISODEC: 62,
  ISODEC_EPS: 57,
  ISODEC_PIR: 62,
  ISOROOF: 60,
  ISOROOF_3G: 60,
  ISOROOF_FOIL: 60,
  ISOROOF_PLUS: 60,
  ISOROOF_COLONIAL: 62,
});

/** Normaliza un nombre de familia a clave canónica (upper, sin espacios). */
export function normalizeFamiliaKey(familia) {
  return String(familia || "").trim().toUpperCase().replace(/\s+/g, "_");
}

/**
 * Sanity-check USD/m² for a generated quote (rule #7).
 *
 * @param {{ totalUsd: number, areaM2: number, familia?: string }} args
 * @returns {{
 *   ok: boolean, usdPerM2: number|null, familia: string|null,
 *   typical: number|null, hardMin: number, hardMax: number, flags: string[],
 * }}
 */
export function sanityCheckUsdPerM2({ totalUsd, areaM2, familia } = {}) {
  const total = Number(totalUsd);
  const area = Number(areaM2);
  const base = {
    ok: true,
    usdPerM2: null,
    familia: familia ? normalizeFamiliaKey(familia) : null,
    typical: null,
    hardMin: USD_M2.hardMin,
    hardMax: USD_M2.hardMax,
    flags: [],
  };

  if (!Number.isFinite(total) || !Number.isFinite(area) || total <= 0 || area <= 0) {
    return { ...base, ok: false, flags: ["USD/m² no verificable: total o área inválidos."] };
  }

  const usdPerM2 = Math.round((total / area) * 100) / 100;
  const key = familia ? normalizeFamiliaKey(familia) : null;
  const typical = key && USD_M2_TYPICAL_BY_FAMILIA[key] != null ? USD_M2_TYPICAL_BY_FAMILIA[key] : null;
  const flags = [];

  if (usdPerM2 < USD_M2.hardMin) {
    flags.push(
      `USD/m² ${usdPerM2} por debajo de la banda (${USD_M2.hardMin}–${USD_M2.hardMax}) — revisar antes de enviar.`,
    );
  } else if (usdPerM2 > USD_M2.hardMax) {
    flags.push(
      `USD/m² ${usdPerM2} por encima de la banda (${USD_M2.hardMin}–${USD_M2.hardMax}) — revisar antes de enviar.`,
    );
  } else if (typical && Math.abs(usdPerM2 - typical) / typical > USD_M2.softDeviation) {
    flags.push(
      `USD/m² ${usdPerM2} se aleja del típico ${key} (~${typical}) — verificar familia/espesor.`,
    );
  }

  return { ...base, ok: flags.length === 0, usdPerM2, typical, flags };
}

// ── Rules #4 / #5 — familia por uso (techo / pared) ──────────────────────

const TECHO_PREFIX = /^(ISODEC|ISOROOF|ISOFRIG)/;
const PARED_PREFIX = /^(ISOPANEL|ISOWALL)/;

/**
 * Sugerencia de familia según el uso detectado (rules #4 y #5).
 *
 * - #4: isopanel / "panel sandwich" para TECHO → preferir IsoDec (IsoRoof si el
 *   cliente pide 3G/FOIL/PLUS/Colonial).
 * - #5: isodec para PARED/muro/fachada → evaluar IsoPanel.
 *
 * No muta: devuelve la familia sugerida y el motivo para que el operador
 * confirme (los humanos reescriben familia con frecuencia; ver doc §B).
 *
 * @param {{ familia?: string, scope?: "techo"|"pared"|string }} args
 * @returns {{ familia: string|null, sugerida: string|null, changed: boolean, motivo: string|null }}
 */
export function suggestFamiliaForUso({ familia, scope } = {}) {
  const key = familia ? normalizeFamiliaKey(familia) : null;
  const uso = String(scope || "").toLowerCase();
  const out = { familia: key, sugerida: key, changed: false, motivo: null };
  if (!key) return out;

  if (uso === "techo" && PARED_PREFIX.test(key)) {
    const sugerida = key.startsWith("ISOWALL") ? "ISODEC_PIR" : "ISODEC_EPS";
    return {
      ...out,
      sugerida,
      changed: true,
      motivo: "Regla #4: pared→techo; observado rewrite IsoPanel→IsoDec (usar IsoRoof si pide 3G/FOIL/PLUS/Colonial).",
    };
  }

  if (uso === "pared" && TECHO_PREFIX.test(key)) {
    const sugerida = key.includes("PIR") ? "ISOWALL_PIR" : "ISOPANEL_EPS";
    return {
      ...out,
      sugerida,
      changed: true,
      motivo: "Regla #5: techo→pared; observado rewrite IsoDec→IsoPanel (confirmar con el cliente si hay duda).",
    };
  }

  return out;
}

// ── Draft #1 — ML/CL: pedir familia + espesor antes de cotizar ───────────

const ML_CL_ORIGINS = new Set(["ml", "cl", "mercadolibre", "mercado_libre"]);

/**
 * Gate advisory (draft #1): para leads ML/CL, pedir familia+espesor antes de
 * cotizar. ML/CL llegan menos completos que WA y el histórico los penaliza
 * (mediana ML ~USD 1.9k vs WA ~2.9k). NO bloquea: devuelve qué falta para que
 * el caller decida pedir aclaración.
 *
 * @param {{ origen?: string, familia?: string, espesor?: string|number }} args
 * @returns {{ clarify: boolean, missing: string[], message: string|null }}
 */
export function needsClarifyForIncompleteLead({ origen, familia, espesor } = {}) {
  const o = String(origen || "").trim().toLowerCase();
  if (!ML_CL_ORIGINS.has(o)) return { clarify: false, missing: [], message: null };

  const missing = [];
  if (!familia || !String(familia).trim()) missing.push("familia");
  if (espesor == null || String(espesor).trim() === "") missing.push("espesor");
  if (missing.length === 0) return { clarify: false, missing: [], message: null };

  return {
    clarify: true,
    missing,
    message: `Lead ${o.toUpperCase()}: falta ${missing.join(" y ")} — pedir antes de cotizar (draft #1).`,
  };
}

// ── Scenario router guard — intención del texto vs escenario ─────────────

const ACCESSORY_TERMS = [
  "ángulo", "angulo", "perfil", "gotero", "canal", "cumbrera", "babeta",
  "tornillo", "sellador", "fijaci", "zinguer", "accesorio", "metros de",
];

/**
 * Inferir la intención de cotización del texto del cliente.
 * @param {string} text
 * @returns {"presupuesto_libre"|"solo_techo"|"techo_fachada"|"solo_fachada"|"camara_frig"|null}
 */
export function inferQuoteIntentFromUserText(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return null;

  const hasPanel = /panel|isodec|isoroof|isopanel|isowall|sandwich|chapa/.test(t);
  const hasSumatoria = /(s[uú]mame|s[uú]male|agreg[aá]|agrega|a[ñn]ad|adem[áa]s|m[áa]s de)/.test(t);
  const hasAccessory = ACCESSORY_TERMS.some((a) => t.includes(a));

  if (/presupuesto\s+libre/.test(t)) return "presupuesto_libre";
  if (hasPanel && hasSumatoria && hasAccessory) return "presupuesto_libre";

  const techo = /techo|cubierta|techumbre|tinglado/.test(t);
  const pared = /pared|fachada|muro/.test(t);
  const camara = /c[áa]mara|frigor/.test(t);

  if (techo && pared) return "techo_fachada";
  if (techo) return "solo_techo";
  if (pared && !camara) return "solo_fachada";
  if (camara) return "camara_frig";
  return null;
}

function intentKind(intent) {
  if (intent === "camara_frig") return "camara";
  if (intent === "solo_techo" || intent === "techo_fachada") return "techo";
  if (intent === "solo_fachada") return "fachada";
  return null;
}

function scenarioKind(scenario) {
  if (scenario === "camara_frig") return "camara";
  if (scenario === "solo_techo" || scenario === "techo_fachada") return "techo";
  if (scenario === "solo_fachada") return "fachada";
  return null;
}

/**
 * Guard: detecta conflicto entre el escenario que se va a cotizar y lo que el
 * cliente pidió en el texto. Devuelve un mensaje de error o null si es coherente.
 *
 * @param {{ scenario?: string }} payload — payload del buildQuote
 * @param {string} text — consulta original del cliente
 * @returns {string|null}
 */
export function buildQuoteIntentConflict(payload, text) {
  const scenario = payload && typeof payload === "object" ? payload.scenario : null;
  const intent = inferQuoteIntentFromUserText(text);
  if (!intent || !scenario) return null;

  if (intent === "presupuesto_libre" && scenario !== "presupuesto_libre") {
    return `La consulta parece un presupuesto libre (paneles + accesorios sueltos) y no coincide con el escenario "${scenario}". Ajustá a presupuesto_libre o dividí la consulta.`;
  }

  const sk = scenarioKind(scenario);
  const ik = intentKind(intent);
  if (sk && ik && sk !== ik) {
    return `El escenario "${scenario}" no coincide con lo que pidió el cliente (${intent}). Revisá antes de cotizar.`;
  }

  return null;
}

// ── Rule #3 — consultas dependientes de adjunto/plano (aviso) ────────────

/**
 * Rule #3: si la consulta depende de un adjunto/plano y el texto no trae
 * medidas usables, devolver el gap a pedir. Advisory (no bloquea).
 *
 * @param {{ text?: string, hasAttachments?: boolean, origen?: string }} args
 * @returns {{ needsAttachment: boolean, gap: string|null, pedir: string[] }}
 */
export function attachmentGeometryGap({ text, hasAttachments = false, origen } = {}) {
  const t = String(text || "").toLowerCase();
  const o = String(origen || "").toUpperCase();
  const mentionsPlan = /plan(o|os|ito)|adjunt|ver\s+plano|wpp|te\s+mando|mando\s+(el|los)/.test(t);
  const needsAttachment = Boolean(hasAttachments) || o === "EM" || mentionsPlan;
  if (!needsAttachment) return { needsAttachment: false, gap: null, pedir: [] };

  const hasMeasures = /\d{2,5}\s*(?:m\s*[2²]|metros?\s+cuad)/i.test(t) || /\d{1,3}(?:[.,]\d{1,2})?\s*mm\b/i.test(t);
  if (hasMeasures) return { needsAttachment: true, gap: null, pedir: [] };

  return {
    needsAttachment: true,
    gap: "medidas_desde_plano_o_adjunto",
    pedir: ["largo útil", "m²", "cantidad de paneles"],
  };
}

export default {
  USD_M2,
  USD_M2_TYPICAL_BY_FAMILIA,
  sanityCheckUsdPerM2,
  suggestFamiliaForUso,
  needsClarifyForIncompleteLead,
  inferQuoteIntentFromUserText,
  buildQuoteIntentConflict,
  attachmentGeometryGap,
};
