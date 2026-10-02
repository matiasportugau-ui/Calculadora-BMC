// hitlAdminBoard — pure helpers for the Admin. ⇄ HITL cola bridge.
// Standalone (no googleapis / no server boot).

import assert from "node:assert/strict";
import {
  isActionableEstado,
  normalizeEstado,
  parseConsultaMarkers,
  deriveTitle,
  estadoPriority,
  mapAdminRowToHitlCard,
  buildHitlBoardSnapshot,
  projectBoardJsonCompat,
  validateRowUpdate,
  computeEtag,
  ACTIONABLE_ESTADOS,
} from "../server/lib/hitlAdminBoard.js";

// 1. Estado normalization + actionable allowlist (incl. trailing-space case
//    observed in the live admin-live-2026-10-02.csv dump).
for (const good of [
  "Cotizable",
  "cotizable",
  "Pendiente",
  "Pendiente ",
  "Falta info",
  "falta_info",
  "Asignado",
  "Reclamo",
  "RECLAMO",
]) {
  assert.equal(isActionableEstado(good), true, `expected actionable: "${good}"`);
}
for (const bad of ["", "   ", "Enviado", "enviado ", "cerrado", "ganado", "Aprobado"]) {
  assert.equal(isActionableEstado(bad), false, `expected NOT actionable: "${bad}"`);
}
assert.equal(normalizeEstado("  Falta  INFO "), "falta info");
assert.equal(ACTIONABLE_ESTADOS.length, 5);

// 2. ML markers in the consulta trailer.
const markers = parseConsultaMarkers(
  "Hola me pasa precio\n— Q:13649370945 · MLU445615830 · https://articulo.mercadolibre.com.uy/MLU-445615830-foo",
);
assert.equal(markers.ml_qid, "13649370945");
assert.equal(markers.ml_mlu, "445615830");
assert.ok(markers.listing_url.startsWith("https://articulo.mercadolibre.com.uy"));

assert.deepEqual(parseConsultaMarkers("sin markers"), {});

// 3. Title derivation strips the ML trailer and truncates.
assert.equal(
  deriveTitle("Hola! Cuál podría ser el presupuesto\n— Q:13651383432 · MLU445615830 · https://x"),
  "Hola! Cuál podría ser el presupuesto",
);
assert.ok(deriveTitle("a".repeat(500)).length <= 140);

// 4. Priority ordering (Reclamo first).
assert.ok(estadoPriority("Reclamo") < estadoPriority("Cotizable"));
assert.ok(estadoPriority("Cotizable") < estadoPriority("Pendiente"));
assert.equal(estadoPriority("Enviado"), 99);

// 5. Row mapping — 0-indexed row 0 → absolute sheet row 2.
const SHEET_ID = "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0";
const sampleRow = [
  "", // A id
  "25-09", // B fecha
  "", // C
  "ML", // D telefono (placeholder)
  "AB20251017135215", // E cliente
  "ML", // F origen
  "", // G
  "", // H zona
  "Hola buenas tardes tienen goteros para lisopsnel de 100m en rojo\n— Q:13663415349 · MLU757318280 · https://articulo.mercadolibre.com.uy/MLU-757318280-foo", // I consulta
  "", // J respuesta
  "", // K link
  "Falta info", // L estado
  "", // M replay
];
const card = mapAdminRowToHitlCard(sampleRow, 0, { sheetId: SHEET_ID, tab: "Admin." });
assert.equal(card.admin_row, 2);
assert.equal(card.estado, "Falta info");
assert.equal(card.estado_normalized, "falta info");
assert.equal(card.actionable, true);
assert.equal(card.ml_qid, "13663415349");
assert.equal(card.ml_mlu, "757318280");
assert.ok(card.admin_sheet_url.includes(SHEET_ID));
assert.equal(card.cliente, "AB20251017135215");

// 6. Snapshot filters non-actionable rows (Enviado + blank).
const enviadoRow = [...sampleRow];
enviadoRow[11] = "Enviado";
const blankRow = [...sampleRow];
blankRow[11] = "";
const anotherActionableRow = [
  "", "01-09", "", "", "VICENTEVALERIA20220903180352", "ML", "", "",
  "Hola! Pared 5m — Q:13651383432 · MLU445615830", "", "", "Cotizable", "",
];
const snapshot = buildHitlBoardSnapshot(
  [sampleRow, enviadoRow, blankRow, anotherActionableRow],
  { sheetId: SHEET_ID, tab: "Admin." },
);
assert.equal(snapshot.counts.sheet_rows, 4);
assert.equal(snapshot.counts.actionable, 2, "only 2 rows must be actionable");
// Cotizable has lower priority number than Falta info → should sort first.
assert.equal(snapshot.items[0].estado_normalized, "cotizable");
assert.equal(snapshot.items[1].estado_normalized, "falta info");
assert.ok(snapshot.etag.startsWith('W/"'));
assert.ok(snapshot.counts.by_estado.cotizable >= 1);

