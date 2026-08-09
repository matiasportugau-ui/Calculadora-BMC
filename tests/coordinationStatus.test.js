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

console.log(`\n${passed} assertions ok`);
