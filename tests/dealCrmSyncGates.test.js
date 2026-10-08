// Offline. Fake Sheets client, no Google auth. node tests/dealCrmSyncGates.test.js
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import { syncDealToCrm } from "../server/lib/omni/deals/syncCrm.js";

let passed = 0;
async function check(name, fn) {
  const saved = {
    bmcSheetId: config.bmcSheetId,
    wolfbDryRun: config.wolfbDryRun,
    wolfbCrmMainTab: config.wolfbCrmMainTab,
  };
  try {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  } finally {
    config.bmcSheetId = saved.bmcSheetId;
    config.wolfbDryRun = saved.wolfbDryRun;
    config.wolfbCrmMainTab = saved.wolfbCrmMainTab;
  }
}

function fakeSheets(headers, rows, { fail } = {}) {
  const calls = [];
  return {
    calls,
    spreadsheets: {
      values: {
        async get(args) {
          calls.push({ op: "get", range: args.range, spreadsheetId: args.spreadsheetId });
          if (fail === "get") throw new Error("sheets down");
          if (String(args.range).includes("!A3:ZZ3")) return { data: { values: [headers] } };
          return { data: { values: rows } };
        },
        async batchUpdate(args) {
          calls.push({ op: "batch", body: args.requestBody, spreadsheetId: args.spreadsheetId });
          if (fail === "batch") throw new Error("batch down");
          return { data: {} };
        },
      },
    },
  };
}

function deal(overrides = {}) {
  return {
    stage: "proposal",
    value_usd: 10,
    properties: { crm_row_id: "CRM-42" },
    ...overrides,
  };
}

await check("a missing sheet id wins over dry-run", async () => {
  config.bmcSheetId = "";
  config.wolfbDryRun = true;
  const sheets = fakeSheets(["ID"], []);
  const result = await syncDealToCrm(deal(), sheets);
  assert.deepEqual(result, { ok: false, error: "bmc_sheet_id_missing" });
  assert.equal(sheets.calls.length, 0);
});

await check("dry-run does not read or write", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = true;
  const sheets = fakeSheets(["ID"], []);
  const result = await syncDealToCrm(deal(), sheets);
  assert.deepEqual(result, { ok: true, skipped: true, reason: "wolfb_dry_run" });
  assert.equal(sheets.calls.length, 0);
});

await check("a numeric zero row id falls through to crm_id", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = false;
  const unlinked = await syncDealToCrm(deal({ properties: { crm_row_id: 0, crm_id: 0 } }), fakeSheets(["ID"], []));
  assert.deepEqual(unlinked, { ok: true, skipped: true, reason: "no_crm_row_linked" });

  const zeroAlias = fakeSheets(["ID", "Estado", "Monto estimado USD"], [["CRM-9", "Nuevo", ""]]);
  const through = await syncDealToCrm(deal({ properties: { crm_row_id: 0, crm_id: "CRM-9" } }), zeroAlias);
  assert.equal(through.ok, true);
  assert.equal(through.crm_row_id, "CRM-9");

  const sheets = fakeSheets(
    ["Fecha", "ID", "Estado", "Monto estimado USD"],
    [["x", "CRM-9", "Nuevo", ""]],
  );
  const viaAlias = await syncDealToCrm(deal({ properties: { crm_row_id: "", crm_id: "CRM-9" } }), sheets);
  assert.equal(viaAlias.ok, true);
  assert.equal(viaAlias.crm_row_id, "CRM-9");
  assert.equal(sheets.calls.filter((call) => call.op === "batch").length, 1);
});

await check("the ID header is exact and the first matching data row wins", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = false;
  config.wolfbCrmMainTab = "CRM Custom";
  const missing = fakeSheets(["Id", "Estado"], [["CRM-42", "Nuevo"]]);
  const noId = await syncDealToCrm(deal(), missing);
  assert.deepEqual(noId, { ok: false, error: "crm_id_column_missing" });
  assert.equal(missing.calls.length, 1);
  assert.equal(missing.calls[0].range, "'CRM Custom'!A3:ZZ3");

  const sheets = fakeSheets(
    ["Fecha", "ID", "Estado", "Monto estimado USD"],
    [
      ["a", "CRM-42 ", "Nuevo", "1"],
      ["b", "CRM-42", "Viejo", "2"],
      ["c", "CRM-42", "Otro", "3"],
    ],
  );
  const spaced = await syncDealToCrm(deal({ properties: { crm_row_id: "CRM-42" } }), fakeSheets(
    ["ID"],
    [["CRM-42 "]],
  ));
  assert.deepEqual(spaced, { ok: false, error: "crm_row_not_found", crm_row_id: "CRM-42" });

  const hit = await syncDealToCrm(deal({ value_usd: 0, stage: "closed_won" }), sheets);
  assert.equal(hit.ok, true);
  assert.equal(hit.synced_fields, 2);
  const batch = sheets.calls.find((call) => call.op === "batch");
  assert.equal(batch.body.valueInputOption, "USER_ENTERED");
  assert.equal(batch.spreadsheetId, "sheet-1");
  assert.deepEqual(batch.body.data, [
    { range: "'CRM Custom'!C5", values: [["Cerrado ganado"]] },
    { range: "'CRM Custom'!D5", values: [[0]] },
  ]);
});

await check("a null amount skips monto, and no mapped columns skip the write", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = false;
  const sheets = fakeSheets(
    ["ID", "Monto estimado USD"],
    [["CRM-42", ""]],
  );
  const amountOnly = await syncDealToCrm(deal({ value_usd: null, stage: "nope" }), sheets);
  assert.deepEqual(amountOnly, { ok: true, skipped: true, reason: "no_fields_to_sync" });
  assert.equal(sheets.calls.some((call) => call.op === "batch"), false);

  const zeroSheets = fakeSheets(["ID", "Monto estimado USD"], [["42", ""]]);
  const zero = await syncDealToCrm(deal({
    value_usd: 0,
    properties: { crm_row_id: 42 },
  }), zeroSheets);
  assert.equal(zero.synced_fields, 1);
  const batch = zeroSheets.calls.find((call) => call.op === "batch");
  assert.deepEqual(batch.body.data, [
    { range: "'CRM_Operativo'!B4", values: [[0]] },
  ]);
});

await check("column 27 is AA and a formula amount is written as entered", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = false;
  const headers = ["ID", ...Array.from({ length: 25 }, (_, i) => `c${i}`), "Monto estimado USD"];
  assert.equal(headers.length, 27);
  const sheets = fakeSheets(headers, [["CRM-42"]]);
  const result = await syncDealToCrm(deal({ value_usd: "=1+1", stage: "lead" }), sheets);
  assert.equal(result.ok, true);
  const batch = sheets.calls.find((call) => call.op === "batch");
  assert.deepEqual(batch.body.data, [
    { range: "'CRM_Operativo'!AA4", values: [["=1+1"]] },
  ]);
  assert.equal(batch.body.valueInputOption, "USER_ENTERED");
});

await check("a sheets failure returns the message and does not throw", async () => {
  config.bmcSheetId = "sheet-1";
  config.wolfbDryRun = false;
  const sheets = fakeSheets(["ID"], [], { fail: "get" });
  const result = await syncDealToCrm(deal(), sheets);
  assert.deepEqual(result, { ok: false, error: "sheets down" });
});

console.log(`dealCrmSyncGates: ${passed} passed`);
