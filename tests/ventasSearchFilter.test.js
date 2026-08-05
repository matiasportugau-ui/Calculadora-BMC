/**
 * Ops UX F2 — haystack search (not r[7]-only)
 * Run: node tests/ventasSearchFilter.test.js
 */
import assert from "node:assert/strict";
import {
  mappedRowMatchesQuery,
  filterMappedVentasRows,
  searchMappedVentasRows,
  mappedRowSearchHaystack,
} from "../src/utils/logistica/ventasSearch.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("ventasSearchFilter");

const acme = {
  nombre: "Acme Paneles SA",
  orderId: "BMC-123",
  cotizacionId: "",
  pickupId: "R-9",
  dir: "Maldonado",
  tel: "099111222",
  estadoText: "Pendiente",
  fechaEntrega: "2026-08-12",
  rawSheetText: "Acme / BMC-123",
};

const other = {
  nombre: "Otro Cliente",
  orderId: "ZZ-1",
  dir: "Salto",
  tel: "",
  estadoText: "",
  fechaEntrega: "",
  rawSheetText: "",
};

assert.equal(mappedRowMatchesQuery(acme, "BMC-123"), true);
ok("match by orderId (not only nombre)");

assert.equal(mappedRowMatchesQuery(acme, "099111"), true);
ok("match by phone fragment");

assert.equal(mappedRowMatchesQuery(acme, "maldonado"), true);
ok("match by address");

assert.equal(mappedRowMatchesQuery(acme, "noexiste"), false);
ok("non-match");

{
  const found = filterMappedVentasRows([acme, other], "BMC-123");
  assert.equal(found.length, 1);
  assert.equal(found[0].nombre, "Acme Paneles SA");
  ok("filterMappedVentasRows");
}

{
  const found = searchMappedVentasRows([acme, other], "acme");
  assert.equal(found.length, 1);
  assert.equal(found[0].coordination.status, "coordinado");
  assert.ok(found[0].coordinationColor);
  assert.ok(String(found[0].coordinationCaption).includes("Coordinado"));
  ok("searchMappedVentasRows attaches chip");
}

assert.ok(mappedRowSearchHaystack(acme).includes("bmc-123"));
ok("haystack includes order id");

console.log(`\n${passed} assertions ok`);
