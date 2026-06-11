/**
 * Tests for scripts/catalog-diff.mjs (WOLF-2026-0004 etapa 2).
 * Cubre el normalizador (coma decimal, #VALUE!, vacío) y el diff
 * (SKU duplicado, política de celda vacía, divergencia, fuera de rango).
 * Run: node tests/catalogDiff.test.js
 */

import {
  normalizeDecimal,
  scanConstantsForPrices,
  parseMatrizCsv,
  diffCatalogVsMatriz,
  bandForPath,
  CONFIG,
} from "../scripts/catalog-diff.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

/* ── Normalizer ─────────────────────────────────────────────────────────── */
group("normalizeDecimal — coma decimal", () => {
  assert(normalizeDecimal("32,84").value === 32.84, '"32,84" → 32.84 (no 3284)');
  assert(normalizeDecimal("32,84").status === "ok", '"32,84" status ok');
  assert(normalizeDecimal("10,27").value === 10.27, '"10,27" → 10.27');
  assert(normalizeDecimal("1.025,50").value === 1025.5, '"1.025,50" → 1025.50 (miles europeo)');
  assert(normalizeDecimal("1025.50").value === 1025.5, '"1025.50" → 1025.50 (punto decimal)');
  assert(normalizeDecimal("45.52").value === 45.52, '"45.52" → 45.52');
});

group("normalizeDecimal — enteros / signo / moneda", () => {
  assert(normalizeDecimal("20").value === 20, '"20" → 20');
  assert(normalizeDecimal(" 8.00 ").value === 8, '" 8.00 " → 8 (trim)');
  assert(normalizeDecimal("$ 12,50").value === 12.5, '"$ 12,50" → 12.50 (símbolo moneda)');
  assert(normalizeDecimal("-3").value === -3, '"-3" → -3 (negativo preservado para banda)');
  assert(normalizeDecimal(42.5).value === 42.5, "número JS pasa directo");
});

group("normalizeDecimal — error sentinels (#VALUE!/#REF!)", () => {
  assert(normalizeDecimal("#VALUE!").status === "error", "#VALUE! → error");
  assert(normalizeDecimal("#VALUE!").value === null, "#VALUE! → value null (nunca número)");
  assert(normalizeDecimal("#REF!").status === "error", "#REF! → error");
  assert(normalizeDecimal("#DIV/0!").status === "error", "#DIV/0! → error");
  assert(normalizeDecimal("#N/A").status === "error", "#N/A → error");
  assert(normalizeDecimal("abc").status === "error", '"abc" → error');
});

group("normalizeDecimal — vacío (nunca rellena)", () => {
  assert(normalizeDecimal("").status === "empty", '"" → empty');
  assert(normalizeDecimal("   ").status === "empty", '"   " → empty');
  assert(normalizeDecimal(null).status === "empty", "null → empty");
  assert(normalizeDecimal(undefined).status === "empty", "undefined → empty");
  assert(normalizeDecimal("").value === null, "empty → value null");
});

/* ── Scanner de constants ────────────────────────────────────────────────── */
group("scanConstantsForPrices — hojas en línea, anidadas y _all", () => {
  const src = `
    export const PANELS_TECHO = {
      ISOROOF_3G: { esp: { 30: { venta: 43.53, web: 43.53, costo: 37.85, ap: 2.8 } } },
    };
    export const PERFIL_TECHO = {
      cumbrera: { ISOROOF: { _all: { sku: "X", venta: 35.22, web: 42.97, costo: 29.35 } } },
    };
    export const C = { primary: 5 }; // no es root de precio
  `;
  const m = scanConstantsForPrices(src);
  assert(m.get("PANELS_TECHO.ISOROOF_3G.esp.30")?.venta === 43.53, "panel venta capturado");
  assert(m.get("PANELS_TECHO.ISOROOF_3G.esp.30")?.costo === 37.85, "panel costo capturado");
  assert(m.get("PERFIL_TECHO.cumbrera.ISOROOF._all")?.web === 42.97, "_all web capturado");
  assert(!m.has("C"), "roots no-precio ignorados");
});

/* ── Parse MATRIZ + duplicate SKU ────────────────────────────────────────── */
group("parseMatrizCsv — detecta SKU duplicado", () => {
  const csv = [
    "sku,path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab",
    "GL80,PERFIL_TECHO.gotero_lateral.ISOROOF.80,Gotero 80,Perfilería Techo,22.78,25.31,,30.88,,unid,BROMYROS",
    "GL80,PERFIL_TECHO.gotero_lateral.ISODEC.100,Gotero 100,Perfilería Techo,18.69,20.77,,25.34,,unid,BROMYROS",
    "ISDEC100,PANELS_TECHO.ISODEC_EPS.esp.100,Isodec,Paneles Techo,35.79,41.15,,50.10,,m²,BROMYROS",
  ].join("\n");
  const { rows, duplicateSkus } = parseMatrizCsv(csv);
  assert(duplicateSkus.has("GL80"), "GL80 detectado como duplicado");
  assert(!duplicateSkus.has("ISDEC100"), "ISDEC100 no es duplicado");
  assert(rows.length === 3, "3 filas parseadas");
  assert(rows[0].costo.value === 22.78, "costo normalizado");
});

