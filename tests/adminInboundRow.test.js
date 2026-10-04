// Offline. No sheet, no network. node tests/adminInboundRow.test.js
import assert from "node:assert/strict";
import { appendAdminInboundRow, buildInboundConsulta } from "../server/lib/adminInboundRow.js";
import { filterCrmMlRowsCoveredByAdmin } from "../src/utils/crmMlAdminDedup.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ok ${name}`);
    });
}

function fakeSheets(columnC = []) {
  const calls = [];
  return {
    calls,
    spreadsheets: {
      values: {
        async get(args) {
          calls.push({ op: "get", args });
          return { data: { values: columnC.map((id) => [id]) } };
        },
        async append(args) {
          calls.push({ op: "append", args });
          return { data: { updates: { updatedRange: "'Admin.'!A40:M40" } } };
        },
      },
    },
  };
}

const base = {
  enabled: true,
  sheetId: "sheet-1",
  tab: "Admin.",
  now: new Date(2026, 9, 3),
};

await check("flag off does not touch the sheet", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, enabled: false, sheets, channel: "WA", messageId: "m1", text: "hola" });
  assert.deepEqual(result, { ok: true, skipped: "flag_off" });
  assert.equal(sheets.calls.length, 0);
});

await check("a new WhatsApp message appends one Pendiente row", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "WA",
    messageId: "wamid.1",
    telefono: "59899111222",
    cliente: "Ana",
    text: "precio de 50m2",
  });
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, undefined);
  assert.equal(result.id, "WA-wamid.1");
  assert.equal(result.externalId, "WA:wamid.1");
  assert.equal(result.fecha, "03/10/2026");
  assert.equal(result.adminRow, 40);
  const row = sheets.calls.find((c) => c.op === "append").args.requestBody.values[0];
  assert.equal(row[0], "WA-wamid.1");
  assert.equal(row[2], "WA:wamid.1");
  assert.equal(row[3], "59899111222");
  assert.equal(row[4], "Ana");
  assert.equal(row[5], "WhatsApp");
  assert.equal(row[8], "precio de 50m2");
  assert.equal(row[9], "");
  assert.equal(row[11], "Pendiente");
});

await check("the same message id does not append again", async () => {
  const sheets = fakeSheets(["WA:wamid.1"]);
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "WA",
    messageId: "wamid.1",
    text: "precio de 50m2",
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.adminRow, 1);
  assert.equal(sheets.calls.some((c) => c.op === "append"), false);
});

await check("a photo with no caption still creates a row", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, channel: "IG", messageId: "ig1", media: "image" });
  assert.equal(result.ok, true);
  const row = sheets.calls.find((c) => c.op === "append").args.requestBody.values[0];
  assert.equal(row[5], "Instagram");
  assert.equal(row[8], "[imagen]");
});

await check("Mercado Libre consulta keeps the Q trailer", async () => {
  const sheets = fakeSheets();
  const consulta = buildInboundConsulta({
    text: "tienen isodec 50mm?",
    questionId: "13667120509",
    listingId: "MLU757318280",
    listingUrl: "https://articulo.mercadolibre.com.uy/MLU-757318280",
  });
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "ML",
    messageId: "13667120509",
    cliente: "comprador",
    consulta,
  });
  const row = sheets.calls.find((c) => c.op === "append").args.requestBody.values[0];
  assert.equal(result.id, "ML-13667120509");
  assert.match(row[8], /tienen isodec 50mm\? — Q:13667120509 · MLU757318280 · https:\/\/articulo\.mercadolibre\.com\.uy\/MLU-757318280/);
  assert.equal(row[5], "Mercado Libre");
});

await check("an empty message is refused", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, channel: "EM", messageId: "<a@b>", text: "   " });
  assert.deepEqual(result, { ok: false, error: "consulta_required" });
  assert.equal(sheets.calls.length, 0);
});

await check("dry run does not append", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, dryRun: true, channel: "FB", messageId: "fb1", text: "hola" });
  assert.equal(result.dryRun, true);
  assert.equal(result.row[5], "Facebook");
  assert.equal(sheets.calls.some((c) => c.op === "append"), false);
});

await check("a crm-ml card is hidden when the Admin row has that question", () => {
  const adminRows = [{ id: "ML-13667120509", consulta: "tienen — Q:13667120509", source: "admin" }];
  const mlRows = [
    { id: "CRM-9", mlQuestionId: "13667120509", source: "crm-ml" },
    { id: "CRM-10", mlQuestionId: "999999999", source: "crm-ml" },
  ];
  const visible = filterCrmMlRowsCoveredByAdmin(adminRows, mlRows);
  assert.deepEqual(visible.map((r) => r.id), ["CRM-10"]);
});

console.log(`\nadminInboundRow: ${passed} passed`);
