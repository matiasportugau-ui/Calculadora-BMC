// HITL mapper edges the smoke suite does not pin: ETag inputs, compat URL
// precedence, patch bounds, and sort. Offline. No Sheets.

import assert from "node:assert/strict";
import {
  isActionableEstado,
  estadoPriority,
  parseConsultaMarkers,
  deriveTitle,
  mapAdminRowToHitlCard,
  buildHitlBoardSnapshot,
  projectBoardJsonCompat,
  validateRowUpdate,
} from "../server/lib/hitlAdminBoard.js";

const SHEET = "sheet-test-id";

function row(overrides = {}) {
  const r = ["", "01-09", "", "099", "ACME", "ML", "", "MVD", "Consulta base", "", "", "Pendiente", ""];
  for (const [k, v] of Object.entries(overrides)) r[k] = v;
  return r;
}

// 1. Allowlist variants the smoke file does not enumerate.
assert.equal(isActionableEstado("falta-info"), true);
assert.equal(isActionableEstado("Falta  info"), true);
assert.equal(isActionableEstado("cotizable!"), false);
assert.equal(isActionableEstado(null), false);
assert.equal(estadoPriority("falta-info"), 3);
assert.equal(estadoPriority("falta_info"), 3);
assert.equal(estadoPriority(""), 99);

// 2. Marker parser: digit floor, separators, first hit, URL stop.
assert.deepEqual(parseConsultaMarkers("Q:12345 MLU12345"), {});
assert.equal(parseConsultaMarkers("Q:123456").ml_qid, "123456");
assert.equal(parseConsultaMarkers("MLU-123456").ml_mlu, "123456");
assert.equal(parseConsultaMarkers("mlu:123456").ml_mlu, "123456");
const two = parseConsultaMarkers("Q:111111 y Q:222222 https://ex.uy/a)tail,");
assert.equal(two.ml_qid, "111111");
assert.equal(two.listing_url, "https://ex.uy/a");
assert.deepEqual(parseConsultaMarkers(null), {});

// 3. Title: inline trailer, exact cap, ellipsis is one character.
assert.equal(deriveTitle("Precio — Q:1"), "Precio");
assert.equal(deriveTitle(""), "");
assert.equal(deriveTitle(null), "");
assert.equal(deriveTitle("a".repeat(140)), "a".repeat(140));
const clipped = deriveTitle("b".repeat(141));
assert.equal(clipped.length, 140);
assert.ok(clipped.endsWith("…"));
assert.equal(deriveTitle("hello world", 5), "hell…");

// 4. Non-array row and string index still produce a stable card.
const empty = mapAdminRowToHitlCard(null, 4, { tab: "Admin." });
assert.equal(empty.admin_row, 6);
assert.equal(empty.actionable, false);
assert.equal(empty.admin_sheet_url, "");
assert.equal(mapAdminRowToHitlCard(row(), "3", { sheetId: SHEET }).admin_row, 5);

// 5. Sort is lexicographic on fecha, then admin_row desc. Non-rows count.
const lateLex = row({ 1: "9-10", 11: "Pendiente" });
const earlyA = row({ 1: "01-09", 4: "A", 11: "Pendiente" });
const earlyB = row({ 1: "01-09", 4: "B", 11: "Pendiente" });
const snap = buildHitlBoardSnapshot(
  [earlyA, "nope", lateLex, earlyB],
  { sheetId: SHEET, tab: "Admin.", generatedAt: "2026-10-03T00:00:00Z" },
);
assert.equal(snap.counts.sheet_rows, 4);
assert.equal(snap.counts.mapped, 4);
assert.equal(snap.counts.actionable, 3);
assert.deepEqual(snap.items.map((it) => it.cliente), ["ACME", "B", "A"]);
assert.equal(snap.items[0].fecha, "9-10");
assert.equal(snap.items[1].admin_row, 5);
assert.equal(snap.items[2].admin_row, 2);
assert.equal(snap.counts.by_estado["(blank)"], 1);
assert.equal(buildHitlBoardSnapshot(null).counts.sheet_rows, 0);

// 6. ETag ignores consulta text when the length is unchanged, and ignores
//    cliente/telefono. Link, estado, and length do change it.
function etagOf(patch) {
  return buildHitlBoardSnapshot([row(patch)], {
    sheetId: SHEET,
    tab: "Admin.",
    generatedAt: "t0",
  }).etag;
}
const base = etagOf({});
assert.equal(etagOf({ 8: "Consulta basX" }), base, "same-length consulta must keep the etag");
assert.notEqual(etagOf({ 8: "Consulta base!" }), base);
assert.equal(etagOf({ 4: "OTRO", 3: "000" }), base, "cliente/telefono are outside the etag");
assert.notEqual(etagOf({ 10: "https://drive.example/q" }), base);
assert.notEqual(etagOf({ 12: "https://replay.example/s" }), base);
assert.notEqual(etagOf({ 11: "Reclamo" }), base);

