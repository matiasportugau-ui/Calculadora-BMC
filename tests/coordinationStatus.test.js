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
  // Negated shipment must not show green Enviado (Ops UX F2 regression).
  for (const estadoText of ["NO ENVIADO", "No enviada todavía", "no enviado", "sin enviar"]) {
    const c = classifyVentasCoordination({ estadoText });
    assert.equal(
      c.status,
      "por_coordinar",
      `"${estadoText}" must not classify as enviado (got ${c.status})`,
    );
  }
  ok("negated enviado → por_coordinar");
}

{
  const c = classifyVentasCoordination({
    estadoText: "NO ENVIADO",
    fechaEntrega: "2026-08-20",
  });
  assert.equal(c.status, "coordinado");
  assert.equal(c.batchKey, "2026-08-20");
  ok("NO ENVIADO + fecha G → coordinado (not enviado)");
}

{
  const a = batchColorFromKey("2026-08-12");
  const b = batchColorFromKey("2026-08-12");
  const c = batchColorFromKey("2026-09-01");
  assert.equal(a, b);
  assert.notEqual(a, c);
  ok("batch color stable per date");
}

console.log(`\n${passed} assertions ok`);
