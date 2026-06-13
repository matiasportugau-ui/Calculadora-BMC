// ═══════════════════════════════════════════════════════════════════════════
// GC-0003 — Golden case for WOLF-2026-0003 (missing edge accessories loaded)
// ───────────────────────────────────────────────────────────────────────────
// Proves the per-thickness lateral-cámara family replaced the `_all` collapse
// and that the new GSDECAM100 superior-cámara entry is present. All prices are
// ex-IVA (D1: IVA 22% applied once at the quote total), `web` list.
//
//   (b) gotero_lateral_camara ISODEC 150 mm, web list → 28.9100 ex IVA (3 m bar)
//   (b) full per-thickness family present (100/150/200/250), no `_all` collapse
//   (a) GSDECAM100 superior cámara 100 mm present, web → 46.046 ex IVA
//
// Sub-items (c) ISOROOF 100 mm and (d) PIR 120 superior are NOT asserted:
//   (c) blocked — Matriz 100 mm prices not provided in-session.
//   (d) skipped — D2 (new SKU vs GF120DC) unresolved.
//
// Run:  node evals/golden-cases/GC-0003.test.mjs
// Exit: 0 = green, 1 = red.
// ═══════════════════════════════════════════════════════════════════════════
import { PERFIL_TECHO } from "../../src/data/constants.js";
import { calcTechoCompleto, resolveSKU_techo } from "../../src/utils/calculations.js";

// round half up to 4 decimals (Matriz convention for this family)
const r4 = (n) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

const checks = [];

// (b) lateral cámara ISODEC 150 mm web list → 28.9100 ex IVA
const lat = PERFIL_TECHO.gotero_lateral_camara.ISODEC;
checks.push({
  name: "(b) gotero_lateral_camara ISODEC 150mm web → 28.9100 ex IVA",
  expected: 28.91,
  actual: r4(lat?.[150]?.web),
});

// (b) full per-thickness family present (collapse `_all` removed)
checks.push({
  name: "(b) ISODEC lateral cámara has thicknesses 100/150/200/250 (no _all)",
  expected: "100,150,200,250",
  actual: Object.keys(lat || {}).filter((k) => k !== "_all").join(","),
});
checks.push({
  name: "(b) ISODEC lateral cámara `_all` collapse removed",
  expected: true,
  actual: lat?._all === undefined,
});

// (b) the other three verbatim Matriz web values
checks.push({ name: "(b) ISODEC 100mm web → 27.6640", expected: 27.664, actual: r4(lat?.[100]?.web) });
checks.push({ name: "(b) ISODEC 200mm web → 43.2740 (D3 anomaly, verbatim)", expected: 43.274, actual: r4(lat?.[200]?.web) });
checks.push({ name: "(b) ISODEC 250mm web → 37.5900", expected: 37.59, actual: r4(lat?.[250]?.web) });

// (a) GSDECAM100 superior cámara 100 mm present, corrected SKU + web verbatim
const gs100 = PERFIL_TECHO.gotero_superior.ISODEC?.[100];
checks.push({ name: "(a) GSDECAM100 present with corrected SKU", expected: "GSDECAM100", actual: gs100?.sku });
checks.push({ name: "(a) GSDECAM100 web → 46.046 ex IVA", expected: 46.046, actual: r4(gs100?.web) });
checks.push({ name: "(a) GSDECAM100 venta → 39.468 ex IVA", expected: 39.468, actual: r4(gs100?.venta) });
checks.push({
  name: "(a) GSDECAM100 resolves for ISODEC 100 mm automatic quote path",
  expected: "GSDECAM100",
  actual: resolveSKU_techo("gotero_superior", "ISODEC", 100)?.sku,
});

const quote100 = calcTechoCompleto({
  familia: "ISODEC_EPS",
  espesor: 100,
  largo: 6,
  ancho: 5,
  tipoEst: "metal",
  ptsHorm: 0,
  borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
  opciones: { inclCanalon: false, inclGotSup: true, inclSell: false, bomComercial: false },
  color: "Blanco",
});
const quoteGs100 = quote100?.perfileria?.items?.find((item) => item.sku === "GSDECAM100");
checks.push({
  name: "(a) ISODEC_EPS 100 mm quote with inclGotSup includes GSDECAM100",
  expected: "GSDECAM100:2:92.09",
  actual: quoteGs100 ? `${quoteGs100.sku}:${quoteGs100.cant}:${r4(quoteGs100.total)}` : "missing",
});

// ── PIR lateral-cámara fallback (decisión take-control 11/06) ───────────────
// PIR no tiene fila propia de este accesorio en la Matriz; se restauró el
// fallback `_all` con SKU corregido GLDCAMPIR para que PIR 50/80/120 sigan
// resolviendo la línea del BOM (sin reintroducir el SKU genérico GLDCAM-DC).
const pir = PERFIL_TECHO.gotero_lateral_camara.ISODEC_PIR;
checks.push({ name: "(PIR) `_all` fallback con SKU corregido GLDCAMPIR", expected: "GLDCAMPIR", actual: pir?._all?.sku });
checks.push({
  name: "(PIR) lateral cámara 80 mm resuelve vía `_all` (web 30.92)",
  expected: 30.92,
  actual: r4(resolveSKU_techo("gotero_lateral_camara", "ISODEC_PIR", 80)?.web),
});
checks.push({ name: "(PIR) sin reintroducir el SKU genérico GLDCAM-DC", expected: true, actual: pir?._all?.sku !== "GLDCAM-DC" });

let failed = 0;
for (const c of checks) {
  const ok = c.actual === c.expected;
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"} — ${c.name} (expected ${c.expected}, got ${c.actual})`);
}

if (failed > 0) {
  console.error(`\nGC-0003 ✗ — ${failed}/${checks.length} check(s) failed`);
  process.exit(1);
}
console.log("\nGC-0003 ✓ — all checks green");