// 7. board.json url prefers the spreadsheet over listing_url / link.
const listed = row({
  0: "ID-9",
  8: "Hola https://articulo.mercadolibre.com.uy/MLU-1",
  10: "https://drive.example/presupuesto",
  11: "Cotizable",
});
const compat = projectBoardJsonCompat(
  buildHitlBoardSnapshot([listed], { sheetId: SHEET, tab: "Admin." }),
);
assert.equal(compat[0].url, `https://docs.google.com/spreadsheets/d/${SHEET}/edit`);
assert.equal(compat[0].link, "https://drive.example/presupuesto");
assert.notEqual(compat[0].url, compat[0].link);
assert.equal(compat[0].qid, "ID-9");

const noSheet = projectBoardJsonCompat(
  buildHitlBoardSnapshot([listed], { sheetId: "", tab: "Admin." }),
);
assert.equal(noSheet[0].url, "");
assert.ok(noSheet[0].consulta.includes("mercadolibre"));

const nameless = row({ 0: "", 4: "", 8: "", 11: "Asignado" });
const fallback = projectBoardJsonCompat(
  buildHitlBoardSnapshot([nameless], { sheetId: SHEET, tab: "Admin." }),
);
assert.equal(fallback[0].qid, "ADMIN-2");
assert.equal(fallback[0].title, "Fila 2");

const named = row({ 0: "", 4: "VICENTE", 8: "", 11: "Asignado" });
assert.equal(
  projectBoardJsonCompat(buildHitlBoardSnapshot([named], { sheetId: SHEET }))[0].title,
  "VICENTE",
);

// 8. Patch validation bounds. Formula text is kept; the route sanitizes.
assert.equal(validateRowUpdate({ admin_row: "2", estado: "Pendiente" }).admin_row, 2);
assert.equal(validateRowUpdate({ adminRow: 9, link: "https://x" }).admin_row, 9);
assert.equal(validateRowUpdate({ row: 4, estado: "ok" }).admin_row, 4);
assert.equal(
  validateRowUpdate({ admin_row: 8, adminRow: 9, estado: "ok" }).admin_row,
  8,
);
assert.equal(validateRowUpdate({ admin_row: 7.5, estado: "ok" }).admin_row, 7.5);
assert.equal(validateRowUpdate({ admin_row: 100000, estado: "ok" }).ok, true);
assert.equal(validateRowUpdate({ admin_row: 100001, estado: "ok" }).ok, false);
assert.equal(validateRowUpdate({ admin_row: 1.9, estado: "ok" }).ok, false);
assert.equal(validateRowUpdate({ admin_row: true, estado: "ok" }).ok, false);
assert.equal(validateRowUpdate({ admin_row: "2abc", estado: "ok" }).ok, false);
assert.equal(validateRowUpdate([]).ok, false);

const spaces = validateRowUpdate({ admin_row: 3, estado: "   " });
assert.equal(spaces.ok, true);
assert.equal(spaces.patch.estado, "   ");
assert.equal(validateRowUpdate({ admin_row: 3, estado: null, respuesta: null }).ok, false);
assert.equal(validateRowUpdate({ admin_row: 3, estado: "" }).patch.estado, "");
assert.equal(validateRowUpdate({ admin_row: 3, estado: 0 }).patch.estado, "0");

const later = validateRowUpdate({ admin_row: 3, respuesta: "A", respuesta_ai: "B" });
assert.equal(later.patch.respuesta, "B");
assert.equal(later.patch.respuesta_ai, undefined);
const earlier = validateRowUpdate({ admin_row: 3, respuesta_ai: "B", respuesta: "A" });
assert.equal(earlier.patch.respuesta, "A");

assert.equal(validateRowUpdate({ admin_row: 3, estado: "x".repeat(80) }).ok, true);
assert.match(validateRowUpdate({ admin_row: 3, estado: "x".repeat(81) }).error, /estado supera 80/);
assert.equal(validateRowUpdate({ admin_row: 3, link: "u".repeat(2048) }).ok, true);
assert.equal(validateRowUpdate({ admin_row: 3, link: "u".repeat(2049) }).ok, false);
assert.equal(validateRowUpdate({ admin_row: 3, replay_snapshot_url: "u".repeat(2048) }).ok, true);
assert.equal(validateRowUpdate({ admin_row: 3, replay_snapshot_url: "u".repeat(2049) }).ok, false);

const formula = validateRowUpdate({ admin_row: 3, estado: '=IMPORTRANGE("https://evil","A1")' });
assert.equal(formula.patch.estado, '=IMPORTRANGE("https://evil","A1")');

const proto = Object.create({ estado: "Pendiente" });
proto.admin_row = 4;
assert.equal(validateRowUpdate(proto).ok, false);

console.log("hitlAdminBoardEdgeGates.test.js: ok");
