import assert from "node:assert/strict";
import {
  findNextWorkingSetRow,
  evaluateStorefrontConsulta,
  isStubStorefrontConsulta,
  STOREFRONT_STUB_CONSULTA,
  detectAdminRowLayout,
  mapAdminRowCanonical,
  buildCanonicalAdminUpdates,
  formatAdminFecha,
} from "../server/lib/adminLeadLayout.js";

function occupiedRow() {
  const r = Array(13).fill("");
  r[2] = "Pendiente";
  r[3] = "08-10";
  r[4] = "Ana";
  r[5] = "WA";
  r[6] = "099111222";
  r[8] = "techo isodec 100";
  return r;
}

function vwDumpRow() {
  const r = Array(13).fill("");
  r[0] = "MAN-1";
  r[1] = "08/10/2026";
  r[3] = "59899111222";
  r[4] = "Bot";
  r[5] = "VW";
  r[8] = STOREFRONT_STUB_CONSULTA;
  r[11] = "Pendiente";
  return r;
}

const working = Array.from({ length: 79 }, occupiedRow);
const gap = Array.from({ length: 3632 }, () => []);
const dump = Array.from({ length: 76 }, vwDumpRow);
const grid = [...working, ...gap, ...dump];
assert.equal(findNextWorkingSetRow(grid), 81, "insert after row 80, skip 3713 dump");

assert.equal(findNextWorkingSetRow([]), 2);
assert.equal(findNextWorkingSetRow(Array.from({ length: 10 }, occupiedRow)), 12);

// Saturated working set (rows 2–200 inclusive) must NOT return an occupied row.
const fullSet = Array.from({ length: 199 }, occupiedRow);
assert.equal(findNextWorkingSetRow(fullSet), null, "full A2:M200 → null, never overwrite");

// Row 200 empty, 2–199 full → claim 200.
const almostFull = Array.from({ length: 198 }, occupiedRow);
almostFull.push([]);
assert.equal(findNextWorkingSetRow(almostFull), 200, "last empty slot in working set");

assert.equal(isStubStorefrontConsulta(STOREFRONT_STUB_CONSULTA), true);
assert.equal(isStubStorefrontConsulta("IsoDec 100 12x4 gris"), false);

const stub = evaluateStorefrontConsulta({ consulta: STOREFRONT_STUB_CONSULTA });
assert.equal(stub.stub, true);
assert.equal(stub.estado, "Falta info");
assert.equal(stub.quotable, false);

const ready = evaluateStorefrontConsulta({
  consulta: "techo IsoDec 100 mm 12x3.95 gris pizarra",
  zona: "Maldonado",
  cliente: "Gonzalo",
});
assert.equal(ready.stub, false);
assert.equal(ready.quotable, true);
assert.equal(ready.family, "IsoDec");
assert.equal(ready.espesor, 100);
assert.match(ready.interpretacion, /lista=web/);
assert.equal(ready.estado, "Cotizable");

assert.equal(detectAdminRowLayout(occupiedRow()), "canonical");
assert.equal(detectAdminRowLayout(vwDumpRow()), "legacy");

const mapped = mapAdminRowCanonical(occupiedRow(), 0, "sheet");
assert.equal(mapped.estado, "Pendiente");
assert.equal(mapped.telefono, "099111222");
assert.equal(mapped.consulta, "techo isodec 100");

const updates = buildCanonicalAdminUpdates("Admin.", 81, {
  estado: "Falta info",
  origen: "VW",
  consulta: STOREFRONT_STUB_CONSULTA,
});
assert.ok(updates.some((u) => u.range === "'Admin.'!C81"));
assert.ok(updates.some((u) => u.range === "'Admin.'!F81"));
assert.ok(updates.some((u) => u.range === "'Admin.'!I81"));
assert.ok(!updates.some((u) => u.range.includes("!D81")), "omit empty optional fields");

assert.match(formatAdminFecha(new Date("2026-10-08T12:00:00-03:00")), /^\d{2}-\d{2}$/);

console.log("adminLeadLayout.test.js ok");
