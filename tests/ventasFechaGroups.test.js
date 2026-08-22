/**
 * Ventas grouped by fecha de reparo (established delivery date).
 * Run: node tests/ventasFechaGroups.test.js
 */
import assert from "node:assert/strict";
import {
  SIN_FECHA_KEY,
  localDateIso,
  rowFechaRepartoIso,
  sortVentasRowsChronological,
  formatFechaRepartoLabel,
  groupVentasRowsByFechaReparto,
  countFechaGroupBuckets,
  fechaGroupJumpTargets,
} from "../src/utils/logistica/ventasFechaGroups.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("ventasFechaGroups");

const NOW = new Date("2026-08-20T15:00:00-03:00");

assert.equal(localDateIso(NOW), "2026-08-20");
ok("localDateIso uses local calendar");

{
  assert.equal(rowFechaRepartoIso({ fechaEntrega: "2026-08-22" }), "2026-08-22");
  assert.equal(rowFechaRepartoIso({ fechaEntrega: "22/08/2026" }), "2026-08-22");
  assert.equal(
    rowFechaRepartoIso({ fechaEntrega: "", coordination: { coordDateIso: "2026-08-18" } }),
    "2026-08-18",
  );
  assert.equal(rowFechaRepartoIso({ fechaEntrega: "Coordinar" }), "");
  ok("rowFechaRepartoIso ISO / planilla / coord fallback");
}

assert.equal(formatFechaRepartoLabel("2026-08-20", NOW), "Hoy · 20/08");
assert.equal(formatFechaRepartoLabel("2026-08-19", NOW), "Ayer · 19/08");
assert.equal(formatFechaRepartoLabel("2026-08-21", NOW), "Mañana · 21/08");
assert.match(formatFechaRepartoLabel("2026-08-25", NOW), /25\/08/);
assert.equal(formatFechaRepartoLabel("", NOW), "Sin fecha de entrega");
ok("formatFechaRepartoLabel Hoy/Ayer/Mañana/undated");

{
  const rows = [
    { nombre: "Zed", orderId: "9", fechaEntrega: "", ventasSheetRow1Based: 40 },
    { nombre: "Hoy B", orderId: "2", fechaEntrega: "2026-08-20", ventasSheetRow1Based: 12 },
    { nombre: "Hoy A", orderId: "1", fechaEntrega: "2026-08-20", ventasSheetRow1Based: 8 },
    { nombre: "Late", orderId: "3", fechaEntrega: "2026-08-25", ventasSheetRow1Based: 20 },
    { nombre: "Overdue", orderId: "0", fechaEntrega: "2026-08-18", ventasSheetRow1Based: 5 },
  ];
  const sorted = sortVentasRowsChronological(rows);
  assert.deepEqual(
    sorted.map((r) => r.nombre),
    ["Overdue", "Hoy A", "Hoy B", "Late", "Zed"],
  );
  ok("sort: dated ISO asc, same-day sheet row, undated last");
}

{
  const rows = [
    { nombre: "Late", fechaEntrega: "2026-08-25", ventasSheetRow1Based: 3 },
    { nombre: "No date", fechaEntrega: "", ventasSheetRow1Based: 9 },
    { nombre: "Today 2", fechaEntrega: "20/08/2026", ventasSheetRow1Based: 7 },
    { nombre: "Over", fechaEntrega: "2026-08-18", ventasSheetRow1Based: 2 },
    { nombre: "Today 1", fechaEntrega: "2026-08-20", ventasSheetRow1Based: 4 },
  ];
  const groups = groupVentasRowsByFechaReparto(rows, { now: NOW });
  assert.equal(groups.length, 4);
  assert.equal(groups[0].iso, "2026-08-18");
  assert.equal(groups[0].overdue, true);
  assert.equal(groups[0].count, 1);
  assert.equal(groups[1].iso, "2026-08-20");
  assert.equal(groups[1].today, true);
  assert.equal(groups[1].count, 2);
  assert.deepEqual(
    groups[1].rows.map((r) => r.nombre),
    ["Today 1", "Today 2"],
  );
  assert.equal(groups[2].iso, "2026-08-25");
  assert.equal(groups[2].overdue, false);
  assert.equal(groups[2].today, false);
  assert.equal(groups[3].key, SIN_FECHA_KEY);
  assert.equal(groups[3].iso, "");
  assert.equal(groups[3].label, "Sin fecha de entrega");

  const buckets = countFechaGroupBuckets(groups);
  assert.deepEqual(buckets, { overdue: 1, today: 2, upcoming: 1, undated: 1 });

  const jumps = fechaGroupJumpTargets(groups);
  assert.equal(jumps.overdue, "2026-08-18");
  assert.equal(jumps.today, "2026-08-20");
  assert.equal(jumps.upcoming, "2026-08-25");
  assert.equal(jumps.undated, SIN_FECHA_KEY);
  ok("group chronological with overdue/today flags + jump keys");
}

{
  const groups = groupVentasRowsByFechaReparto([], { now: NOW });
  assert.deepEqual(groups, []);
  assert.deepEqual(countFechaGroupBuckets(groups), { overdue: 0, today: 0, upcoming: 0, undated: 0 });
  ok("empty list → empty groups");
}

console.log(`\nventasFechaGroups: ${passed} passed`);
