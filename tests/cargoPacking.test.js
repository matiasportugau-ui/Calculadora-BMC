/**
 * Shared packing SoT tests (U1)
 * Run: node tests/cargoPacking.test.js
 */
import assert from "node:assert/strict";
import {
  placeCargo,
  buildStopPackages,
  STANDARD_BED_M,
  packageHeightM,
} from "../src/utils/logistica/cargoPacking.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("cargoPacking shared SoT");

const stop = {
  id: "s1",
  orden: 1,
  cliente: "Test",
  color: "#0071e3",
  paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 16 }],
};

// Freight column engine: 16 panels → packages fill one fila when height allows (minimize filasUsadas)
{
  const pack = placeCargo([stop], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.layoutEngine, "column");
  assert.ok(pack.placed.length >= 1, "placed packages");
  assert.equal(pack.filasUsadas, 1, `expected 1 fila for 16×100mm ISODEC, got ${pack.filasUsadas}`);
  ok("column engine freight path minimizes filasUsadas");
}

// Leftover after first pack stays on used row A (not load-balance open B)
{
  const panels = [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 12 }];
  const pack = placeCargo([{ id: "s1", orden: 1, paneles: panels }], STANDARD_BED_M, { maxH: 2.4 });
  assert.equal(pack.filasUsadas, 1);
  assert.ok(pack.rowH[0] > 0.001);
  assert.ok(pack.rowH[1] <= 0.001);
  ok("column leftover packs stay on used fila");
}

// Ops stack engine strategies
{
  const b = placeCargo([stop], 8, "balanced");
  const c = placeCargo([stop], 8, "compact");
  const d = placeCargo([stop], 8, "doorPriority");
  assert.equal(b.layoutEngine, "stack");
  assert.equal(b.strategy, "balanced");
  assert.equal(c.strategy, "compact");
  assert.equal(d.strategy, "doorPriority");
  assert.ok(b.placed.length >= 1 && c.placed.length >= 1 && d.placed.length >= 1);
  assert.ok(Array.isArray(b.stacksByRow) && b.stacksByRow.length === 2);
  // Measurable difference: stack assignment / order fingerprint (not full golden tree)
  const fp = (p) => p.placed.map((x) => `${x.stackId}:${x.layerIndex}:${x.n}`).join(";");
  assert.notEqual(fp(b), fp(c), "balanced vs compact placement fingerprint differs");
  assert.notEqual(fp(b), fp(d), "balanced vs doorPriority fingerprint differs");
  ok("stack strategies produce different placement fingerprints");
}

// buildStopPackages shared
{
  const pkgs = buildStopPackages(stop);
  assert.ok(pkgs.length >= 1);
  assert.ok(pkgs.every((p) => p.stableKey));
  ok("buildStopPackages");
}

// Hard rule: never place panel on accessory / profile in stack engine
{
  const stops = [
    {
      id: "s1",
      orden: 1,
      cliente: "A",
      paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 8 }],
      accesorios: [{ id: "a1", descr: "Perfil U / zingueria", cantidad: 10 }],
      accPackage: { enabled: true },
    },
    {
      id: "s2",
      orden: 2,
      cliente: "B",
      paneles: [{ id: "p2", tipo: "ISODEC", espesor: 100, longitud: 5, cantidad: 8 }],
      accesorios: [{ id: "a2", descr: "Cumbrera", cantidad: 4 }],
      accPackage: { enabled: true },
    },
  ];
  for (const strategy of ["balanced", "compact", "doorPriority"]) {
    const pack = placeCargo(stops, 8, strategy);
    assert.equal(pack.layoutEngine, "stack");
    assert.equal(pack.stackConstraintsOk, true, `strategy ${strategy} stackConstraintsOk`);
    assert.equal((pack.stackViolations || []).length, 0, `strategy ${strategy} no violations`);
    // No panel may sit directly above an accessory in the same stack
    const byStack = new Map();
    for (const p of pack.placed) {
      const sid = p.stackId;
      if (!byStack.has(sid)) byStack.set(sid, []);
      byStack.get(sid).push(p);
    }
    for (const [, items] of byStack) {
      const ordered = [...items].sort((a, b) => (a.layerIndex ?? 0) - (b.layerIndex ?? 0));
      for (let i = 1; i < ordered.length; i += 1) {
        const lower = ordered[i - 1];
        const upper = ordered[i];
        const lowerAcc = lower.kind === "accessory";
        const upperPanel = upper.kind === "panel";
        assert.ok(!(lowerAcc && upperPanel), `panel on profile in ${strategy} stack ${lower.stackId}`);
      }
    }
  }
  ok("stack engine never places panel on profile (all strategies)");
}