// 7. ETag is deterministic (ignores generated_at).
const s1 = buildHitlBoardSnapshot([sampleRow, anotherActionableRow], {
  sheetId: SHEET_ID,
  tab: "Admin.",
  generatedAt: "2026-10-02T20:00:00Z",
});
const s2 = buildHitlBoardSnapshot([sampleRow, anotherActionableRow], {
  sheetId: SHEET_ID,
  tab: "Admin.",
  generatedAt: "2026-10-02T20:05:00Z",
});
assert.equal(s1.etag, s2.etag, "ETag must be stable when actionable data is unchanged");

// Mutating respuesta changes the ETag.
const mutated = [...anotherActionableRow];
mutated[9] = "Nueva respuesta";
const s3 = buildHitlBoardSnapshot([sampleRow, mutated], { sheetId: SHEET_ID, tab: "Admin." });
assert.notEqual(s1.etag, s3.etag);

// 8. board.json-compat projection shape + url precedence regression.
const compat = projectBoardJsonCompat(snapshot);
assert.equal(compat.length, 2);
assert.ok(compat[0].qid, "qid required by legacy board.json consumers");
assert.equal(compat[0].source, "admin");
// listing_url must win over sheet_id. `||` binds tighter than `?:`, so the
// original one-liner always returned the Admin sheet edit URL in prod.
{
  const withListing = projectBoardJsonCompat(
    buildHitlBoardSnapshot([sampleRow], { sheetId: SHEET_ID, tab: "Admin." }),
  );
  assert.equal(
    withListing[0].url,
    "https://articulo.mercadolibre.com.uy/MLU-757318280-foo",
    "listing_url must win over sheet fallback",
  );
  const driveOnly = [...sampleRow];
  driveOnly[8] = "Consulta sin markers ML";
  driveOnly[10] = "https://drive.google.com/file/d/abc";
  const withLink = projectBoardJsonCompat(
    buildHitlBoardSnapshot([driveOnly], { sheetId: SHEET_ID, tab: "Admin." }),
  );
  assert.equal(withLink[0].url, "https://drive.google.com/file/d/abc", "link must win over sheet fallback");
  const neither = [...sampleRow];
  neither[8] = "Consulta sin markers ni link";
  neither[10] = "";
  const withSheet = projectBoardJsonCompat(
    buildHitlBoardSnapshot([neither], { sheetId: SHEET_ID, tab: "Admin." }),
  );
  assert.equal(
    withSheet[0].url,
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`,
    "sheet fallback only when listing_url and link are empty",
  );
}

// 9. validateRowUpdate — happy + rejection paths.
assert.equal(validateRowUpdate({}).ok, false);
assert.equal(validateRowUpdate({ admin_row: 1 }).ok, false);
assert.equal(validateRowUpdate({ admin_row: 5 }).ok, false, "no patchable fields → 400");
const vOk = validateRowUpdate({ admin_row: 7, estado: "Enviado", respuesta: "ok" });
assert.equal(vOk.ok, true);
assert.equal(vOk.admin_row, 7);
assert.equal(vOk.patch.estado, "Enviado");
assert.equal(vOk.patch.respuesta, "ok");

// alias respuesta_ai → canonical respuesta.
const vAlias = validateRowUpdate({ admin_row: 7, respuesta_ai: "x" });
assert.equal(vAlias.patch.respuesta, "x");

// Long inputs are rejected.
const tooLong = "x".repeat(5000);
assert.equal(validateRowUpdate({ admin_row: 7, respuesta: tooLong }).ok, false);

// Unknown fields are ignored (require at least one patchable).
assert.equal(validateRowUpdate({ admin_row: 7, foo: "bar" }).ok, false);

// 10. computeEtag is deterministic across runs.
const payload = { counts: { a: 1 }, items: [{ admin_row: 2 }] };
assert.equal(computeEtag(payload), computeEtag(payload));

console.log("hitlAdminBoard.test.js: ok");
