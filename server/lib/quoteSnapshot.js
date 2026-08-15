/**
 * Server-canonical freeze. ADR-003 / ADR-004.
 * Existing snapshot is never overwritten.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function extractLines(payload) {
  if (!payload || typeof payload !== "object") return [];
  const raw =
    payload.lines ||
    payload.items ||
    payload.bom ||
    payload.resumen?.lines ||
    payload.summary?.lines ||
    [];
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => ({
    sku: String(l.sku || l.id || l.code || l.nombre || "line"),
    qty: num(l.qty ?? l.cantidad ?? l.cant) ?? 0,
    client_unit: num(l.unit_price ?? l.precio ?? l.unit_price_client),
  })).filter((l) => l.qty > 0);
}

export function pickClientTotal(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    num(payload.totalUsd) ||
    num(payload.total_usd) ||
    num(payload.totals?.usd) ||
    num(payload.summary?.total_usd) ||
    num(payload.resumen?.total_usd) ||
    null
  );
}

/**
 * @param {object} payload
 * @param {object} [opts]
 * @param {Record<string, number>} [opts.catalog] sku → unit price USD ex-IVA
 * @param {object|null} [opts.existingSnapshot]
 * @param {string} [opts.lista]
 * @param {string} [opts.dataVersion]
 * @param {Date} [opts.now]
 */
export function buildBmcSnapshot(payload, opts = {}) {
  if (opts.existingSnapshot && typeof opts.existingSnapshot === "object") {
    return { snapshot: opts.existingSnapshot, reused: true };
  }
  const catalog = opts.catalog || {};
  const lines = extractLines(payload).map((l) => {
    const fromCat = num(catalog[l.sku]);
    const unit = fromCat != null ? fromCat : (l.client_unit ?? 0);
    return {
      sku: l.sku,
      qty: l.qty,
      unit_price_server: unit,
      source: fromCat != null ? "LISTA_ACTIVA" : "payload_fallback",
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price_server, 0);
  const iva = 0.22;
  const total_usd = Math.round(subtotal * (1 + iva) * 100) / 100;
  const client_total_usd = pickClientTotal(payload);
  const cost = lines.reduce((s, l) => s + l.qty * l.unit_price_server * 0.83, 0);
  const margin_usd = Math.round((subtotal - cost) * 100) / 100;
  const margin_pct = subtotal > 0 ? Math.round((margin_usd / subtotal) * 10000) / 100 : 0;
  const price_drift =
    client_total_usd != null && Math.abs(client_total_usd - total_usd) > 0.05;

  return {
    reused: false,
    snapshot: {
      lista: opts.lista || payload.lista || "venta",
      currency: "USD",
      lines,
      subtotal_usd: Math.round(subtotal * 100) / 100,
      iva,
      total_usd,
      margin_usd,
      margin_pct,
      client_total_usd,
      price_drift,
      priced_at: (opts.now || new Date()).toISOString(),
      calculator_data_version: opts.dataVersion || payload.calculator_data_version || null,
    },
  };
}
