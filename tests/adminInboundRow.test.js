// Offline. No sheet, no network. node tests/adminInboundRow.test.js
import assert from "node:assert/strict";
import { appendAdminInboundRow, buildInboundConsulta } from "../server/lib/adminInboundRow.js";
import { filterCrmMlRowsCoveredByAdmin } from "../src/utils/crmMlAdminDedup.js";
import { ADMIN_COLUMNS } from "../server/lib/adminSheetSchema.js";

let passed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`  ok ${name}`);
    });
}

/** Realistic header matching the live sheet so appendAdminInboundRow's
 *  fail-closed header check passes. */
const LIVE_HEADER = ADMIN_COLUMNS.map((c) => c.header);
// Pre-realignment the live sheet has a Drive URL stuck in A1; mimic that so
// the schema check still accepts it (A1 is intentionally not validated).
LIVE_HEADER[0] = "https://drive.google.com/file/d/1zvnOCTyGdQubL6v-oatdnji4cDrI0t1c/view?usp=drivesdk";

/**
 * Smart fake sheets:
 *  - row-1 reads return the live header
 *  - A2:I reads return seeded rows (for dedup lookups)
 *  - append remembers the row
 */
function fakeSheets(seedRows = []) {
  const calls = [];
  const stored = seedRows.map((r) => (Array.isArray(r) ? r.slice() : [r]));
  function readRange(range) {
    if (/!1:1$/.test(range)) {
      return { data: { values: [LIVE_HEADER] } };
    }
    // A2:I slice for dedup
    return {
      data: {
        values: stored.map((r) => r.slice(0, 9)),
      },
    };
  }
  return {
    calls,
    stored,
    spreadsheets: {
      values: {
        async get(args) {
          calls.push({ op: "get", args });
          return readRange(String(args?.range || ""));
        },
        async append(args) {
          calls.push({ op: "append", args });
          const vals = args?.requestBody?.values?.[0] || [];
          stored.push(vals.slice());
          const n = stored.length + 1; // row 1 is header
          return { data: { updates: { updatedRange: `'Admin.'!A${n}:N${n}` } } };
        },
      },
    },
  };
}

/** Build a seed row with legacy / live-header shape depending on `legacy`. */
function seedRow({ A = "", C = "", I = "", legacy = false } = {}) {
  if (legacy) {
    // Pre-realignment writer: A=id-prefixed, C=`<CH>:<id>` dedup key, I=consulta.
    const row = new Array(13).fill("");
    row[0] = A;
    row[2] = C;
    row[8] = I;
    return row;
  }
  // Live layout: A=id, I=consulta (with Q trailer), C=Estado.
  const row = new Array(14).fill("");
  row[0] = A;
  row[2] = C || "Pendiente";
  row[8] = I;
  return row;
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

await check("a new WhatsApp message appends one Pendiente row aligned to the LIVE header", async () => {
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
  const row = sheets.calls.find((c) => c.op === "append").args.requestBody.values[0];
  // Live layout — see server/lib/adminSheetSchema.js.
  assert.equal(row[0], "WA-wamid.1", "A = ID");
  assert.equal(row[1], "", "B = Asig. (operator initials; writer leaves empty)");
  assert.equal(row[2], "Pendiente", "C = Estado");
  assert.equal(row[3], "03/10/2026", "D = Fecha");
  assert.equal(row[4], "Ana", "E = Cliente");
  assert.equal(row[5], "WA", "F = Origen (short code, not long label)");
  assert.equal(row[6], "59899111222", "G = Teléfono-Contacto");
  assert.equal(row[7], "", "H = Zona (none provided)");
  assert.equal(row[8], "precio de 50m2", "I = Consulta");
  assert.equal(row[9], "", "J = Interpretación AI (never set by writer)");
  assert.equal(row[10], "", "K = Respuesta AI (never set by writer)");
  assert.equal(row[11], "", "L = Datos Faltantes (never set by writer)");
  assert.equal(row[12], "", "M = PRESUPUESTO (never set by writer)");
  assert.equal(row[13], "FALSE", "N = Enviado (default checkbox state)");
  assert.equal(row.length, 14, "row must be exactly 14 cells wide, never spilling into legacy O..AC");
});

await check("the same message id does not append again (dedup via column A)", async () => {
  const sheets = fakeSheets([seedRow({ A: "WA-wamid.1" })]);
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "WA",
    messageId: "wamid.1",
    text: "precio de 50m2",
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.adminRow, 2);
  assert.equal(sheets.calls.some((c) => c.op === "append"), false);
});

