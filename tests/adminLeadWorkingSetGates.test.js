// Edge gates for the Admin working-set write (#1340).
// The shipped adminLeadLayout.test.js returns at the 12-empty gap and never
// reaches WORKING_SET_DUMP_FLOOR, so a sheet with sentinel rows can still
// walk into the 3713 dump if that floor regresses.
// Run: node tests/adminLeadWorkingSetGates.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WORKING_SET_DUMP_FLOOR,
  findNextWorkingSetRow,
  rowHasLeadData,
  evaluateStorefrontConsulta,
  isStubStorefrontConsulta,
  detectAdminRowLayout,
  mapAdminRowCanonical,
  buildCanonicalAdminUpdates,
  formatAdminFecha,
} from "../server/lib/adminLeadLayout.js";
import { sanitizeCellValue } from "../server/lib/sheetsCsvGuard.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function blank() {
  return Array(13).fill("");
}

function leadAt(patch = {}) {
  const row = blank();
  row[2] = "Pendiente";
  row[4] = "Ana";
  for (const [idx, value] of Object.entries(patch)) row[Number(idx)] = value;
  return row;
}

function onlyCol(idx, value = "x") {
  const row = blank();
  row[idx] = value;
  return row;
}

// ── Occupancy: dump phones count, id/zona/respuesta/faltantes do not ────────

assert.equal(rowHasLeadData(null), false);
assert.equal(rowHasLeadData({}), false);
assert.equal(rowHasLeadData("Pendiente"), false);
assert.equal(rowHasLeadData(onlyCol(0, "MAN-1")), false, "id in A is not a lead");
assert.equal(rowHasLeadData(onlyCol(1, "08/10/2026")), false, "legacy fecha in B is not a lead");
assert.equal(rowHasLeadData(onlyCol(7, "Maldonado")), false, "zona alone is not a lead");
assert.equal(rowHasLeadData(onlyCol(10, "respuesta")), false, "K respuesta is not a lead");
assert.equal(rowHasLeadData(onlyCol(11, "Pendiente")), false, "L alone is not a lead");
assert.equal(rowHasLeadData(onlyCol(12, "https://pdf")), false, "M pdf is not a lead");
assert.equal(rowHasLeadData(onlyCol(2, "   ")), false, "whitespace is empty");
assert.equal(rowHasLeadData(onlyCol(2, "Pendiente")), true);
assert.equal(rowHasLeadData(onlyCol(3, "59899111222")), true, "legacy phone in D is occupied");
assert.equal(rowHasLeadData(onlyCol(9, "lead_vw")), true, "J interpretacion is occupied");

// ── Dump floor, not the 12-row gap, is what skips row 3713 ───────────────────

const through199 = Array.from({ length: 198 }, () => leadAt());
const dump = Array.from({ length: 3600 }, () => onlyCol(3, "59899111222"));
assert.equal(
  findNextWorkingSetRow([...through199, ...dump]),
  WORKING_SET_DUMP_FLOOR,
  "full working set stops at row 200 even when the dump is occupied",
);

// Sentinel every 11 rows so the empty streak stays under the gap of 12.
const sentinel = Array.from({ length: 79 }, () => leadAt());
for (let sheetRow = 81; sheetRow <= 3800; sheetRow++) {
  const occupied = (sheetRow - 80) % 11 === 0;
  sentinel.push(occupied ? onlyCol(3, "59899111222") : blank());
}
assert.equal(findNextWorkingSetRow(sentinel), 191, "floor wins when no 12-empty gap exists");
assert.ok(findNextWorkingSetRow(sentinel) < 200);

// 11 blanks do not split the working set; 12 blanks do, even if a later lead exists.
const hole11 = [...Array.from({ length: 5 }, () => leadAt()), ...Array.from({ length: 11 }, blank), leadAt()];
assert.equal(findNextWorkingSetRow(hole11), 19);

const gap12 = [
  ...Array.from({ length: 5 }, () => leadAt()),
  ...Array.from({ length: 12 }, blank),
  ...Array.from({ length: 40 }, () => leadAt()),
];
assert.equal(findNextWorkingSetRow(gap12), 7, "12 empties return the row after the last lead");

// Zona-only rows are empty, so they still open the gap.
const zonaGap = [
  leadAt(),
  ...Array.from({ length: 12 }, () => onlyCol(7, "Canelones")),
  leadAt(),
];
assert.equal(findNextWorkingSetRow(zonaGap), 3);

