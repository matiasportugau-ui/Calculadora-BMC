#!/usr/bin/env node
/**
 * Demostración en consola del flujo Combinada (planta 2D / fijaciones):
 * - Layout de puntos (ISODEC vs reparto)
 * - Claves por junta vertical (`fijacionDotKeysNearPanelJoint`)
 * - Overrides + conteo por material (`countPtsWithOverrides`, bulk)
 * - Suma multizona (misma lógica que `sumCombinadaPtsAllZonesForDotOverrides` en RoofPreview.jsx)
 * - BOM presupuestal (`calcFijacionesVarilla` con tipoEst "combinada")
 *
 * Ejecutar: npm run demo:combinada-fijacion
 *        o: node scripts/demo-combinada-fijacion-planta.mjs
 */

import { calcFijacionesVarilla } from "../src/utils/calculations.js";
import {
  fijacionDotsLayout,
  fijacionDotsLayoutDistributeTotal,
  fijacionDotKeysNearPanelJoint,
} from "../src/utils/roofEstructuraDotsLayout.js";
import {
  bulkSetDotsMaterialEnabled,
  countCombinadaMaterialsInDots,
  countPtsWithOverrides,
  mergeCombinadaByKeyWithDefaults,
} from "../src/utils/combinadaFijacionShared.js";

const line = (s = "") => console.log(s);
const title = (t) => {
  line();
  line("═".repeat(64));
  line(`  ${t}`);
  line("═".repeat(64));
};

/** Réplica del agregado multizona (ver RoofPreview `sumCombinadaPtsAllZonesForDotOverrides`). */
function sumPtsAllZones(zones, changedGi, nextOvForGi) {
  let ptsHorm = 0;
  let ptsMetal = 0;
  let ptsMadera = 0;
  for (const z of zones) {
    const { gi, rect, hints, combinadaByKey, prevOverrides } = z;
    const dots = fijacionDotsLayout(rect, hints, []);
    const keys = dots.map((d) => d.key);
    const byKey = mergeCombinadaByKeyWithDefaults(
      keys,
      combinadaByKey || {},
      0,
      0,
      0,
    );
    const ov = gi === changedGi ? nextOvForGi : prevOverrides || {};
    const c =
      ov && typeof ov === "object" && Object.keys(ov).length
        ? countPtsWithOverrides(dots, byKey, ov)
        : countCombinadaMaterialsInDots(dots, byKey);
    ptsHorm += c.ptsHorm;
    ptsMetal += c.ptsMetal;
    ptsMadera += c.ptsMadera;
  }
  return { ptsHorm, ptsMetal, ptsMadera };
}

title("1) Grilla ISODEC — layout real + junta por clave/cx");
const rect = { x: 0, y: 0, w: 10, h: 4, gi: 0 };
const hintsIso = {
  apoyos: 3,
  cantPaneles: 2,
  fijacionSistema: "varilla_tuerca",
  fijacionDotsMode: "isodec_grid",
  puntosFijacion: 99,
  fijacionEspaciadoPerimetroM: 2.5,
};
const dotsIso = fijacionDotsLayout(rect, hintsIso, []);
line(`  Zona 10×4 m, 3 apoyos, 2 paneles → ${dotsIso.length} puntos en planta (motor real).`);
const keysJ1Real = fijacionDotKeysNearPanelJoint(dotsIso, 1, rect, 2, hintsIso);
line(`  Junta j=1 con esos puntos: ${keysJ1Real.length} claves (si 0: ningún cx cae dentro de la tolerancia; el overlay usa franja ancha de golpeo).`);
const jointDotsStub = [
  { key: "r0-p0-a", kind: "grid", cx: 4.55, rowIndex: 0 },
  { key: "r0-p1-b", kind: "grid", cx: 5.45, rowIndex: 0 },
  { key: "r1-p0-c", kind: "grid", cx: 2.5, rowIndex: 1 },
];
const jointRStub = { x: 0, w: 10 };
const hintsIsoOnly = { fijacionSistema: "varilla_tuerca", fijacionDotsMode: "isodec_grid" };
const keysJ1Stub = fijacionDotKeysNearPanelJoint(jointDotsStub, 1, jointRStub, 2, hintsIsoOnly);
line(`  Ejemplo típico (cx junta a 5 m): ${keysJ1Stub.length} claves → ${JSON.stringify(keysJ1Stub)}`);

