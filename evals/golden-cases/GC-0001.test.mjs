// ═══════════════════════════════════════════════════════════════════════════
// GC-0001 — Golden case for WOLF-2026-0001 (familia ISOFRIG ausente del catálogo)
// ───────────────────────────────────────────────────────────────────────────
// Cotización presupuesto_libre: panel ISOFRIG 100 mm, 10 m², lista web →
// unitario esperado 76.9454 USD/m² ex-IVA (Matriz BROMYROS, fila IF100-IFSL100,
// columna Venta web USD ex-IVA; valor textual del ledger BUG-TRIAGE-RAMIRO).
//
// Checks:
//   (a) PANELS_PARED.ISOFRIG_PIR.esp[100].web → 76.9454 ex-IVA (dato crudo)
//   (b) computePresupuestoLibreCatalogo (camino real del escenario) con una
//       línea ISOFRIG_PIR / 100 mm / 10 m² → pu 76.9454, total línea 769.45
//   (c) los 7 espesores reales cargados (40…180) y la fila clonada 200 EXCLUIDA
//   (d) visibilidad: ISOFRIG_PIR listado en el escenario camara_frig
//   (e) reglas técnicas: au 1.10 (ficha Kingspan, 1100 mm) y solo Blanco
//
// Run:  node evals/golden-cases/GC-0001.test.mjs
// Exit: 0 = green, 1 = red.
// ═══════════════════════════════════════════════════════════════════════════
import { PANELS_PARED, SCENARIOS_DEF } from "../../src/data/constants.js";
import { computePresupuestoLibreCatalogo } from "../../src/utils/presupuestoLibreCatalogo.js";

// round half up to 2 decimals (Matriz convention)
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const checks = [];
const fam = PANELS_PARED.ISOFRIG_PIR;

// (a) dato crudo: web 100 mm ex-IVA
// Updated 2026-06-16 (WOLF-2026-0004): web was IVA-embedded (76.9454 = 63.07×1.22).
// Fixed to 63.07 (= venta, ex-IVA). See GC-0004 for full IVA regression guard.
checks.push({
  name: "(a) ISOFRIG_PIR 100 mm web → 63.07 ex-IVA",
  expected: 63.07,
  actual: fam?.esp?.[100]?.web,
});

// (b) camino real presupuesto_libre: 10 m² × 100 mm, lista web
const libre = computePresupuestoLibreCatalogo({
  listaPrecios: "web",
  librePanelLines: [{ familia: "ISOFRIG_PIR", espesor: 100, m2: 10 }],
});
const lineaPanel = libre?.libreGroups?.find((g) => g.title === "PANELES")?.items?.[0];
checks.push({
  name: "(b1) presupuesto_libre pu unitario → 63.07",
  expected: 63.07,
  actual: lineaPanel?.pu,
});
checks.push({
  name: "(b2) presupuesto_libre total línea 10 m² → 630.70 ex-IVA",
  expected: 630.7,
  actual: lineaPanel ? r2(lineaPanel.total) : undefined,
});

// (b-venta) lista VENTA (default BMC): ISOFRIG_PIR 100 mm
checks.push({
  name: "(b3) ISOFRIG_PIR 100 mm venta → 63.07",
  expected: 63.07,
  actual: fam?.esp?.[100]?.venta,
});
const libreVenta = computePresupuestoLibreCatalogo({
  listaPrecios: "venta",
  librePanelLines: [{ familia: "ISOFRIG_PIR", espesor: 100, m2: 10 }],
});
const lineaVenta = libreVenta?.libreGroups?.find((g) => g.title === "PANELES")?.items?.[0];
checks.push({
  name: "(b4) presupuesto_libre VENTA total 10 m² → 630.70 ex-IVA",
  expected: 630.7,
  actual: lineaVenta ? r2(lineaVenta.total) : undefined,
});

// (c) espesores: 7 reales, sin la fila 200 clonada de IF150
const espesores = fam ? Object.keys(fam.esp).map(Number).sort((x, y) => x - y) : [];
checks.push({
  name: "(c1) espesores cargados → 40,60,80,100,120,150,180",
  expected: "40,60,80,100,120,150,180",
  actual: espesores.join(","),
});
checks.push({
  name: "(c2) fila clonada 200 mm excluida",
  expected: undefined,
  actual: fam?.esp?.[200],
});

// (d) visibilidad de escenario: camara_frig lista la familia
const camara = SCENARIOS_DEF.find((s) => s.id === "camara_frig");
checks.push({
  name: "(d) camara_frig.familias incluye ISOFRIG_PIR",
  expected: true,
  actual: Boolean(camara?.familias?.includes("ISOFRIG_PIR")),
});

// (e) reglas técnicas (ficha Kingspan): au 1.10 m (1100 mm), solo Blanco
checks.push({
  name: "(e1) au → 1.10 m (ficha oficial; NO 1.14 legacy)",
  expected: 1.1,
  actual: fam?.au,
});
checks.push({
  name: "(e2) col → solo Blanco (sanitario)",
  expected: "Blanco",
  actual: fam?.col?.join(","),
});

let failed = 0;
for (const c of checks) {
  const ok = Object.is(c.actual, c.expected);
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"} — ${c.name} (expected ${c.expected}, got ${c.actual})`);
}

if (failed > 0) {
  console.error(`\nGC-0001 ✗ — ${failed}/${checks.length} check(s) failed`);
  process.exit(1);
}
console.log("\nGC-0001 ✓ — all checks green");
