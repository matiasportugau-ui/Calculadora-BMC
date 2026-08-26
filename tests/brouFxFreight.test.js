/**
 * BROU FX resolver + freight money edges (UYU→USD, needs_fx, % base).
 * Run: node tests/brouFxFreight.test.js
 *
 * Pins conversion / cache / missing-rate behavior used by quoteFreight when
 * a 2-fila or remolque load bills in UYU. Does not pin live catalog USD.
 */
import assert from "node:assert/strict";
import {
  classifyZona,
  cotizacionSinFleteFromGroups,
  quoteFreight,
} from "../src/utils/fleteEngine.js";
import { TARIFAS_LOGISTICAS } from "../src/data/constants.js";
import {
  clearBrouFxCache,
  getBrouUsdSellRate,
  setBrouFxForTests,
  uyuToUsdInteger,
} from "../src/utils/brouFx.js";

if (typeof globalThis.sessionStorage === "undefined") {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function resetFx() {
  setBrouFxForTests(null);
  clearBrouFxCache();
  try {
    sessionStorage.removeItem("bmc.brouFx");
  } catch {
    /* ignore */
  }
}

const TWO_FILA = [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 40 }];
const REMOLQUE = [{ tipo: "ISODEC", espesor: 100, longitud: 10, cantidad: 4 }];

console.log("brouFxFreight — uyuToUsdInteger");
ok(uyuToUsdInteger(21000, 40) === 525, "21000/40 → 525");
ok(uyuToUsdInteger(21000, 41) === 512, "21000/41 rounds to 512");
ok(uyuToUsdInteger(21000, 0) == null, "rate 0 → null");
ok(uyuToUsdInteger(21000, -40) == null, "negative rate → null");
ok(uyuToUsdInteger(Number.NaN, 40) == null, "NaN uyu → null");
ok(uyuToUsdInteger(21000, Number.NaN) == null, "NaN rate → null");

console.log("brouFxFreight — getBrouUsdSellRate");
resetFx();
setBrouFxForTests(41);
{
  const r = await getBrouUsdSellRate({
    fetchImpl: async () => {
      throw new Error("should_not_fetch_when_injected");
    },
  });
  ok(r.rate === 41 && r.source === "injected", "injected rate wins over fetch");
}

resetFx();
{
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return {
      ok: true,
      json: async () => ({ venta: 40.5 }),
    };
  };
  const first = await getBrouUsdSellRate({ fetchImpl });
  const second = await getBrouUsdSellRate({ fetchImpl });
  ok(first.rate === 40.5 && first.source === "dolarapi_uy", "fetch venta → dolarapi_uy");
  ok(second.rate === 40.5 && second.source === "memory_cache" && fetches === 1, "second call uses memory cache");
}

resetFx();
{
  const r = await getBrouUsdSellRate({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  ok(r.rate == null && r.source === "http_error", "http error without cache → null");
}

resetFx();
{
  await getBrouUsdSellRate({
    fetchImpl: async () => ({ ok: true, json: async () => ({ venta: 39 }) }),
  });
  const stale = await getBrouUsdSellRate({
    forceRefresh: true,
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  ok(stale.rate === 39 && stale.source === "stale_cache", "http error keeps stale memory cache");
}

resetFx();
{
  const r = await getBrouUsdSellRate({
    fetchImpl: async () => ({ ok: true, json: async () => ({ venta: 0 }) }),
  });
  ok(r.rate == null && r.source === "parse_error", "venta 0 is invalid payload");
}

resetFx();
{
  sessionStorage.setItem("bmc.brouFx", JSON.stringify({ rate: 38.2, at: Date.now() }));
  const r = await getBrouUsdSellRate({
    fetchImpl: async () => {
      throw new Error("network_down");
    },
  });
  ok(r.rate === 38.2 && r.source === "session_cache", "network error falls back to session cache");
}

// `fetchImpl: null` falls through to global fetch (`opts.fetchImpl || fetch`).
// "unavailable" only happens when both are missing — skip in Node 18+ where fetch exists.

console.log("brouFxFreight — quoteFreight needs_fx + costa factor");
{
  const q = quoteFreight({ destino: "Maldonado", panels: TWO_FILA });
  ok(q.ok === false && q.mode === "needs_fx" && q.error === "needs_fx", "2-fila without FX → needs_fx");
  ok(q.pendingUyu?.ventaUyu === 21000 && q.pendingUyu?.costoUyu === 18000, "pending UYU is costo+margen 21000/18000");
  ok(q.ventaUsd == null && q.costoUsd == null, "needs_fx does not invent USD");
}

{
  const q = quoteFreight({ destino: "Maldonado", panels: REMOLQUE });
  ok(q.ok === false && q.mode === "needs_fx", "remolque without FX → needs_fx");
  ok(
    q.pendingUyu?.ventaUyu === TARIFAS_LOGISTICAS.zonas.maldonado_corredor.remolqueVentaUyu &&
      q.pendingUyu?.costoUyu === TARIFAS_LOGISTICAS.zonas.maldonado_corredor.remolqueCostoUyu,
    "remolque pending UYU 28000/24000",
  );
}

{
  const q = quoteFreight({ destino: "Maldonado", panels: TWO_FILA, fxRateUyuPerUsd: 0 });
  ok(q.mode === "needs_fx", "fx 0 is not a usable rate");
}

{
  const mvd = quoteFreight({ destino: "Maldonado", panels: TWO_FILA, fxRateUyuPerUsd: 40 });
  const costa = quoteFreight({ destino: "Ciudad de la Costa", panels: TWO_FILA, fxRateUyuPerUsd: 40 });
  ok(mvd.ok === true && mvd.ventaUsd === 525, "Maldonado 2-fila 21000/40 → 525");
  ok(costa.ok === true && costa.ventaUsd === 473, "Costa 2-fila applies 0.9 → 473");
  ok(costa.costoUsd === 405, "Costa 2-fila costo 18000/40 × 0.9 → 405");
}

console.log("brouFxFreight — cotizacionSinFleteFromGroups");
ok(cotizacionSinFleteFromGroups(null, 123) === 123, "non-array uses fallback");
ok(cotizacionSinFleteFromGroups("x", 50) === 50, "string groups uses fallback");
ok(
  cotizacionSinFleteFromGroups([
    { items: [{ sku: "P1", total: 1000 }] },
    { items: [{ sku: "X", label: "Flete Montevideo", total: 280 }] },
  ]) === 1000,
  "label matching /flete/ is excluded even without FLETE sku",
);
ok(
  cotizacionSinFleteFromGroups([
    { items: [{ sku: "EXTRA", label: "Flete interno obra", total: 90 }] },
    { items: [{ sku: "EXTRA", label: "Andamio", total: 80 }] },
  ]) === 80,
  "EXTRA labeled flete* is skipped (current /flete/i rule)",
);
ok(
  cotizacionSinFleteFromGroups([{ items: [{ sku: "P1", total: -40 }] }]) === 0,
  "negative sum clamps to 0",
);
ok(classifyZona("") === "especial", "empty destino → especial (manual)");

console.log(`\nbrouFxFreight: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