await check("pre-realignment rows (dedup key in column C) are still detected", async () => {
  const sheets = fakeSheets([seedRow({ A: "FB-m1", C: "FB:m1", I: "hola", legacy: true })]);
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "FB",
    messageId: "m1",
    text: "hola",
  });
  assert.equal(result.duplicate, true);
  assert.equal(sheets.calls.some((c) => c.op === "append"), false);
});

await check("a Mercado Libre QID already in a human row's consulta trailer is NOT duplicated", async () => {
  // The HITL operator copied the question into row 42 with the trailer
  // `— Q:13668673214` in column I. A webhook re-delivery (when the seller
  // answers in ML) must not add a second row at the bottom.
  const humanRow = seedRow({
    A: "", // humans leave A empty
    C: "Respondida en ML",
    I: "Hola gotero frontal 100m rojo teja — Q:13668673214 · MLU880882392",
  });
  const sheets = fakeSheets([humanRow]);
  const result = await appendAdminInboundRow({
    ...base,
    sheets,
    channel: "ML",
    messageId: "13668673214",
    consulta: "Es de color blanco — Q:13668673214",
    questionId: "13668673214",
  });
  assert.equal(result.duplicate, true, "ML webhook re-delivery must dedup against Q:<qid> in I");
  assert.equal(sheets.calls.some((c) => c.op === "append"), false);
});

await check("the header fail-closed guard refuses to append on a drifted sheet", async () => {
  const sheets = fakeSheets();
  // Corrupt the header for this test.
  const originalD = LIVE_HEADER[3];
  LIVE_HEADER[3] = "Totalmente-otra-cosa";
  try {
    const result = await appendAdminInboundRow({
      ...base,
      sheets,
      channel: "WA",
      messageId: "wamid.drift",
      text: "hola",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "admin_header_mismatch");
    assert.ok(Array.isArray(result.mismatches) && result.mismatches.length >= 1);
    assert.equal(sheets.calls.some((c) => c.op === "append"), false, "writer must stop before any append");
  } finally {
    LIVE_HEADER[3] = originalD;
  }
});

await check("a photo with no caption still creates a row with the short origen code", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, channel: "IG", messageId: "ig1", media: "image" });
  assert.equal(result.ok, true);
  const row = sheets.calls.find((c) => c.op === "append").args.requestBody.values[0];
  assert.equal(row[5], "IG", "F = short origen code");
  assert.equal(row[8], "[imagen]");
  assert.equal(row[2], "Pendiente");
});

await check("Mercado Libre consulta keeps the Q trailer and the short origen code", async () => {
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
  assert.equal(row[5], "ML", "F = short origen code (not 'Mercado Libre')");
});

await check("an empty message is refused", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, channel: "EM", messageId: "<a@b>", text: "   " });
  assert.deepEqual(result, { ok: false, error: "consulta_required" });
  assert.equal(sheets.calls.length, 0);
});

await check("dry run does not append or hit the header", async () => {
  const sheets = fakeSheets();
  const result = await appendAdminInboundRow({ ...base, sheets, dryRun: true, channel: "FB", messageId: "fb1", text: "hola" });
  assert.equal(result.dryRun, true);
  assert.equal(result.row[5], "FB", "dry-run row still uses the short code in F");
  assert.equal(result.row[2], "Pendiente");
  assert.equal(result.row[13], "FALSE");
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
