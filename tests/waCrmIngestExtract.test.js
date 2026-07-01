// writeWaCrmIngest / writeWaCrmAiTail (create-only append, header-anchored) +
// findCrmRowByPhone — offline, fake Sheets.
//
// Regression guard for the canonical CRM write after it adopted the header-anchored
// crmRowMapper contract: values are placed at the column whose row-3 header matches
// their logical key, the write targets B:W + AH:AK (gate defaults) + AF:AG (AI tail),
// and the phone-normalized existence lookup that drives insert-once still holds.
import {
  writeWaCrmIngest,
  writeWaCrmAiTail,
  findCrmRowByPhone,
} from "../server/lib/wa/crmIngestWrite.js";

let passed = 0;
let failed = 0;
function assert(name, condition) {
  if (condition) { console.log(`  ✅ ${name}`); passed += 1; }
  else { console.log(`  ❌ ${name}`); failed += 1; }
}

// Real CRM_Operativo row-3 headers, placed at their canonical 0-based indices
// (A=0, B=1, …). buildCrmRow resolves each field to the column whose header matches.
function crmHeaderRow() {
  const h = new Array(37).fill("");
  h[1] = "Fecha"; h[2] = "Cliente"; h[3] = "Teléfono";
  h[4] = "Ubicación / Dirección"; h[5] = "Origen"; h[6] = "Consulta / Pedido";
  h[7] = "Categoría"; h[9] = "Estado"; h[10] = "Responsable";
  h[17] = "Probabilidad de cierre"; h[18] = "Urgencia"; h[19] = "Validar stock";
  h[21] = "Tipo de cliente"; h[22] = "Observaciones";
  h[31] = "Respuesta sugerida"; h[32] = "Provider IA";
  h[33] = "Link presupuesto"; h[34] = "Aprobado enviar";
  h[35] = "Enviado el"; h[36] = "Bloquear auto";
  return h;
}

