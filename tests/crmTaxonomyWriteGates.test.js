// Offline. No sheet, no network. node tests/crmTaxonomyWriteGates.test.js
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import { planCrmTaxonomyWrite, writeCrmRowTaxonomy } from "../server/lib/crmTaxonomy.js";

const TIPO_ERROR = "tipoContacto inválido: use uno de cliente, proveedor, lead, interno, otro";

for (const row of [0, 3, 3.9, "abc", Number.NaN, ""]) {
  const plan = planCrmTaxonomyWrite(row, { tipoContacto: "cliente" });
  assert.equal(plan.ok, false, `row ${row}`);
  assert.equal(plan.error, "row debe ser >= 4");
}

{
  const plan = planCrmTaxonomyWrite("4", { tipoContacto: "cliente" });
  assert.equal(plan.ok, true);
  assert.equal(plan.row, 4);
  assert.equal(plan.updates[0].range, "'CRM_Operativo'!AL4");
  assert.deepEqual(plan.updates[0].values, [["cliente"]]);
}

{
  const plan = planCrmTaxonomyWrite(4.2, { tags: "obra" });
  assert.equal(plan.updates[0].range, "'CRM_Operativo'!AM4.2");
}

for (const [raw, expected] of [
  ["PROV", "proveedor"],
  [" Supplier ", "proveedor"],
  ["customer", "cliente"],
  ["Proveédor", "proveedor"],
  ["próveedor", "proveedor"],
  ["Interno", "interno"],
  [" otro ", "otro"],
  ["lead", "lead"],
]) {
  const plan = planCrmTaxonomyWrite(4, { tipoContacto: raw });
  assert.equal(plan.ok, true, raw);
  assert.deepEqual(plan.updates[0].values, [[expected]]);
}

for (const raw of ["lead.", "customers", "PROV.", null, ""]) {
  const plan = planCrmTaxonomyWrite(4, { tipoContacto: raw, tags: "obra" });
  assert.equal(plan.ok, false, String(raw));
  assert.equal(plan.error, TIPO_ERROR);
  assert.equal(plan.updates, undefined);
}

{
  const plan = planCrmTaxonomyWrite(8, {
    tags: [" obra ", "", "  ", "madera"],
    notas: "nota",
  });
  assert.equal(plan.written.tipoContacto, false);
  assert.equal(plan.written.tags, true);
  assert.equal(plan.written.notas, true);
  assert.deepEqual(plan.columnLetters, { tipo: "AL", tags: "AM", notas: "AN" });
  assert.equal(plan.updates[0].range, "'CRM_Operativo'!AM8");
  assert.deepEqual(plan.updates[0].values, [["obra, madera"]]);
  assert.equal(plan.updates[1].range, "'CRM_Operativo'!AN8");
  assert.deepEqual(plan.updates[1].values, [["nota"]]);
}

assert.deepEqual(planCrmTaxonomyWrite(4, { tags: null }).updates[0].values, [[""]]);
assert.deepEqual(planCrmTaxonomyWrite(4, { tags: 12 }).updates[0].values, [["12"]]);
assert.deepEqual(planCrmTaxonomyWrite(4, { tags: "=cmd" }).updates[0].values, [["'=cmd"]]);
assert.deepEqual(
  planCrmTaxonomyWrite(4, { tags: " =HYPERLINK(\"x\")" }).updates[0].values,
  [["'=HYPERLINK(\"x\")"]],
);
assert.deepEqual(planCrmTaxonomyWrite(4, { notas: null }).updates[0].values, [[""]]);
assert.deepEqual(planCrmTaxonomyWrite(4, { notas: "   " }).updates[0].values, [[""]]);
assert.deepEqual(planCrmTaxonomyWrite(4, { notas: "\t=cmd" }).updates[0].values, [["'=cmd"]]);

{
  const empty = planCrmTaxonomyWrite(4, {});
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "Nada que escribir — pasá tipoContacto, tags y/o notas");
}

const prevSheet = config.bmcSheetId;
try {
  config.bmcSheetId = "";
  const missing = await writeCrmRowTaxonomy(1, {});
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "BMC_SHEET_ID no configurado");

  config.bmcSheetId = "sheet-tax";
  let writes = 0;
  const blocking = {
    spreadsheets: {
      values: {
        async batchUpdate() {
          writes += 1;
          throw new Error("should_not_write");
        },
      },
    },
  };

  const badRow = await writeCrmRowTaxonomy(3, { tipoContacto: "cliente" }, blocking);
  assert.equal(badRow.error, "row debe ser >= 4");
  const badTipo = await writeCrmRowTaxonomy(4, { tipoContacto: "nope", tags: "obra" }, blocking);
  assert.equal(badTipo.error, TIPO_ERROR);
  assert.equal(writes, 0);

  let sent;
  const saved = await writeCrmRowTaxonomy(9, { tipoContacto: "prov", notas: "=IMPORTXML(\"x\")" }, {
    spreadsheets: {
      values: {
        async batchUpdate(payload) {
          sent = payload;
          writes += 1;
        },
      },
    },
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.row, 9);
  assert.deepEqual(saved.written, { tipoContacto: true, tags: false, notas: true });
  assert.equal(writes, 1);
  assert.equal(sent.spreadsheetId, "sheet-tax");
  assert.equal(sent.requestBody.valueInputOption, "USER_ENTERED");
  assert.deepEqual(sent.requestBody.data, [
    { range: "'CRM_Operativo'!AL9", values: [["proveedor"]] },
    { range: "'CRM_Operativo'!AN9", values: [["'=IMPORTXML(\"x\")"]] },
  ]);

  const failed = await writeCrmRowTaxonomy(4, { tags: "obra" }, {
    spreadsheets: { values: { async batchUpdate() { throw new Error("sheets_unavailable"); } } },
  });
  assert.deepEqual(failed, { ok: false, error: "sheets_unavailable" });
} finally {
  config.bmcSheetId = prevSheet;
}

console.log("crmTaxonomyWriteGates: ok");