assert.equal(findNextWorkingSetRow(null), 2);
assert.equal(findNextWorkingSetRow("rows"), 2);
assert.equal(findNextWorkingSetRow([leadAt()], { startRow: 10 }), 11);
// gap 0 is falsy and falls back to 12 — a single hole must not insert early.
assert.equal(
  findNextWorkingSetRow(
    [leadAt(), blank(), leadAt()],
    { gap: 0 },
  ),
  5,
);
assert.equal(
  findNextWorkingSetRow(Array.from({ length: 30 }, () => leadAt()), { dumpFloor: 10 }),
  10,
);

// ── Storefront eval: no invented price, stub boundary, espesor allowlist ────

assert.equal(isStubStorefrontConsulta(""), true);
assert.equal(isStubStorefrontConsulta("   "), true);
assert.equal(isStubStorefrontConsulta(null), true);

const stubHead = "chat tienda panelin IsoDec 100 12x4 ";
const shortPrefixed = stubHead + "x".repeat(79 - stubHead.length);
const longPrefixed = stubHead + "x".repeat(80 - stubHead.length);
assert.equal(shortPrefixed.length, 79);
assert.equal(isStubStorefrontConsulta(shortPrefixed), true, "prefix under 80 chars stays a stub");
assert.equal(evaluateStorefrontConsulta({ consulta: shortPrefixed }).quotable, false);
assert.equal(evaluateStorefrontConsulta({ consulta: shortPrefixed }).respuesta, "");
assert.equal(isStubStorefrontConsulta(longPrefixed), false);

const fromLong = evaluateStorefrontConsulta({ consulta: longPrefixed, zona: "Maldonado" });
assert.equal(fromLong.quotable, true);
assert.equal(fromLong.family, "IsoDec");
assert.equal(fromLong.estado, "Cotizable");
assert.doesNotMatch(fromLong.respuesta, /\d|USD|\$/i, "quotable reply does not invent a price");
assert.match(fromLong.faltantes, /color/, "color is never inferred");
assert.deepEqual(fromLong.assumed, ["escenario techo [inferido]"]);

const families = [
  ["iso dec 50 10x4", "IsoDec", "techo", 50],
  ["IsoRoof 30 8×2", "IsoRoof", "techo", 30],
  ["iso panel 200 mm 4x2", "IsoPanel", "pared", 200],
  ["cámara 120 5x4", "IsoFrig", "camara", 120],
  ["techo hiansa 40 9x3", "Hiansa", "techo", 40],
];
for (const [consulta, family, escenario, espesor] of families) {
  const ev = evaluateStorefrontConsulta({ consulta, zona: "Montevideo", cliente: "Ana" });
  assert.equal(ev.family, family, consulta);
  assert.equal(ev.espesor, espesor, consulta);
  assert.equal(ev.quotable, true, consulta);
  assert.match(ev.interpretacion, new RegExp(`escenario=${escenario}`));
  assert.match(ev.interpretacion, /cliente=Ana/);
  assert.match(ev.interpretacion, /lista=web/);
  assert.match(ev.interpretacion, /flete=no/);
  assert.doesNotMatch(ev.respuesta, /\d|USD|\$/i);
}

assert.equal(
  evaluateStorefrontConsulta({ consulta: "IsoDec y tambien IsoRoof 50 10x4" }).family,
  "IsoDec",
  "first family in the list wins",
);
assert.equal(
  evaluateStorefrontConsulta({ consulta: "cámara isoroof 50 8x3" }).family,
  "IsoRoof",
  "IsoRoof is tested before cámara",
);

const espesor60 = evaluateStorefrontConsulta({ consulta: "IsoDec 60mm 12x4", zona: "Maldonado" });
assert.equal(espesor60.espesor, null);
assert.equal(espesor60.quotable, false);
assert.equal(espesor60.estado, "Falta info");
assert.match(espesor60.faltantes, /espesor/);
assert.match(espesor60.respuesta, /Falta dato/);

const thousand = evaluateStorefrontConsulta({ consulta: "IsoDec 1000 12x4", zona: "Maldonado" });
assert.equal(thousand.espesor, null, "1000 must not be read as espesor 100");
assert.equal(thousand.quotable, false);

const noMedidas = evaluateStorefrontConsulta({ consulta: "IsoDec 100", zona: "Maldonado" });
assert.equal(noMedidas.quotable, false);
assert.match(noMedidas.faltantes, /medidas/);

