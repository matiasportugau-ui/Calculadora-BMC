/**
 * CRM_Operativo row parse: PDF links, approval flags, ML question ids, truncation.
 * Run: node tests/crmRowParseGates.test.js
 *
 * Pins the A:AN read contract used by the dashboard. A display label in the
 * PDF cell must not be treated as a URL, and a row that stops before column AN
 * must stay marked truncated.
 */
import assert from "node:assert/strict";
import {
  parseCrmRowAtoAK,
  extractMlQuestionId,
  isSi,
} from "../server/lib/crmRowParse.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("crmRowParseGates");

function fullRow(overrides = {}) {
  const cells = Array(40).fill("");
  for (const [idx, value] of Object.entries(overrides)) cells[Number(idx)] = value;
  return [cells];
}

{
  const row = parseCrmRowAtoAK(fullRow({
    1: " 2026-05-12 ",
    2: "  Ana Pérez ",
    3: " 099 111 222 ",
    22: "ML Q:998877 y Q:1",
    33: "https://drive.google.com/file/d/abc/view",
    34: " sí ",
    36: "1",
    39: "nota AN",
  }));
  assert.equal(row.fecha, "2026-05-12");
  assert.equal(row.cliente, "Ana Pérez");
  assert.equal(row.telefono, "099 111 222");
  assert.equal(row.observaciones, "ML Q:998877 y Q:1");
  assert.equal(row.linkPresupuesto, "https://drive.google.com/file/d/abc/view");
  assert.equal(row.aprobadoEnviar, "sí");
  assert.equal(isSi(row.aprobadoEnviar), true);
  assert.equal(row.bloquearAuto, "1");
  assert.equal(isSi(row.bloquearAuto), true);
  assert.equal(row.notasTaxonomia, "nota AN");
  assert.equal(row._meta.rowLength, 40);
  assert.equal(row._meta.truncated, false);
  assert.equal(extractMlQuestionId(row.observaciones), "998877");
  ok("full A:AN row keeps PDF, first Q id, and is not truncated");
}

{
  const short = parseCrmRowAtoAK([["", "2026-01-01", "Cliente"]]);
  assert.equal(short.cliente, "Cliente");
  assert.equal(short.linkPresupuesto, null);
  assert.equal(short.notasTaxonomia, "");
  assert.equal(short._meta.rowLength, 3);
  assert.equal(short._meta.truncated, true);

  const missingAn = parseCrmRowAtoAK([Array(39).fill("x")]);
  assert.equal(missingAn._meta.rowLength, 39);
  assert.equal(missingAn._meta.truncated, true);
  assert.equal(missingAn.notasTaxonomia, "");

  const exact = parseCrmRowAtoAK([Array(40).fill("x")]);
  assert.equal(exact._meta.truncated, false);
  assert.equal(exact.notasTaxonomia, "x");
  ok("length 39 is truncated; length 40 reaches column AN");
}

{
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "44" })).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "PDF" })).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "javascript:alert(1)" })).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "HTTPS://example.com/q.pdf" })).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "ftp://files.example/q.pdf" })).linkPresupuesto, null);
  assert.equal(
    parseCrmRowAtoAK(fullRow({ 33: "  http://example.com/q.pdf  " })).linkPresupuesto,
    "http://example.com/q.pdf",
  );
  assert.equal(parseCrmRowAtoAK(fullRow({ 33: "" })).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK([[]]).linkPresupuesto, null);
  assert.equal(parseCrmRowAtoAK(null).cliente, "");
  assert.equal(parseCrmRowAtoAK(undefined)._meta.rowLength, 0);
  assert.equal(parseCrmRowAtoAK(undefined)._meta.truncated, true);
  ok("PDF cell accepts only http(s); labels and other schemes are null");
}

{
  for (const value of ["sí", "Sí", "SI", "si", "s", "yes", "YES", "true", "1", " sí "]) {
    assert.equal(isSi(value), true, value);
  }
  for (const value of ["no", "0", "2", "sí.", "y", "ok", "", null, undefined, "truee"]) {
    assert.equal(isSi(value), false, String(value));
  }
  ok("isSi accepts sí/si/s/yes/true/1 only");
}

{
  assert.equal(extractMlQuestionId("foo Q:001 bar"), "001");
  assert.equal(extractMlQuestionId("Q:1 Q:2"), "1");
  assert.equal(extractMlQuestionId("q:55"), null);
  assert.equal(extractMlQuestionId("Q: 55"), null);
  assert.equal(extractMlQuestionId("Q:"), null);
  assert.equal(extractMlQuestionId("Q:abc"), null);
  assert.equal(extractMlQuestionId(""), null);
  assert.equal(extractMlQuestionId(null), null);
  ok("ML question id is the first Q:<digits> match");
}

console.log(`crmRowParseGates: ${passed} passed`);