/* ── Diff: SKU duplicado no compara nada ─────────────────────────────────── */
group("diff — SKU duplicado → warn, compara nada", () => {
  const catalog = new Map([["PERFIL_TECHO.gotero_lateral.ISOROOF.80", { venta: 999, web: 999, costo: 999 }]]);
  const csv = [
    "sku,path,costo,venta_local,venta_web",
    "GL80,PERFIL_TECHO.gotero_lateral.ISOROOF.80,22.78,25.31,30.88",
    "GL80,PERFIL_TECHO.gotero_lateral.ISODEC.100,18.69,20.77,25.34",
  ].join("\n");
  const matriz = parseMatrizCsv(csv);
  const { findings } = diffCatalogVsMatriz(catalog, matriz);
  assert(findings.some((f) => f.type === "duplicate-sku"), "emite duplicate-sku");
  assert(!findings.some((f) => f.type === "divergence"), "no compara (sin divergence) pese a catálogo 999");
});

/* ── Diff: celda vacía = no-source, nunca rellena ────────────────────────── */
group("diff — celda MATRIZ vacía → no-source (WOLF-0002)", () => {
  const catalog = new Map([["PANELS_TECHO.ISODEC_EPS.esp.100", { venta: 41.15, web: 50.1, costo: 35.79 }]]);
  const csv = [
    "sku,path,costo,venta_local,venta_web",
    "ISDEC100,PANELS_TECHO.ISODEC_EPS.esp.100,35.79,,", // venta y web vacías
  ].join("\n");
  const { findings, summary } = diffCatalogVsMatriz(catalog, parseMatrizCsv(csv));
  const noSrc = findings.filter((f) => f.type === "no-source");
  assert(noSrc.length === 2, `2 celdas no-source (venta+web), got ${noSrc.length}`);
  assert(summary.s1 === 0, "celdas vacías no generan S1");
});

/* ── Diff: divergencia (inyección −25%) → S1 ─────────────────────────────── */
group("diff — inyección −25% → S1 divergence", () => {
  const fair = new Map([["PANELS_TECHO.ISODEC_EPS.esp.100", { venta: 41.15, web: 50.1, costo: 35.79 }]]);
  const injected = new Map([["PANELS_TECHO.ISODEC_EPS.esp.100", { venta: 41.15 * 0.75, web: 50.1, costo: 35.79 }]]);
  const csv = [
    "sku,path,costo,venta_local,venta_web",
    "ISDEC100,PANELS_TECHO.ISODEC_EPS.esp.100,35.79,41.15,50.10",
  ].join("\n");
  const matriz = parseMatrizCsv(csv);
  const clean = diffCatalogVsMatriz(fair, matriz);
  assert(clean.summary.s1 === 0, "catálogo fiel → 0 S1");
  const dirty = diffCatalogVsMatriz(injected, matriz);
  const div = dirty.findings.find((f) => f.type === "divergence" && f.field === "venta_local");
  assert(!!div, "inyección −25% produce divergence en venta_local");
  assert(dirty.summary.s1 >= 1, "exit-code sería ≠0 (S1≥1)");
  assert(Math.abs(div.deltaPct - 25) < 0.1, `delta ≈ 25%, got ${div?.deltaPct}`);
});

/* ── Diff: piso absoluto neutraliza redondeo sub-centavo ─────────────────── */
group("diff — redondeo 2 decimales no genera S1", () => {
  const catalog = new Map([["FIJACIONES.tornillo_t1", { venta: 0.0492, web: 0.0574, costo: 0.0115 }]]);
  const csv = [
    "sku,path,costo,venta_local,venta_web",
    "T1PERF,FIJACIONES.tornillo_t1,0.01,0.05,0.06", // MATRIZ redondeada a 2 dec
  ].join("\n");
  const { summary } = diffCatalogVsMatriz(catalog, parseMatrizCsv(csv));
  assert(summary.s1 === 0, "diferencias sub-centavo bajo el piso absoluto → 0 S1");
});

/* ── Diff: catálogo fuera de banda (coma decimal) → S1 ───────────────────── */
group("diff — catálogo fuera de banda → S1 catalog-out-of-range", () => {
  const catalog = new Map([["PANELS_TECHO.ISODEC_EPS.esp.100", { venta: 4115, web: 50.1, costo: 35.79 }]]); // 41,15 → 4115
  const csv = [
    "sku,path,costo,venta_local,venta_web",
    "ISDEC100,PANELS_TECHO.ISODEC_EPS.esp.100,35.79,,50.10",
  ].join("\n");
  const { findings, summary } = diffCatalogVsMatriz(catalog, parseMatrizCsv(csv));
  assert(findings.some((f) => f.type === "catalog-out-of-range" && f.field === "venta_local"), "venta 4115 fuera de banda");
  assert(summary.s1 >= 1, "fuera de banda es S1");
});

group("bandForPath — categorías", () => {
  assert(bandForPath("FIJACIONES.anclaje_isoroof_gris").label.includes("anclajes"), "anclaje → banda anclajes");
  assert(bandForPath("PANELS_TECHO.ISODEC_EPS.esp.100").max === 150, "panel banda 20–150");
  assert(bandForPath("SERVICIOS.flete").min === null, "servicios sin banda");
  assert(bandForPath("PERFIL_TECHO.gotero_lateral.ISOROOF.80").label.includes("goteros"), "gotero → banda goteros");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} catalogDiff: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