const comma = evaluateStorefrontConsulta({ consulta: "IsoDec 100 12,5×3,95", zona: "Salto" });
assert.equal(comma.quotable, true);
assert.deepEqual(
  comma.medidas,
  { ancho: 12.5, largo: 3 },
  "only the first comma is rewritten, so the second decimal stops at the comma",
);

const thousands = evaluateStorefrontConsulta({ consulta: "IsoDec 100 1,500x2", zona: "Salto" });
assert.deepEqual(thousands.medidas, { ancho: 1.5, largo: 2 }, "only the first comma becomes a dot");

const noFamily = evaluateStorefrontConsulta({ consulta: "12x4 gris", zona: "Salto" });
assert.equal(noFamily.family, null);
assert.equal(noFamily.quotable, false);
assert.deepEqual(noFamily.assumed, []);
assert.match(noFamily.faltantes, /tipo\/familia/);

const noZona = evaluateStorefrontConsulta({ consulta: "IsoPanel 80 6x2" });
assert.equal(noZona.quotable, true, "zona is not required to mark Cotizable");
assert.match(noZona.faltantes, /zona/);
assert.doesNotMatch(noZona.interpretacion, /cliente=/);

// ── Layout detection: C estado wins; legacy phone stays in D ────────────────

function legacyDump() {
  const row = blank();
  row[0] = "MAN-1";
  row[1] = "08/10/2026";
  row[3] = "59899111222";
  row[4] = "Bot";
  row[5] = "VW";
  row[8] = "Chat tienda Panelin — inicio";
  row[9] = "texto J";
  row[10] = "link K";
  row[11] = "Pendiente";
  row[12] = "replay M";
  return row;
}

const both = leadAt({ 2: "Cotizable", 3: "59899111222", 6: "099111222", 10: "resp K", 11: "Pendiente" });
assert.equal(detectAdminRowLayout(both), "canonical", "estado in C wins over a phone-like D and estado in L");
const bothMapped = mapAdminRowCanonical(both, 4, "sheet-1");
assert.equal(bothMapped.estado, "Cotizable");
assert.equal(bothMapped.telefono, "099111222");
assert.equal(bothMapped.respuesta, "resp K");
assert.equal(bothMapped.rowNum, 6);
assert.match(bothMapped.sheetUrl, /sheet-1/);

const datePhone = blank();
datePhone[3] = "8-10";
datePhone[6] = "+598 99 111 222";
datePhone[8] = "IsoDec 100 12x4";
datePhone[9] = "interp J";
datePhone[10] = "resp K";
datePhone[11] = "color";
assert.equal(detectAdminRowLayout(datePhone), "canonical");
const dateMapped = mapAdminRowCanonical(datePhone, 0, "sheet-1");
assert.equal(dateMapped.telefono, "+598 99 111 222");
assert.equal(dateMapped.fecha, "8-10");
assert.equal(dateMapped.interpretacion, "interp J");
assert.equal(dateMapped.respuesta, "resp K");
assert.equal(dateMapped.faltantes, "color");
assert.equal(dateMapped.stub, false);

assert.equal(detectAdminRowLayout(legacyDump()), "legacy");
const legacy = mapAdminRowCanonical(legacyDump(), 3711, "sheet-1");
assert.equal(legacy.layout, "legacy");
assert.equal(legacy.telefono, "59899111222");
assert.equal(legacy.estado, "Pendiente");
assert.equal(legacy.fecha, "08/10/2026");
assert.equal(legacy.respuesta, "texto J", "legacy respuesta is column J, not K");
assert.equal(legacy.link, "link K");
assert.equal(legacy.faltantes, "");
assert.equal(legacy.stub, true);
assert.equal(legacy.rowNum, 3713);

const fechaLooksLegacy = blank();
fechaLooksLegacy[3] = "08-10";
fechaLooksLegacy[11] = "Pendiente";
assert.equal(detectAdminRowLayout(fechaLooksLegacy), "legacy");
assert.equal(mapAdminRowCanonical(fechaLooksLegacy, 0, "s").telefono, "08-10");

const faltantesNotEstado = blank();
faltantesNotEstado[3] = "08-10";
faltantesNotEstado[11] = "color";
assert.equal(detectAdminRowLayout(faltantesNotEstado), "canonical");

