// writeWaCrmIngest (create-only append) + findCrmRowByPhone — offline, fake Sheets.
// Regression guard for the canonical CRM write: correct ranges AND cell values, and
// the phone-normalized existence lookup that drives insert-once.
import { writeWaCrmIngest, findCrmRowByPhone } from "../server/lib/wa/crmIngestWrite.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// Fake Sheets: Form has 2 filled rows; CRM_Operativo has Ana in row 4, empty row 5.
function fakeSheets(crmCD = [["Ana", "59891234567"], ["", ""]]) {
  const updates = [];
  return {
    updates,
    spreadsheets: {
      values: {
        get: async ({ range }) => {
          if (range.includes("Form responses")) return { data: { values: [["x"], ["y"]] } };
          if (range.includes("C4:D500")) return { data: { values: crmCD } };
          if (range.includes("C4:C500")) return { data: { values: crmCD.map((r) => [r[0]]) } };
          return { data: { values: [] } };
        },
        update: async (req) => { updates.push({ range: req.range, values: req.requestBody?.values?.[0] }); return {}; },
      },
    },
  };
}

const config = { bmcSheetId: "sheet1", googleApplicationCredentials: "/fake/creds.json" };
const parsed = {
  cliente: "Ana", telefono: "59891234567", resumen_pedido: "techo", ubicacion: "MVD",
  urgencia: "alta", validar_stock: "No", probabilidad_cierre: "80", tipo_cliente: "obra",
  observaciones: "obs", vendedor: "MA", categoria: "cotizacion",
};

// ── writeWaCrmIngest: append to first empty CRM row (row 5), correct ranges+values ──
const s1 = fakeSheets();
const r1 = await writeWaCrmIngest({ parsedData: parsed, chatId: "59891234567", dialogo: "d", config, sheets: s1, logger: null });
assert("create → crmRow 5 (first empty)", r1.crmRow === 5);
const by = (frag) => s1.updates.find((u) => u.range.includes(frag));
assert("writes CRM B5:K5", !!by("B5:K5"));
assert("writes Form A4:P4", !!by("A4:P4"));
assert("writes CRM R5:T5", !!by("R5:T5"));
assert("writes CRM V5:W5", !!by("V5:W5"));
assert("writes AH5:AK5 tail", !!by("AH5:AK5"));
// VALUES (the actual byte-identity guard, not just ranges):
const bk = by("B5:K5").values;
assert("CRM B:K origen col === 'WA-Auto'", bk[4] === "WA-Auto");
assert("CRM B:K estado col === 'Pendiente'", bk[8] === "Pendiente");
assert("CRM B:K telefono col === parsed phone", bk[2] === "59891234567");
const rt = by("R5:T5").values;
assert("CRM R:T === [prob, urgencia, validar_stock]", rt[0] === "80" && rt[1] === "alta" && rt[2] === "No");
const form = by("A4:P4").values;
assert("Form A:P origen === 'WA-Auto'", form[5] === "WA-Auto");
assert("Form A:P last col === dialogo", form[15] === "d");

// ── findCrmRowByPhone: digit-normalized match (the insert-once key) ──
// format mismatch still matches (the whole point):
const f1 = await findCrmRowByPhone({ config, phone: "59891234567", sheets: fakeSheets([["Ana", "+598 91 234 567"]]) });
assert("findCrmRowByPhone: format-mismatch still hits → row 4", f1.row === 4);
// genuinely different phone does NOT collide:
const f2 = await findCrmRowByPhone({ config, phone: "59899999999", sheets: fakeSheets([["Ana", "59891234567"]]) });
assert("findCrmRowByPhone: different phone → no collision (null)", f2.row === null);
// unknown phone in a populated sheet → null:
const f3 = await findCrmRowByPhone({ config, phone: "59890000000", sheets: fakeSheets([["Ana", "59891234567"], ["Beto", "59891111111"]]) });
assert("findCrmRowByPhone: unknown phone → null", f3.row === null);
// no sheet config → skipped:
const f4 = await findCrmRowByPhone({ config: { bmcSheetId: "" }, phone: "x" });
assert("findCrmRowByPhone: no sheet id → skipped", f4.skipped === true && f4.row === null);

console.log(`\nwaCrmIngestExtract: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
