// writeWaCrmIngest — offline, fake Sheets client. Regression guard for the refactor
// (same ranges as legacy) + find-by-phone upsert.
import { writeWaCrmIngest } from "../server/lib/wa/crmIngestWrite.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// Fake Sheets: CRM_Operativo has Ana@598111 in row 4 (idx0) and an empty row 5 (idx1).
function fakeSheets() {
  const updates = [];
  return {
    updates,
    spreadsheets: {
      values: {
        get: async ({ range }) => {
          if (range.includes("Form responses")) return { data: { values: [["x"], ["y"]] } };
          if (range.includes("C4:D500")) return { data: { values: [["Ana", "598111"], ["", ""]] } };
          return { data: { values: [] } };
        },
        update: async (req) => { updates.push(req.range); return {}; },
      },
    },
  };
}

const config = { bmcSheetId: "sheet1", googleApplicationCredentials: "/fake/creds.json" };
const parsed = { cliente: "Ana", telefono: "598111", resumen_pedido: "techo" };

// append mode → first empty CRM row (row 5)
const s1 = fakeSheets();
const r1 = await writeWaCrmIngest({
  parsedData: parsed, chatId: "598111", dialogo: "d", config, logger: null,
  sheets: s1, findRow: "append",
});
assert("append → crmRow 5 (first empty)", r1.crmRow === 5);
assert("append writes CRM B5:K5", s1.updates.some((r) => r.includes("B5:K5")));
assert("writes Form responses A:P", s1.updates.some((r) => r.includes("Form responses 1") && /A\d+:P\d+/.test(r)));
assert("writes CRM R:T", s1.updates.some((r) => /R5:T5/.test(r)));
assert("writes CRM V:W", s1.updates.some((r) => /V5:W5/.test(r)));
assert("writes AH:AK tail", s1.updates.some((r) => /AH5:AK5/.test(r)));

// upsertByPhone mode → reuse Ana's existing row 4
const s2 = fakeSheets();
const r2 = await writeWaCrmIngest({
  parsedData: parsed, chatId: "598111", dialogo: "d", config, logger: null,
  sheets: s2, findRow: "upsertByPhone",
});
assert("upsertByPhone → reuses row 4", r2.crmRow === 4);
assert("upsert writes CRM B4:K4", s2.updates.some((r) => r.includes("B4:K4")));

// upsertByPhone for an unknown phone → first empty row (row 5)
const s3 = fakeSheets();
const r3 = await writeWaCrmIngest({
  parsedData: { cliente: "Beto", telefono: "598999" }, chatId: "598999", dialogo: "d",
  config, logger: null, sheets: s3, findRow: "upsertByPhone",
});
assert("upsertByPhone unknown phone → first empty row 5", r3.crmRow === 5);

// no sheet config → skipped, no writes
const s4 = fakeSheets();
const r4 = await writeWaCrmIngest({
  parsedData: parsed, chatId: "x", dialogo: "d", config: { bmcSheetId: "" }, sheets: s4,
});
assert("no sheet id → skipped", r4.skipped === true && s4.updates.length === 0);

console.log(`\nwaCrmIngestExtract: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
