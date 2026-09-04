/**
 * Reparto batch FSM: confirm is one-shot, terminals stay closed, no skip-states.
 * Complementary to orphan tests/repartoStatus.test.js (wired only on #1082).
 * Run: node tests/repartoFsmGate.test.js
 */
import assert from "node:assert/strict";
import {
  normalizeRepartoStatus,
  canTransitionReparto,
  applyRepartoTransition,
  canConfirmReparto,
  statusOnFirstStop,
  stopSummariesForReparto,
} from "../src/utils/logistica/repartoStatus.js";

console.log("repartoFsmGate");

{
  assert.equal(normalizeRepartoStatus("en_coordinacion"), "en_coordinacion");
  assert.equal(normalizeRepartoStatus("encoordinacion"), "en_coordinacion");
  assert.equal(normalizeRepartoStatus("en coordinacion"), "en_coordinacion");
  assert.equal(normalizeRepartoStatus("DRAFT"), "draft");
  assert.equal(normalizeRepartoStatus(""), "draft");
  assert.equal(normalizeRepartoStatus("nope"), "draft");
  console.log("  ✓ normalize aliases + unknown → draft");
}

{
  assert.equal(canTransitionReparto("draft", "en_coordinacion"), true);
  assert.equal(canTransitionReparto("draft", "coordinado"), false, "cannot skip to coordinado");
  assert.equal(canTransitionReparto("en_coordinacion", "coordinado"), true);
  assert.equal(canTransitionReparto("coordinado", "en_coordinacion"), false);
  assert.equal(canTransitionReparto("en_curso", "cerrado"), true);
  assert.equal(canTransitionReparto("en_curso", "coordinado"), false);
  assert.equal(applyRepartoTransition("cerrado", "en_curso").ok, false);
  assert.equal(applyRepartoTransition("cancelado", "draft").ok, false);
  assert.equal(applyRepartoTransition("cerrado", "cerrado").ok, true);
  console.log("  ✓ no skip-state; cerrado/cancelado are terminal");
}

{
  assert.equal(canConfirmReparto("en_coordinacion"), true);
  assert.equal(canConfirmReparto("encoordinacion"), true);
  assert.equal(canConfirmReparto("draft"), false);
  assert.equal(canConfirmReparto("coordinado"), false, "re-confirm blocked (immutable snapshot)");
  assert.equal(canConfirmReparto("en_curso"), false);
  assert.equal(canConfirmReparto("cerrado"), false);
  assert.equal(applyRepartoTransition("coordinado", "coordinado").ok, true);
  console.log("  ✓ confirm only from En Coordinación");
}

{
  assert.equal(statusOnFirstStop("draft"), "en_coordinacion");
  assert.equal(statusOnFirstStop("en_coordinacion"), "en_coordinacion");
  assert.equal(statusOnFirstStop("coordinado"), "coordinado");
  assert.equal(statusOnFirstStop("cerrado"), "cerrado");
  console.log("  ✓ first stop does not reopen a confirmed/closed batch");
}

{
  const rows = stopSummariesForReparto([
    {
      id: "s1",
      orden: 2,
      cliente: "  Obra Sur  ",
      orderId: "1342836",
      phone: "+59899123456",
      token: "driver-secret",
      chofer_phone: "099162401",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cliente, "Obra Sur");
  assert.equal(rows[0].orderId, "1342836");
  const blob = JSON.stringify(rows);
  assert.equal(blob.includes("99123456"), false);
  assert.equal(blob.includes("driver-secret"), false);
  assert.equal(blob.includes("099162401"), false);
  assert.equal("phone" in rows[0], false);
  assert.equal("token" in rows[0], false);
  console.log("  ✓ stop summaries drop phone/token");
}

console.log("repartoFsmGate OK");
