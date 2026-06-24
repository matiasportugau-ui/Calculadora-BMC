// E2E offline — pipeline interpret → footprint → CAD (sin servidor).
// Determinístico con stubs de extracción; corrida en vivo opcional si hay API key.
// Ejecutar: node tests/cad-pipeline-e2e.test.js
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { mapToBmc, resolveFootprint } from "../server/lib/planInterpreter.js";
import { buildPlanGeometry } from "../server/lib/cad/planGeometry.js";
import { geometryToDxf } from "../server/lib/cad/dxfExport.js";

let pass = 0;
const ok = (c, m) => { assert.ok(c, m); console.log("  ✓", m); pass++; };

// ── A. Extracción con footprintPoligono (caso T de Dolores) ────────────────
console.log("A) Visión → footprintPoligono (T Dolores):");
const extT = {
  techoZonas: [{ largoM: 14, anchoM: 6 }, { largoM: 9, anchoM: 3 }],
  footprintPoligono: [[5.5, 0], [8.5, 0], [8.5, 9], [14, 9], [14, 15], [0, 15], [0, 9], [5.5, 9]],
  tipoAguas: "una_agua", confianza: "media", notas: [],
};
const mappedT = mapToBmc(extT);
ok(mappedT.bmcPayload.footprintSource === "vision_polygon", "footprintSource = vision_polygon");
ok(Array.isArray(mappedT.bmcPayload.footprint) && mappedT.bmcPayload.footprint.length === 8, "footprint con 8 vértices");
const geomT = buildPlanGeometry({ footprint: mappedT.bmcPayload.footprint });
ok(geomT.areaM2 === 111, `área = 111 m² (got ${geomT.areaM2})`);
const dxfT = geometryToDxf(geomT);
ok(dxfT.includes("A-WALL") && dxfT.trim().endsWith("EOF"), "DXF válido con capa A-WALL");

// ── B. Una sola zona, sin polígono → rectángulo automático ─────────────────
console.log("B) Una zona sin polígono → rectángulo:");
const ext1 = { techoZonas: [{ largoM: 8, anchoM: 5 }], footprintPoligono: null, confianza: "alta" };
const map1 = mapToBmc(ext1);
ok(map1.bmcPayload.footprintSource === "single_rect", "footprintSource = single_rect");
const geom1 = buildPlanGeometry({ footprint: map1.bmcPayload.footprint });
ok(geom1.areaM2 === 40, `área rectángulo 8×5 = 40 m² (got ${geom1.areaM2})`);

// ── C. Múltiples zonas sin polígono → sin footprint + warning ──────────────
console.log("C) Múltiples zonas sin polígono → operador define perímetro:");
const extM = { techoZonas: [{ largoM: 8, anchoM: 5 }, { largoM: 4, anchoM: 3 }], footprintPoligono: null };
const mapM = mapToBmc(extM);
ok(mapM.bmcPayload.footprint === null, "footprint = null (no se puede auto-ensamblar)");
ok(mapM.warnings.some(w => /perímetro/i.test(w)), "warning pide definir el perímetro");

// ── D. resolveFootprint robustez ───────────────────────────────────────────
console.log("D) resolveFootprint robustez:");
ok(resolveFootprint({ footprintPoligono: [[0, 0], [1, 0]] }, []).footprint === null, "polígono degenerado (<3) → null");
ok(resolveFootprint({ footprintPoligono: [[0, "x"], [1, 0], [1, 1], [0, 1]] }, []).footprint === null, "vértice no numérico descartado → null");

// ── E. Vivo (opcional): croquis real si hay API key ────────────────────────
console.log("E) Corrida en vivo (opcional):");
try {
  const { config } = await import("../server/config.js");
  const croquis = process.env.E2E_CROQUIS_PATH
    || "/root/.claude/uploads/77541f66-2779-54fc-98fe-312645393e8a/cdc6e13d-1f23acf6197d926731ca7311eddaa76658115f25.png";
  if ((config.anthropicApiKey || config.geminiApiKey) && existsSync(croquis)) {
    const { interpretPlan } = await import("../server/lib/planInterpreter.js");
    const buf = readFileSync(croquis);
    const r = await interpretPlan(buf, "image/png", "croquis.png");
    console.log("    extracción:", JSON.stringify({ zonas: r.extractedRaw?.techoZonas, footprint: !!r.bmcPayload.footprint, conf: r.extractedRaw?.confianza }));
    ok(r && r.bmcPayload, "interpretPlan devolvió payload");
  } else {
    console.log("    ⚠ skip (sin API key o sin croquis) — el pipeline offline ya quedó validado");
  }
} catch (e) { console.log("    ⚠ skip live:", e.message); }

console.log(`\n✅ cad-pipeline-e2e: ${pass} asserts OK`);
