/**
 * Concurrent Entregado delete guard — drives shipped saleState + asserts
 * production wire in server/routes/bmcDashboard.js.
 * Run: node tests/enviosEntregadoConcurrentDelete.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ventasRowIdentityFingerprint,
  findSheetRow1BasedByFingerprint,
  isTerminalSaleStatus,
} from "../src/utils/logistica/saleState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashPath = join(__dirname, "../server/routes/bmcDashboard.js");
const dash = readFileSync(dashPath, "utf8");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("enviosEntregadoConcurrentDelete");

// --- Production path must exist and use fingerprint relocate before delete ---
{
  assert.match(dash, /router\.post\(\s*"\/ventas\/logistica-entregado"/);
  assert.match(dash, /async function handleVentasLogisticaEntregado/);
  assert.match(dash, /ventasRowIdentityFingerprint/);
  assert.match(dash, /locateVentasRow1BasedByFingerprint/);
  assert.match(dash, /findSheetRow1BasedByFingerprint/);
  // Must NOT delete with original row1Based after append (the bug)
  assert.ok(
    !/deleteDimension:[\s\S]{0,200}startIndex:\s*row1Based\s*-\s*1/.test(dash),
    "must not deleteDimension using original row1Based",
  );
  assert.match(dash, /startIndex:\s*deleteRow1\s*-\s*1/);
  // Archive resolved before mutate
  assert.match(dash, /resolveVentasArchiveTabTitle/);
  // Terminal status blocked on plain estado
  assert.match(dash, /isTerminalSaleStatus/);
  ok("bmcDashboard wires concurrent-delete guard on logistica-entregado");
}

// --- Bug AW: never write client estadoText LOGISTICA markers verbatim ---
{
  assert.ok(
    !/body\?\.estadoText\s*!=\s*null\s*&&\s*String\(body\.estadoText\)\.includes\(\s*"\[LOGISTICA:"\s*\)/.test(
      dash,
    ),
    "must not passthrough client estadoText when it contains [LOGISTICA:",
  );
  assert.ok(
    !/\?\s*String\(body\.estadoText\)\s*:\s*buildEstadoSheetValue/.test(dash),
    "must not ternary-choose client estadoText over buildEstadoSheetValue",
  );
  assert.match(dash, /const estadoVal\s*=\s*buildEstadoSheetValue\s*\(/);
  ok("estadoText LOGISTICA markers are server-built only (Bug AW)");
}

// --- Bug AX: fingerprint relocate BEFORE terminal estado write ---
{
  const entregadoFn = dash.match(
    /async function handleVentasLogisticaEntregado[\s\S]*?^async function /m,
  );
  const body = entregadoFn ? entregadoFn[0] : dash;
  const locateIdx = body.search(/locateVentasRow1BasedByFingerprint/);
  const estadoIdx = body.search(/handleVentasLogisticaEstado\s*\(/);
  assert.ok(locateIdx >= 0 && estadoIdx >= 0, "entregado must call locate + estado");
  assert.ok(
    locateIdx < estadoIdx,
    "must relocate by fingerprint before writing terminal estado (Bug AX)",
  );
  assert.match(
    body,
    /handleVentasLogisticaEstado\([\s\S]*?row1Based:\s*writeRow1/,
    "estado write must use relocated writeRow1",
  );
  ok("terminal estado write uses pre-relocate writeRow1 (Bug AX)");
}

// --- Same algorithm the server calls after re-reading sheet values ---
{
  function row({ orderId, nombre, tel, dir, estado = "" }) {
    const cells = Array(20).fill("");
    cells[2] = orderId;
    cells[8] = nombre;
    cells[9] = dir;
    cells[15] = tel;
    cells[5] = estado;
    return cells;
  }
  const target = row({
    orderId: "VENT-9001",
    nombre: "Cliente Target",
    tel: "099000111",
    dir: "Ruta 8 km 20",
    estado: "[LOGISTICA:ENTREGADO]",
  });
  const fp = ventasRowIdentityFingerprint(target);
  // After concurrent delete of row above, sheet is shorter; stale client still holds row 6
  const dataRowsAfterShift = [
    row({ orderId: "1", nombre: "A", tel: "1", dir: "a" }), // sheet 2
    row({ orderId: "2", nombre: "B", tel: "2", dir: "b" }), // sheet 3
    target, // sheet 4 — correct
    row({ orderId: "OTHER", nombre: "Wrong", tel: "9", dir: "z" }), // sheet 5 — would die if delete by stale 5
  ];
  const staleClientRow = 5; // points at Wrong after shift
  const deleteRow1 = findSheetRow1BasedByFingerprint(dataRowsAfterShift, fp, staleClientRow);
  assert.equal(deleteRow1, 4, "must relocate to true row, not stale hint");
  assert.notEqual(deleteRow1, staleClientRow);
  assert.equal(
    ventasRowIdentityFingerprint(dataRowsAfterShift[deleteRow1 - 2]),
    fp,
  );
  // Deleting staleClientRow would erase Wrong — prove mismatch
  assert.notEqual(
    ventasRowIdentityFingerprint(dataRowsAfterShift[staleClientRow - 2]),
    fp,
  );
  ok("fingerprint relocate prevents wrong-row delete after concurrent shift");
}

{
  assert.equal(isTerminalSaleStatus("entregado"), true);
  assert.equal(isTerminalSaleStatus("coordinado"), false);
  ok("terminal statuses force archive path");
}

console.log(`enviosEntregadoConcurrentDelete: ${passed} passed`);
