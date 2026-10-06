// adminSheetSchema — single source of truth for the Admin. layout.
// Offline. node tests/adminSheetSchema.test.js
import assert from "node:assert/strict";
import {
  ADMIN_COLUMNS,
  ADMIN_COL_INDEX,
  ADMIN_ESTADO_PENDIENTE,
  ADMIN_KEY_INDEX,
  ADMIN_RANGE_END,
  ADMIN_RANGE_START,
  ADMIN_RANGE_WIDTH,
  adminOrigenShort,
  buildAdminRow,
  extractConsultaQids,
  readAdminCell,
  validateAdminHeader,
} from "../server/lib/adminSheetSchema.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// 1. The columns array exactly matches the LIVE header (A..N) in order.
check("ADMIN_COLUMNS lists A..N in the live-header order", () => {
  assert.equal(ADMIN_RANGE_START, "A");
  assert.equal(ADMIN_RANGE_END, "N");
  assert.equal(ADMIN_RANGE_WIDTH, 14);
  assert.equal(ADMIN_COLUMNS.length, 14);
  const letters = ADMIN_COLUMNS.map((c) => c.letter);
  assert.deepEqual(letters, ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"]);
  const keys = ADMIN_COLUMNS.map((c) => c.key);
  assert.deepEqual(keys, [
    "id", "asig", "estado", "fecha", "cliente", "origen",
    "telefono", "zona", "consulta", "interpretacion_ai",
    "respuesta_ai", "datos_faltantes", "presupuesto", "enviado",
  ]);
});

check("ADMIN_COL_INDEX and ADMIN_KEY_INDEX stay in sync", () => {
  assert.equal(ADMIN_COL_INDEX.C, 2);
  assert.equal(ADMIN_COL_INDEX.K, 10);
  assert.equal(ADMIN_COL_INDEX.N, 13);
  assert.equal(ADMIN_KEY_INDEX.estado, 2);
  assert.equal(ADMIN_KEY_INDEX.respuesta_ai, 10);
  assert.equal(ADMIN_KEY_INDEX.enviado, 13);
});

// 2. validateAdminHeader
check("validateAdminHeader accepts the live sheet (with the A1 Drive URL)", () => {
  const header = ADMIN_COLUMNS.map((c) => c.header);
  header[0] = "https://drive.google.com/file/d/accidental-url/view"; // live A1
  const res = validateAdminHeader(header);
  assert.deepEqual(res, { ok: true });
});

check("validateAdminHeader tolerates leading/trailing whitespace and case", () => {
  const header = [
    "", // A ignored
    " Asig. ",
    "ESTADO",
    "   Fecha   ",
    "Cliente ",
    "Origen",
    "Telefono-Contacto",
    "Direccion / Zona",
    "            Consulta ",
    "Interpretacion AI ",
    "Respuesta AI",
    "Datos Faltantes ",
    "PRESUPUESTO",
    "Enviado",
  ];
  assert.deepEqual(validateAdminHeader(header), { ok: true });
});

check("validateAdminHeader fails closed on a drifted header and lists the mismatches", () => {
  const header = ADMIN_COLUMNS.map((c) => c.header);
  header[0] = ""; // A ignored
  header[2] = "Totalmente otra cosa"; // C corrupted
  header[11] = "Also broken"; // L corrupted
  const res = validateAdminHeader(header);
  assert.equal(res.ok, false);
  assert.equal(res.mismatches.length, 2);
  const letters = res.mismatches.map((m) => m.col).sort();
  assert.deepEqual(letters, ["C", "L"]);
});

check("validateAdminHeader refuses an empty / short header", () => {
  assert.equal(validateAdminHeader([]).ok, false);
  assert.equal(validateAdminHeader(["", "wrong"]).ok, false);
});

// 3. adminOrigenShort
check("adminOrigenShort returns short codes for every mandated channel", () => {
  assert.equal(adminOrigenShort("WA"), "WA");
  assert.equal(adminOrigenShort("whatsapp"), "WA");
  assert.equal(adminOrigenShort("WhatsApp"), "WA");
  assert.equal(adminOrigenShort("ML"), "ML");
  assert.equal(adminOrigenShort("Mercado Libre"), "ML");
  assert.equal(adminOrigenShort("MercadoLibre"), "ML");
  assert.equal(adminOrigenShort("FB"), "FB");
  assert.equal(adminOrigenShort("Facebook"), "FB");
  assert.equal(adminOrigenShort("Messenger"), "FB");
  assert.equal(adminOrigenShort("IG"), "IG");
  assert.equal(adminOrigenShort("Instagram"), "IG");
  assert.equal(adminOrigenShort("VW"), "VW");
  assert.equal(adminOrigenShort("storefront"), "VW");
  assert.equal(adminOrigenShort("EM"), "EM");
  assert.equal(adminOrigenShort("Email"), "EM");
  assert.equal(adminOrigenShort("mail"), "EM");
  assert.equal(adminOrigenShort("CL"), "CL");
  assert.equal(adminOrigenShort("Cliente físico"), "CL");
  assert.equal(adminOrigenShort("LO"), "LO");
  assert.equal(adminOrigenShort("Local/oficina"), "LO");
  assert.equal(adminOrigenShort("LL"), "LL");
  assert.equal(adminOrigenShort("Llamada"), "LL");
});

check("adminOrigenShort returns the empty string on no input and preserves unknown codes", () => {
  assert.equal(adminOrigenShort(""), "");
  assert.equal(adminOrigenShort(null), "");
  assert.equal(adminOrigenShort("XX"), "XX"); // writers never fail on unknown channel
});

// 4. buildAdminRow aligns to exactly 14 cells.
check("buildAdminRow always produces 14 cells aligned to A..N", () => {
  const row = buildAdminRow({ A: "WA-123", C: "Pendiente", F: "WA", I: "hola", N: "FALSE" });
  assert.equal(row.length, 14);
  assert.equal(row[0], "WA-123");
  assert.equal(row[1], "");
  assert.equal(row[2], "Pendiente");
  assert.equal(row[5], "WA");
  assert.equal(row[8], "hola");
  assert.equal(row[13], "FALSE");
});

check("buildAdminRow accepts semantic keys", () => {
  const row = buildAdminRow({
    id: "MAN-1",
    estado: ADMIN_ESTADO_PENDIENTE,
    cliente: "Ana",
    origen: "VW",
    consulta: "Chat tienda Panelin — inicio",
    enviado: "FALSE",
  });
  assert.equal(row[0], "MAN-1");
  assert.equal(row[2], "Pendiente");
  assert.equal(row[4], "Ana");
  assert.equal(row[5], "VW");
  assert.equal(row[8], "Chat tienda Panelin — inicio");
  assert.equal(row[13], "FALSE");
});

check("buildAdminRow ignores unknown keys so writers never spill past N", () => {
  const row = buildAdminRow({ O: "legacy field", Z: "another", AO: "icono" });
  assert.equal(row.length, 14);
  assert.deepEqual(row, Array.from({ length: 14 }, () => ""));
});

// 5. readAdminCell
check("readAdminCell reads by letter or key, 0-based", () => {
  const row = buildAdminRow({ A: "WA-1", C: "Pendiente", I: "hola" });
  assert.equal(readAdminCell(row, "A"), "WA-1");
  assert.equal(readAdminCell(row, "C"), "Pendiente");
  assert.equal(readAdminCell(row, "consulta"), "hola");
  assert.equal(readAdminCell(row, "unknown"), "");
});

// 6. extractConsultaQids
check("extractConsultaQids finds all Q:<qid> markers in a consulta cell", () => {
  assert.deepEqual(extractConsultaQids("Hola — Q:13668673214 · MLU880882392"), ["13668673214"]);
  assert.deepEqual(
    extractConsultaQids("Mezcla rara — Q:13668673214 y Q: 13664320224 en la misma celda"),
    ["13668673214", "13664320224"],
  );
  assert.deepEqual(extractConsultaQids(""), []);
  assert.deepEqual(extractConsultaQids("sin markers"), []);
});

console.log(`\nadminSheetSchema: ${passed} passed`);