// Manual order that tries panels after ACC still cannot put panel on ACC
{
  const stops = [
    {
      id: "s1",
      orden: 1,
      cliente: "A",
      paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 4 }],
      accesorios: [{ id: "a1", descr: "Perfil", cantidad: 2 }],
      accPackage: { enabled: true },
    },
  ];
  const pkgs = buildStopPackages(stops[0]);
  const accKey = pkgs.find((p) => p.kind === "accessory")?.stableKey;
  const panelKeys = pkgs.filter((p) => p.kind === "panel").map((p) => p.stableKey);
  assert.ok(accKey && panelKeys.length);
  // Load ACC first, then panels (would trap profile under panels without constraint)
  const pack = placeCargo(stops, 8, "balanced", {
    mode: "manual",
    manualOrderKeys: [accKey, ...panelKeys],
  });
  assert.equal(pack.stackConstraintsOk, true);
  const acc = pack.placed.find((p) => p.stableKey === accKey);
  const panelsOnSameStack = pack.placed.filter(
    (p) => p.kind === "panel" && p.stackId === acc?.stackId && (p.layerIndex ?? 0) > (acc?.layerIndex ?? 0),
  );
  assert.equal(panelsOnSameStack.length, 0, "no panel above ACC after manual ACC-first order");
  ok("manual ACC-first order does not bury profile under panels");
}

// Ops UX F4: sPed + sCli on placed meta
{
  const s = {
    id: "sx",
    orden: 2,
    cliente: "Cliente X",
    orderId: "BMC-99",
    color: "#0071e3",
    paneles: [{ id: "p", tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 4 }],
  };
  const pkgs = buildStopPackages(s);
  assert.equal(pkgs[0].sCli, "Cliente X");
  assert.equal(pkgs[0].sPed, "BMC-99");
  ok("buildPkgs carries sCli and sPed");
}

// F5: forced rowOverrides honored on overflow placement
{
  const s = {
    id: "s1",
    orden: 1,
    cliente: "Force",
    color: "#0071e3",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 12, cantidad: 40 }],
  };
  const pkgs = buildStopPackages(s);
  assert.ok(pkgs.length >= 1);
  const key = pkgs[0].stableKey;
  const pack = placeCargo([s], 8, "balanced", {
    rowOverrides: { [key]: 1 },
    mode: "manual",
    manualOrderKeys: pkgs.map((p) => p.stableKey),
  });
  const first = pack.placed.find((p) => p.stableKey === key) || pack.placed[0];
  assert.equal(first.row, 1, `expected forced fila B, got row=${first.row}`);
  ok("rowOverrides forced fila B honored (incl. overflow path)");
}

// Height helper still SDD-aligned
{
  const h = packageHeightM("ISODEC", 100, 8);
  assert.ok(Math.abs(h - 8 * 0.12) < 0.001);
  ok("packageHeightM ISODEC");
}

// Empty
{
  const pack = placeCargo([], 8, "balanced");
  assert.equal(pack.placed.length, 0);
  assert.equal(pack.cabe, true);
  ok("empty stops");
}

// Álvaro-class 10 × ~10.15 m on 8 m bed cannot cabe (saliente > 2 m)
{
  const alvaro = {
    id: "s-alvaro",
    orden: 1,
    cliente: "Alvaro Gonzalez",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 10.15, cantidad: 10 }],
  };
  const pack8 = placeCargo([alvaro], 8, "balanced");
  assert.equal(pack8.cabe, false, "10.15 m pieces on 8 m bed must not cabe");
  assert.ok(pack8.largoMax >= 10.15 - 0.001);
  const pack13 = placeCargo([alvaro], 13, "balanced");
  assert.equal(pack13.cabe, true, "same load on 13 m bed caben");
  ok("Alvaro 10.15 m needs 13 m bed");
}

// 100 vs 150 same covering L — different pack count / height
{
  const base = {
    id: "s1",
    orden: 1,
    cliente: "Alvaro",
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 100, longitud: 10.15, cantidad: 10 }],
  };
  const thick = {
    ...base,
    paneles: [{ id: "p1", tipo: "ISODEC", espesor: 150, longitud: 10.15, cantidad: 10 }],
  };
  const p100 = buildStopPackages(base).filter((p) => p.kind === "panel");
  const p150 = buildStopPackages(thick).filter((p) => p.kind === "panel");
  assert.equal(p100.reduce((s, p) => s + p.n, 0), 10);
  assert.equal(p150.reduce((s, p) => s + p.n, 0), 10);
  assert.ok(p100.every((p) => p.len === 10.15));
  assert.ok(p150.every((p) => p.len === 10.15));
  assert.notEqual(
    p100.map((p) => `${p.n}:${p.h}`).join(";"),
    p150.map((p) => `${p.n}:${p.h}`).join(";"),
    "100 vs 150 MAX_P / height fingerprint differs",
  );
  ok("100 vs 150 same L, different pack geometry");
}

console.log(`\n${passed} assertions ok`);
