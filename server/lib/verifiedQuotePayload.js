/**
 * Pure builder that turns a Panelin tool result into a "verified_quote"
 * SSE payload the client renders as a trust block under the assistant
 * message ("✓ Verificado por el cotizador · Lista web · USD 8.345 c/IVA").
 *
 * Eligible tools (must have actually run and returned ok):
 *   - calcular_cotizacion       → kind: "single"
 *   - comparar_listas           → kind: "comparar_listas"
 *   - comparar_escenarios       → kind: "comparar_escenarios"
 *
 * Returns null for any other tool, errored result, or shape we don't
 * recognize. The caller (agentChat.js) decides whether to emit; this
 * helper has no side effects so it's trivial to unit-test.
 */

const ELIGIBLE_TOOLS = new Set([
  "calcular_cotizacion",
  "comparar_listas",
  "comparar_escenarios",
]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isErrorResult(r) {
  if (!r || typeof r !== "object") return true;
  if (r.error) return true;
  if (r.ok === false) return true;
  return false;
}

/**
 * @param {string} toolName
 * @param {object} parsedResult  Already-parsed JSON returned by executeTool.
 * @param {{ ivaPct?: number }} [opts]
 * @returns {object|null}
 */
export function buildVerifiedQuotePayload(toolName, parsedResult, opts = {}) {
  if (!ELIGIBLE_TOOLS.has(toolName)) return null;
  if (isErrorResult(parsedResult)) return null;

  const ivaPct = Number.isFinite(opts.ivaPct) ? opts.ivaPct : 22;

  if (toolName === "calcular_cotizacion") {
    const total = num(parsedResult.totalConIVA);
    const subtotal = num(parsedResult.subtotalSinIVA);
    if (total == null || subtotal == null) return null;
    return {
      kind: "single",
      tool: toolName,
      lista: parsedResult.listaPrecios || null,
      scenario: parsedResult.scenario || null,
      subtotal_sin_iva: subtotal,
      total_con_iva: total,
      iva_usd: num(parsedResult.iva22),
      iva_pct: ivaPct,
      area_m2: num(parsedResult.area_m2),
      cant_paneles: num(parsedResult.cant_paneles),
    };
  }

  if (toolName === "comparar_listas") {
    const web = parsedResult.web || {};
    const venta = parsedResult.venta || {};
    const totalWeb = num(web.totalConIVA);
    const totalVenta = num(venta.totalConIVA);
    if (totalWeb == null || totalVenta == null) return null;
    return {
      kind: "comparar_listas",
      tool: toolName,
      scenario: parsedResult.scenario || null,
      web: {
        subtotal_sin_iva: num(web.subtotalSinIVA),
        total_con_iva: totalWeb,
      },
      venta: {
        subtotal_sin_iva: num(venta.subtotalSinIVA),
        total_con_iva: totalVenta,
      },
      delta_usd: num(parsedResult.delta_usd),
      delta_pct: num(parsedResult.delta_pct),
      iva_pct: ivaPct,
    };
  }

  if (toolName === "comparar_escenarios") {
    const a = parsedResult.a || {};
    const b = parsedResult.b || {};
    const totalA = num(a.totalConIVA);
    const totalB = num(b.totalConIVA);
    if (totalA == null || totalB == null) return null;
    return {
      kind: "comparar_escenarios",
      tool: toolName,
      lista: parsedResult.listaPrecios || null,
      a: {
        scenario: a.scenario || null,
        subtotal_sin_iva: num(a.subtotalSinIVA),
        total_con_iva: totalA,
      },
      b: {
        scenario: b.scenario || null,
        subtotal_sin_iva: num(b.subtotalSinIVA),
        total_con_iva: totalB,
      },
      delta_usd: num(parsedResult.delta_usd),
      delta_pct: num(parsedResult.delta_pct),
      iva_pct: ivaPct,
    };
  }

  return null;
}

export { ELIGIBLE_TOOLS };
