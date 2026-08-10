/**
 * Ops UX F2 — coordination chips
 * Run: node tests/coordinationStatus.test.js
 */
import assert from "node:assert/strict";
import {
  classifyVentasCoordination,
  batchColorFromKey,
  coordinationChipCaption,
  normalizeSearchText,
} from "../src/utils/logistica/coordinationStatus.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("coordinationStatus");

assert.equal(normalizeSearchText("  José  "), "jose");
ok("normalizeSearchText");

{
  const c = classifyVentasCoordination({
    estadoText: "ENVIADO / ok",
    fechaEntrega: "2026-08-12",
  });
  assert.equal(c.status, "enviado");
  assert.equal(c.label, "Enviado");
  ok("enviado wins over fecha G");
}

{
  const c = classifyVentasCoordination({
    estadoText: "Pendiente retiro",
    fechaEntrega: "2026-08-12",
  });
  assert.equal(c.status, "coordinado");
  assert.equal(c.batchKey, "2026-08-12");
  assert.equal(coordinationChipCaption(c), "Coordinado · 12/08");
  ok("coordinado with date caption");
}

{
  const c = classifyVentasCoordination({ estadoText: "", fechaEntrega: "" });
  assert.equal(c.status, "por_coordinar");
  assert.equal(c.label, "Por coordinar");
  ok("por_coordinar default");
}

{
  const a = batchColorFromKey("2026-08-12");
  const b = batchColorFromKey("2026-08-12");
  const c = batchColorFromKey("2026-09-01");
  assert.equal(a, b);
  assert.notEqual(a, c);
  ok("batch color stable per date");
}

{
  for (const estadoText of ["NO ENVIADO", "No enviada todavía", "no enviado", "sin enviar"]) {
    const c = classifyVentasCoordination({ estadoText, fechaEntrega: "" });
    assert.notEqual(c.status, "enviado", `should not be enviado for: ${estadoText}`);
  }
  ok("negated enviado phrases are not Enviado");
}

{
  const c = classifyVentasCoordination({
    estadoText: "NO ENVIADO",
    fechaEntrega: "2026-08-12",
  });
  assert.equal(c.status, "coordinado");
  ok("NO ENVIADO + fecha G → coordinado (not enviado)");
}

{
  // Planilla often stores DD/MM without year — must still chip Coordinado.
  const c = classifyVentasCoordination({
    estadoText: "Pendiente",
    fechaEntrega: "07/08",
  });
  assert.equal(c.status, "coordinado", "07/08 should be coordinado");
  assert.ok(/^\d{4}-08-07$/.test(c.coordDateIso), `iso got ${c.coordDateIso}`);
  assert.equal(coordinationChipCaption(c), "Coordinado · 07/08");
  ok("dd/mm without year → Coordinado chip");
}

{
  const c = classifyVentasCoordination({
    estadoText: "",
    fechaEntrega: "22/05/2026",
  });
  assert.equal(c.status, "coordinado");
  assert.equal(c.coordDateIso, "2026-05-22");
  assert.equal(coordinationChipCaption(c), "Coordinado · 22/05");
  ok("dd/mm/yyyy → Coordinado");
}

{
  for (const fechaEntrega of ["Falta pagar la seña", "Coordinar", "Stock", "Mayo / Junio", ""]) {
    const c = classifyVentasCoordination({ estadoText: "Pendiente", fechaEntrega });
    assert.equal(c.status, "por_coordinar", `expected por_coordinar for: ${fechaEntrega}`);
  }
  ok("free-text fecha stays por_coordinar");
}

console.log(`\n${passed} assertions ok`);