// Fake Sheets: Form has 2 filled rows; CRM_Operativo has Ana in row 4, empty row 5.
// `headers` is the row-3 array returned by the CRM batchGet (empty ⇒ letter fallback).
function fakeSheets(crmCD = [["Ana", "59891234567"], ["", ""]], headers = crmHeaderRow()) {
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
        batchGet: async ({ ranges }) => {
          const valueRanges = ranges.map((rg) => {
            if (rg.includes("A3:ZZ3")) return { values: headers.length ? [headers] : [] };
            if (rg.includes("C4:C500")) return { values: crmCD.map((r) => [r[0]]) };
            return { values: [] };
          });
          return { data: { valueRanges } };
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

// ── writeWaCrmIngest: append to first empty CRM row (row 5), header-anchored ──
const s1 = fakeSheets();
const r1 = await writeWaCrmIngest({ parsedData: parsed, chatId: "59891234567", dialogo: "d", config, sheets: s1, logger: null });
assert("create → crmRow 5 (first empty)", r1.crmRow === 5);
assert("returns crmHeaders for the AI tail", Array.isArray(r1.crmHeaders) && r1.crmHeaders[2] === "Cliente");
const by = (frag) => s1.updates.find((u) => u.range.includes(frag));
assert("writes CRM B5:W5 (single data block)", !!by("B5:W5"));
assert("writes Form A4:P4", !!by("A4:P4"));
assert("writes CRM AH5:AK5 gate defaults", !!by("AH5:AK5"));
assert("does NOT write legacy positional R5:T5", !by("R5:T5"));
assert("does NOT write legacy positional V5:W5", !by("V5:W5"));

// VALUES land at header-resolved columns within the B:W slice (offset = absoluteIdx - 1).
const bw = by("B5:W5").values;
assert("B:W col F (origen) === 'WA-Auto'", bw[4] === "WA-Auto");
assert("B:W col J (estado) === 'Pendiente'", bw[8] === "Pendiente");
assert("B:W col C (cliente) === 'Ana'", bw[1] === "Ana");
assert("B:W col D (telefono) === parsed phone", bw[2] === "59891234567");
assert("B:W col R (probabilidad) === '80'", bw[16] === "80");
assert("B:W col S (urgencia) === 'alta'", bw[17] === "alta");
assert("B:W col T (validar_stock) === 'No'", bw[18] === "No");
assert("B:W col V (tipo_cliente) === 'obra'", bw[20] === "obra");
assert("B:W col W (observaciones) === 'obs'", bw[21] === "obs");
// Gate defaults on create (AH:AK slice, offset = absoluteIdx - 33):
const gate = by("AH5:AK5").values;
assert("AH:AK col AI (aprobado enviar) === 'No'", gate[1] === "No");
assert("AH:AK col AK (bloquear auto) === 'No'", gate[3] === "No");
// Form row still positional:
const form = by("A4:P4").values;
assert("Form A:P origen === 'WA-Auto'", form[5] === "WA-Auto");
assert("Form A:P last col === dialogo", form[15] === "d");

// ── writeWaCrmAiTail: AF:AG suggested reply + provider (legacy OFF path) ──
const s2 = fakeSheets();
await writeWaCrmAiTail({
  sheets: s2, sheetId: "sheet1", crmRow: 5, crmHeaders: crmHeaderRow(),
  respuesta: "Hola, gracias por tu consulta", provider: "anthropic", logger: null,
});
const tail = s2.updates.find((u) => u.range.includes("AF5:AG5"));
assert("AI tail writes AF5:AG5", !!tail);
assert("AF (respuesta sugerida) === reply", tail.values[0] === "Hola, gracias por tu consulta");
assert("AG (provider IA) === 'anthropic'", tail.values[1] === "anthropic");

// ── header drift: no row-3 headers → column-LETTER fallback keeps the same layout ──
const s3 = fakeSheets([["Ana", "59891234567"], ["", ""]], []);
await writeWaCrmIngest({ parsedData: parsed, chatId: "59891234567", dialogo: "d", config, sheets: s3, logger: null });
const bwFallback = s3.updates.find((u) => u.range.includes("B5:W5"))?.values;
assert("fallback: still writes B5:W5", !!bwFallback);
assert("fallback: col F origen still 'WA-Auto'", bwFallback[4] === "WA-Auto");
assert("fallback: col J estado still 'Pendiente'", bwFallback[8] === "Pendiente");

// ── CSV/formula sanitization: a leading '=' is neutralized before the write ──
const s4 = fakeSheets();
await writeWaCrmIngest({
  parsedData: { ...parsed, cliente: "=HYPERLINK(1)" },
  chatId: "59891234567", dialogo: "d", config, sheets: s4, logger: null,
});
const bwSan = s4.updates.find((u) => u.range.includes("B5:W5"))?.values;
assert("sanitize: leading '=' neutralized in cliente cell", typeof bwSan[1] === "string" && !bwSan[1].startsWith("="));

// ── findCrmRowByPhone: digit-normalized match (the insert-once key) ──
const f1 = await findCrmRowByPhone({ config, phone: "59891234567", sheets: fakeSheets([["Ana", "+598 91 234 567"]]) });
assert("findCrmRowByPhone: format-mismatch still hits → row 4", f1.row === 4);
const f2 = await findCrmRowByPhone({ config, phone: "59899999999", sheets: fakeSheets([["Ana", "59891234567"]]) });
assert("findCrmRowByPhone: different phone → no collision (null)", f2.row === null);
const f3 = await findCrmRowByPhone({ config, phone: "59890000000", sheets: fakeSheets([["Ana", "59891234567"], ["Beto", "59891111111"]]) });
assert("findCrmRowByPhone: unknown phone → null", f3.row === null);
const f4 = await findCrmRowByPhone({ config: { bmcSheetId: "" }, phone: "x" });
assert("findCrmRowByPhone: no sheet id → skipped", f4.skipped === true && f4.row === null);

console.log(`\nwaCrmIngestExtract: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