title("2) Reparto (no ISODEC) — misma junta por proximidad en X");
const hintsDist = {
  puntosFijacion: 8,
  apoyos: 3,
  fijacionSistema: "caballete",
  fijacionDotsMode: "distribute",
};
const dotsDist = fijacionDotsLayoutDistributeTotal(rect, hintsDist);
line(`  Puntos: ${dotsDist.length} (claves tipo r0-j0…).`);
const keysDistJ = fijacionDotKeysNearPanelJoint(dotsDist, 1, rect, 2, hintsDist);
line(`  Junta j=1: ${keysDistJ.length} claves → ${JSON.stringify(keysDistJ)}`);

title("3) Overrides — bulk “hormigón” en puntos de la junta (claves del ejemplo)");
const keysStub = jointDotsStub.map((d) => d.key);
const byKeyStub = mergeCombinadaByKeyWithDefaults(keysStub, {}, 0, 0, 0);
const ovH = bulkSetDotsMaterialEnabled(keysJ1Stub, "hormigon", byKeyStub, {});
const cJunta = countPtsWithOverrides(jointDotsStub, byKeyStub, ovH);
line(`  Tras hormigón en ${keysJ1Stub.length} puntos de junta (${JSON.stringify(keysJ1Stub)}):`);
line(`    ptsHorm=${cJunta.ptsHorm} ptsMetal=${cJunta.ptsMetal} ptsMadera=${cJunta.ptsMadera} (solo esta “zona” de ejemplo)`);

title("4) Multizona — suma global (2 zonas; overrides solo en zona 0 = ejemplo junta)");
const hintsZ = { ...hintsIso, puntosFijacion: 99 };
const z0 = {
  gi: 0,
  rect: { x: 0, y: 0, w: 10, h: 4, gi: 0 },
  hints: hintsZ,
  combinadaByKey: {},
  prevOverrides: {},
};
const z1 = {
  gi: 1,
  rect: { x: 11, y: 0, w: 6, h: 4, gi: 1 },
  hints: { ...hintsZ, cantPaneles: 1 },
  combinadaByKey: {},
  prevOverrides: {},
};
const dotsZ1 = fijacionDotsLayout(z1.rect, z1.hints, []);
const byKey1 = mergeCombinadaByKeyWithDefaults(
  dotsZ1.map((d) => d.key),
  {},
  0,
  0,
  0,
);
z1.prevOverrides = bulkSetDotsMaterialEnabled(
  dotsZ1.map((d) => d.key),
  "metal",
  byKey1,
  {},
);
const z0DotsReal = fijacionDotsLayout(z0.rect, z0.hints, []);
const byKeyZ0Real = mergeCombinadaByKeyWithDefaults(
  z0DotsReal.map((d) => d.key),
  {},
  0,
  0,
  0,
);
const ovZ0Real = bulkSetDotsMaterialEnabled(keysJ1Stub, "hormigon", byKeyZ0Real, {});
const agg = sumPtsAllZones([z0, z1], 0, ovZ0Real);
line(`  Zona 0: layout real + hormigón en claves de junta del ejemplo (mapeadas si existen en layout). Zona 1: todo metal.`);
line(`  Global agregado → ptsHorm=${agg.ptsHorm} ptsMetal=${agg.ptsMetal} ptsMadera=${agg.ptsMadera}`);

title('5) BOM — calcFijacionesVarilla("combinada", pts globales, espesor mm)');
const fij = calcFijacionesVarilla(2, 3, 5, "combinada", agg.ptsHorm, agg.ptsMetal, agg.ptsMadera, {
  espesorMm: 100,
});
line(`  puntosFijacion=${fij.puntosFijacion} (suma de los tres materiales habilitados)`);
line("  Ítems (sku → cant):");
for (const it of fij.items || []) {
  line(`    ${it.sku.padEnd(22)} ${it.cant}`);
}
line(`  Total fijaciones: ${fij.total}`);

title("Listo");
line("  Código de referencia: RoofPreview.jsx (overlay + sumCombinadaPtsAllZonesForDotOverrides),");
line("  calculations.js → calcFijacionesVarilla, roofEstructuraDotsLayout.js → fijacionDotKeysNearPanelJoint.");
line();
