// Offline. No sheet, no network. node tests/crmClientSearchGates.test.js
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import { matchCrmClientRows, searchCrmClients } from "../server/lib/crmSearch.js";

function crmRow(fields = {}) {
  const row = [];
  const put = (index, value) => {
    if (value !== undefined) row[index] = value;
  };
  put(0, fields.timestamp);
  put(1, fields.cliente);
  put(2, fields.telefono);
  put(3, fields.ubicacion);
  put(21, fields.observaciones);
  put(32, fields.link);
  put(36, fields.tipo);
  put(37, fields.tags);
  return row;
}

const ana = crmRow({
  timestamp: " 2026-10-01 ",
  cliente: "Ana Pérez",
  telefono: "598 99 111 222",
  ubicacion: "Montevideo",
  observaciones: "obra norte",
  link: "https://drive.example/ana",
  tipo: "Proveedor",
  tags: "obra, madera",
});

{
  const hit = matchCrmClientRows([ana], "  ANA  ");
  assert.equal(hit.count, 1);
  assert.deepEqual(hit.matches[0], {
    row: 4, cliente: "Ana Pérez", telefono: "598 99 111 222", ubicacion: "Montevideo",
    link_presupuesto: "https://drive.example/ana", observaciones: "obra norte",
    tipo_contacto: "Proveedor", tags_taxonomia: "obra, madera", timestamp: "2026-10-01",
    match_via: "cliente",
  });
}

assert.equal(matchCrmClientRows([ana], "   ").ok, false);
assert.match(matchCrmClientRows([ana], "").error, /query requerido/);

{
  const phone = matchCrmClientRows([ana], "991112");
  assert.equal(phone.count, 1);
  assert.equal(phone.matches[0].match_via, "telefono");
}

assert.equal(matchCrmClientRows([ana], "12345").count, 0);

{
  const twelve = crmRow({ cliente: "Ana", telefono: "598991112223" });
  assert.equal(matchCrmClientRows([twelve], "598991112223").count, 0);
}

{
  const both = crmRow({
    cliente: "Cliente 59899111222",
    telefono: "59899111222",
    observaciones: "pedido 59899111222",
  });
  assert.equal(matchCrmClientRows([both], "59899111222").matches[0].match_via, "telefono");
}

{
  const named = crmRow({
    cliente: "ACME SRL — RUT 2.171.236-2/0016",
    telefono: "217123620016",
    observaciones: "sin rut en notas",
  });
  const hit = matchCrmClientRows([named], "217123620016");
  assert.equal(hit.count, 1);
  assert.equal(hit.matches[0].match_via, "rut");
  const formatted = matchCrmClientRows([named], "2.171.236-2/0016");
  assert.equal(formatted.matches[0].match_via, "rut");
}

{
  const obsOnly = crmRow({
    cliente: "Bob",
    telefono: "099111222",
    observaciones: `${"x".repeat(210)}puerta`,
  });
  const hit = matchCrmClientRows([obsOnly], "puerta");
  assert.equal(hit.matches[0].match_via, "observaciones");
  assert.equal(hit.matches[0].observaciones.length, 200);
  assert.equal(hit.matches[0].observaciones.includes("puerta"), false);
}

{
  const bare = crmRow({ cliente: "Bob" });
  const hit = matchCrmClientRows([bare], "bob");
  assert.equal(hit.matches[0].link_presupuesto, null);
  assert.equal(hit.matches[0].observaciones, null);
  assert.equal(hit.matches[0].tipo_contacto, null);
  assert.equal(hit.matches[0].tags_taxonomia, null);
  assert.equal(hit.matches[0].timestamp, null);
}

{
  const rows = [
    [],
    null,
    crmRow({ cliente: "", telefono: "59899111222" }),
    crmRow({ cliente: "Visible", telefono: "091000000" }),
  ];
  const hit = matchCrmClientRows(rows, "visible");
  assert.equal(hit.count, 1);
  assert.equal(hit.matches[0].row, 7);
  assert.equal(matchCrmClientRows(rows, "59899111222").count, 0);
}

{
  const rows = Array.from({ length: 11 }, (_, i) => crmRow({ cliente: `Cliente ${i}` }));
  assert.equal(matchCrmClientRows(rows, "cliente", 0).count, 10);
  assert.equal(matchCrmClientRows(rows, "cliente", 11).count, 11);
  assert.equal(matchCrmClientRows(rows, "cliente", 100).count, 11);
  assert.equal(matchCrmClientRows(rows, "cliente", -3).count, 1);
  assert.equal(matchCrmClientRows(rows, "cliente", "abc").count, 0);
  assert.equal(matchCrmClientRows(rows, "cliente", 1.9).count, 2);
  assert.equal(matchCrmClientRows(rows, "cliente", 1.9).matches[1].cliente, "Cliente 1");
}

{
  const many = Array.from({ length: 51 }, (_, i) => crmRow({ cliente: `P${i}` }));
  const capped = matchCrmClientRows(many, "p", 80);
  assert.equal(capped.count, 50);
  assert.equal(capped.matches[49].cliente, "P49");
}

const prevSheet = config.bmcSheetId;
try {
  config.bmcSheetId = "";
  const missing = await searchCrmClients({ query: "Ana" });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /BMC_SHEET_ID/);

  config.bmcSheetId = "sheet-1";
  let gets = 0;
  const blank = await searchCrmClients({
    query: "   ",
    sheets: {
      spreadsheets: {
        values: {
          async get() {
            gets += 1;
            throw new Error("sheets_called");
          },
        },
      },
    },
  });
  assert.equal(blank.ok, false);
  assert.match(blank.error, /query requerido/);
  assert.equal(gets, 0);

  const calls = [];
  const found = await searchCrmClients({
    query: "ana",
    limite: 1.9,
    sheets: {
      spreadsheets: {
        values: {
          async get(args) {
            calls.push(args);
            return { data: { values: [ana, crmRow({ cliente: "Ana Dos" }), crmRow({ cliente: "Otra" })] } };
          },
        },
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].spreadsheetId, "sheet-1");
  assert.equal(calls[0].range, "'CRM_Operativo'!B4:AN");
  assert.equal(found.ok, true);
  assert.equal(found.sheetId, "sheet-1");
  assert.equal(found.count, 2);
  assert.equal(found.matches[1].cliente, "Ana Dos");

  const emptyBody = await searchCrmClients({
    query: "ana",
    sheets: { spreadsheets: { values: { async get() { return { data: {} }; } } } },
  });
  assert.deepEqual(emptyBody, { ok: true, count: 0, matches: [], sheetId: "sheet-1" });

  const broken = await searchCrmClients({
    query: "ana",
    sheets: { spreadsheets: { values: { async get() { throw new Error("sheets_unavailable"); } } } },
  });
  assert.deepEqual(broken, { ok: false, error: "sheets_unavailable" });
} finally {
  config.bmcSheetId = prevSheet;
}

console.log("crmClientSearchGates: ok");
