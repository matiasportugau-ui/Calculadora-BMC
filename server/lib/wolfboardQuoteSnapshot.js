/**
 * Machine-readable snapshot for replay / human-vs-bot benchmarks (Wolfboard IA batch).
 * Safe to JSON.stringify (drops functions, cycles best-effort).
 */

function jsonSafe(value) {
  if (value == null) return value;
  try {
    return JSON.parse(
      JSON.stringify(value, (_k, v) => (typeof v === "function" ? undefined : v)),
    );
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {number} opts.adminRow
 * @param {string} [opts.cliente]
 * @param {string} [opts.consulta]
 * @param {object|null} opts.extracted  LLM-extracted params
 * @param {string[]} opts.usedDefaults
 * @param {object|null} opts.calcRaw     Result from runBatchCalc / calculations
 * @param {string} [opts.listaPrecios]
 */
export function buildWolfboardQuoteReplaySnapshot(opts) {
  const {
    adminRow,
    cliente = "",
    consulta = "",
    extracted = null,
    usedDefaults = [],
    calcRaw = null,
    listaPrecios = "web",
  } = opts || {};

  return {
    schemaVersion: 1,
    kind: "wolfboard-quote-batch",
    generatedAt: new Date().toISOString(),
    adminRow: adminRow ?? null,
    cliente: String(cliente || ""),
    consulta: String(consulta || ""),
    listaPrecios: String(listaPrecios || "web"),
    extracted: jsonSafe(extracted),
    usedDefaults: Array.isArray(usedDefaults) ? [...usedDefaults] : [],
    calcRaw: jsonSafe(calcRaw),
  };
}