assert.equal(detectAdminRowLayout(leadAt({ 2: "Falta" })), "canonical", "bare Falta is not an estado, default stays canonical");
assert.equal(detectAdminRowLayout(leadAt({ 2: "Falta info extra" })), "canonical");

// ── Canonical writes: C–M, formulas sanitized, omitted nulls ────────────────

const updates = buildCanonicalAdminUpdates(
  "Admin.",
  81,
  {
    id: "MAN-1",
    estado: "Falta info",
    fecha: "08-10",
    cliente: "Ana",
    origen: "VW",
    telefono: "099",
    zona: "Salto",
    consulta: '=HYPERLINK("http://evil")',
    interpretacion: "lead_vw",
    respuesta: " sin precio",
    faltantes: "\t=cmd",
    link: " =IMPORTXML(\"x\")",
  },
  sanitizeCellValue,
);
const byRange = Object.fromEntries(updates.map((u) => [u.range, u.values[0][0]]));
assert.deepEqual(Object.keys(byRange), [
  "'Admin.'!A81",
  "'Admin.'!C81",
  "'Admin.'!D81",
  "'Admin.'!E81",
  "'Admin.'!F81",
  "'Admin.'!G81",
  "'Admin.'!H81",
  "'Admin.'!I81",
  "'Admin.'!J81",
  "'Admin.'!K81",
  "'Admin.'!L81",
  "'Admin.'!M81",
]);
assert.equal(byRange["'Admin.'!C81"], "Falta info");
assert.equal(byRange["'Admin.'!I81"], `'=HYPERLINK("http://evil")`);
assert.equal(byRange["'Admin.'!J81"], "lead_vw");
assert.equal(byRange["'Admin.'!K81"], " sin precio", "respuesta is K, not J");
assert.equal(byRange["'Admin.'!L81"], "'\t=cmd");
assert.equal(byRange["'Admin.'!M81"], `' =IMPORTXML("x")`);
assert.ok(!updates.some((u) => u.range.includes("!B81")));

const omitted = buildCanonicalAdminUpdates("Ad'min.", 4, {
  estado: "",
  consulta: null,
  respuesta: undefined,
});
assert.deepEqual(omitted.map((u) => u.range), ["'Admin.'!C4"]);
assert.equal(omitted[0].values[0][0], "", "empty string is written; null and undefined are omitted");

assert.equal(formatAdminFecha(new Date(2026, 9, 8)), "08-10");
assert.equal(formatAdminFecha(new Date(2026, 0, 3)), "03-01");
assert.equal(formatAdminFecha("not-a-date"), "");

// ── Route wiring: row-create reads A2:M200 and batch-updates, never appends ─

const wolfSrc = fs.readFileSync(path.join(ROOT, "server/routes/wolfboard.js"), "utf8");
const rowCreate = wolfSrc.slice(
  wolfSrc.indexOf('router.post("/row-create"'),
  wolfSrc.indexOf('router.post("/enviados"'),
);
assert.ok(rowCreate.includes('router.post("/row-create"'));
assert.match(rowCreate, /A2:M200/);
assert.match(rowCreate, /findNextWorkingSetRow/);
assert.match(rowCreate, /buildCanonicalAdminUpdates/);
assert.match(rowCreate, /values\.batchUpdate/);
assert.doesNotMatch(rowCreate, /values\.append/);
assert.doesNotMatch(rowCreate, /insertDataOption/);

const rowUpdate = wolfSrc.slice(
  wolfSrc.indexOf('router.post("/row"'),
  wolfSrc.indexOf('router.post("/row-create"'),
);
const canonAt = rowUpdate.indexOf("if (canonical)");
const elseAt = rowUpdate.indexOf("} else {", canonAt);
assert.ok(canonAt > 0 && elseAt > canonAt);
const canonBlock = rowUpdate.slice(canonAt, elseAt);
const elseBlock = rowUpdate.slice(elseAt);
assert.match(canonBlock, /buildCanonicalAdminUpdates/);
assert.match(canonBlock, /interpretacion/);
assert.match(canonBlock, /respuestaAi/);
assert.match(canonBlock, /faltantes/);
assert.doesNotMatch(canonBlock, /!J\$\{adminRow\}/);
assert.match(elseBlock, /!J\$\{adminRow\}/);
assert.match(elseBlock, /!L\$\{adminRow\}/);

console.log("adminLeadWorkingSetGates.test.js ok");
