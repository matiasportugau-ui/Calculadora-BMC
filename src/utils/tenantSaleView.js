// Sale-only view for tenant BC quotes and activity logs.
// NOW: keep Jenerik sale prices / totals. Strip factory cost and commission.
// Later: a separate snapshot can add those fields without changing the PDF.

const COST_OR_COMMISSION_KEY = /^(costo|cost|factory|comision|commission|margen|margin|markup|bmc_cost|factory_cost|comision_usd|commission_usd)(_|$|[A-Z])/i;

const EXACT_BLOCK = new Set([
  "costo",
  "cost",
  "costo_usd",
  "costusd",
  "factory",
  "factory_cost",
  "factorycost",
  "costo_bmc",
  "costobmc",
  "comision",
  "commission",
  "comision_usd",
  "commissionusd",
  "margen",
  "margin",
  "markup",
  "bmc_snapshot",
]);

export function isCostOrCommissionKey(key) {
  const k = String(key || "").trim();
  if (!k) return false;
  if (EXACT_BLOCK.has(k.toLowerCase())) return true;
  return COST_OR_COMMISSION_KEY.test(k);
}

/**
 * Deep-clone `value` without cost / commission keys.
 * Sale fields (pu, total, total_usd, area_m2, lista) stay.
 */
export function toSalePayload(value, depth = 0) {
  if (value == null || typeof value !== "object" || depth > 8) return value;
  if (Array.isArray(value)) return value.map((item) => toSalePayload(item, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (isCostOrCommissionKey(k)) continue;
    out[k] = toSalePayload(v, depth + 1);
  }
  return out;
}

/** Metrics we keep in usage history for later pricing-model work. */
export function saleUsageMetrics(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  const nested = src.payload && typeof src.payload === "object" ? src.payload : {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] != null && obj[k] !== "") return obj[k];
    }
    return undefined;
  };
  const total = Number(
    pick(src, ["total_usd", "totalUsd"]) ??
      pick(nested, ["total_usd", "totalUsd", "totalConIva", "subtotalSinIva"]),
  );
  const area = Number(pick(src, ["area_m2", "areaM2"]) ?? pick(nested, ["areaTotalM2", "area_m2"]));
  const itemCount = Number(pick(src, ["item_count", "itemCount"]) ?? pick(nested, ["item_count"]));
  return toSalePayload({
    total_usd: Number.isFinite(total) && total > 0 ? total : undefined,
    area_m2: Number.isFinite(area) && area > 0 ? area : undefined,
    scenario: pick(src, ["scenario", "escenario"]) ?? pick(nested, ["escenario", "scenario"]),
    lista: pick(src, ["lista"]) ?? pick(nested, ["lista"]),
    item_count: Number.isFinite(itemCount) && itemCount > 0 ? itemCount : undefined,
    families: pick(src, ["families"]) ?? pick(nested, ["families"]),
  });
}
