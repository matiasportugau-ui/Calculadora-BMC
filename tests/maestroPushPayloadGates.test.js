/**
 * Productos Maestro push shaping — the object the cockpit writes to MATRIZ/Stock.
 * Run: node tests/maestroPushPayloadGates.test.js
 *
 * Pins current preparePushPayload behavior. A zero *object* price is a real
 * change; a numeric 0 is dropped. Spread order lets precio.sku replace the row sku.
 */
import assert from "node:assert/strict";
import { preparePushPayload } from "../server/lib/productosMaestro.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("maestroPushPayloadGates");

{
  const prepared = preparePushPayload(undefined);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.dryRun, true);
  assert.deepEqual(prepared.priceChanges, []);
  assert.deepEqual(prepared.stockChanges, []);
  assert.deepEqual(prepared.summary, { precios: 0, stock: 0 });
  ok("omitted items stay a dry run with empty changes");
}

{
  const prepared = preparePushPayload([], {});
  assert.equal(prepared.dryRun, true);
  const live = preparePushPayload([], { dryRun: false });
  assert.equal(live.dryRun, false);
  assert.equal(live.summary.precios, 0);
  ok("dryRun defaults true and false is passed through");
}

{
  const prepared = preparePushPayload([
    {
      sku: "ISO-50",
      nombre: "Ana Pérez",
      telefono: "099111222",
      precio: { venta: 12.5, costo: 8, web: 14 },
      codigo: "STK-1",
      stock: { actual: 3, pedidoPendiente: 1 },
    },
  ]);
  assert.deepEqual(prepared.priceChanges, [{ sku: "ISO-50", venta: 12.5, costo: 8, web: 14 }]);
  assert.deepEqual(prepared.stockChanges, [{ codigo: "STK-1", actual: 3, pedidoPendiente: 1 }]);
  assert.equal("nombre" in prepared.priceChanges[0], false);
  assert.equal("telefono" in prepared.priceChanges[0], false);
  assert.equal("nombre" in prepared.stockChanges[0], false);
  assert.deepEqual(prepared.summary, { precios: 1, stock: 1 });
  ok("price and stock keep only sku/codigo plus their own fields");
}

{
  const prepared = preparePushPayload([
    { precio: { venta: 9 } },
    { sku: "SOLO-SKU" },
    { stock: { actual: 4 } },
    { codigo: "SOLO-COD" },
    { sku: "", precio: { venta: 1 } },
    { codigo: "", stock: { actual: 2 } },
    { sku: "OK", precio: { venta: 3 }, codigo: "C", stock: false },
  ]);
  assert.deepEqual(prepared.priceChanges, [{ sku: "OK", venta: 3 }]);
  assert.deepEqual(prepared.stockChanges, []);
  assert.deepEqual(prepared.summary, { precios: 1, stock: 0 });
  ok("a change without sku or codigo is not a write");
}

{
  const prepared = preparePushPayload([
    { sku: "NUM", precio: 0 },
    { sku: "OBJ", precio: { venta: 0, costo: 0 } },
    { codigo: "NUMS", stock: 0 },
    { codigo: "OBJS", stock: { actual: 0 } },
    { sku: "EMPTY", precio: {} },
  ]);
  assert.equal(prepared.priceChanges.length, 2);
  assert.equal(prepared.priceChanges[0].sku, "OBJ");
  assert.equal(prepared.priceChanges[0].venta, 0);
  assert.equal(prepared.priceChanges[0].costo, 0);
  assert.deepEqual(prepared.priceChanges[1], { sku: "EMPTY" });
  assert.deepEqual(prepared.stockChanges, [{ codigo: "OBJS", actual: 0 }]);
  assert.deepEqual(prepared.summary, { precios: 2, stock: 1 });
  ok("numeric 0 is dropped; venta 0 and an empty price object are kept");
}

{
  const prepared = preparePushPayload([
    { sku: "PANEL-A", precio: { sku: "PANEL-B", venta: 1 } },
    { codigo: "ROW", stock: { codigo: "OTHER", actual: 5 } },
  ]);
  assert.equal(prepared.priceChanges[0].sku, "PANEL-B");
  assert.equal(prepared.priceChanges[0].venta, 1);
  assert.equal(prepared.stockChanges[0].codigo, "OTHER");
  assert.equal(prepared.stockChanges[0].actual, 5);
  ok("spread lets precio.sku and stock.codigo replace the row identity");
}

{
  const prepared = preparePushPayload([
    { sku: "A", precio: { venta: "42,99" } },
    { sku: "A", precio: { venta: 2 } },
  ]);
  assert.equal(prepared.summary.precios, 2);
  assert.equal(prepared.priceChanges[0].venta, "42,99");
  assert.equal(prepared.priceChanges[1].venta, 2);
  ok("comma decimals stay strings and duplicate skus are not collapsed");
}

{
  const prepared = preparePushPayload("nope");
  assert.deepEqual(prepared.priceChanges, []);
  assert.deepEqual(prepared.stockChanges, []);
  ok("a string payload iterates characters and writes nothing");
}

assert.throws(
  () => preparePushPayload([null]),
  TypeError,
);
ok("a null row throws before any write list is returned");

console.log(`maestroPushPayloadGates: ${passed} passed`);
