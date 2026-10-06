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
// Row layout follows the LIVE Admin header (server/lib/adminSheetSchema.js):
//   A=ID B=Asig. C=Estado D=Fecha E=Cliente F=Origen G=Tel H=Zona I=Consulta
//   J=Interpretación AI K=Respuesta AI L=Datos Faltantes M=PRESUPUESTO N=Enviado
const SHEET_ID = "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0";
const sampleRow = [
  "", // A id (humans leave empty)
  "RA", // B Asig.
  "Falta info", // C Estado
  "25-09", // D Fecha
  "AB20251017135215", // E Cliente
  "ML", // F Origen (short code)
  "", // G Teléfono
  "", // H Zona
  "Hola buenas tardes tienen goteros para lisopsnel de 100m en rojo\n— Q:13663415349 · MLU757318280 · https://articulo.mercadolibre.com.uy/MLU-757318280-foo", // I Consulta
  "", // J Interpretación AI
  "", // K Respuesta AI
  "faltan medidas", // L Datos Faltantes
  "", // M PRESUPUESTO
  "FALSE", // N Enviado
];
const card = mapAdminRowToHitlCard(sampleRow, 0, { sheetId: SHEET_ID, tab: "Admin." });
assert.equal(card.admin_row, 2);
assert.equal(card.estado, "Falta info");
assert.equal(card.estado_normalized, "falta info");
assert.equal(card.actionable, true);
assert.equal(card.asig, "RA");
assert.equal(card.datos_faltantes, "faltan medidas");
assert.equal(card.enviado, false);
assert.equal(card.ml_qid, "13663415349");
assert.equal(card.ml_mlu, "757318280");
assert.ok(card.admin_sheet_url.includes(SHEET_ID));
assert.equal(card.cliente, "AB20251017135215");
// replay_snapshot_url is deprecated and always empty on the live-header reader.
assert.equal(card.replay_snapshot_url, "");

// 6. Snapshot filters non-actionable rows (Enviado + blank).
const enviadoRow = [...sampleRow];
enviadoRow[2] = "Enviado";
const blankRow = [...sampleRow];
blankRow[2] = "";
const anotherActionableRow = [
  "", "", "Cotizable", "01-09", "VICENTEVALERIA20220903180352", "ML", "", "",
  "Hola! Pared 5m — Q:13651383432 · MLU445615830", "", "", "", "", "FALSE",
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

// Mutating respuesta (now in column K = index 10) changes the ETag.
const mutated = [...anotherActionableRow];
mutated[10] = "Nueva respuesta";
const s3 = buildHitlBoardSnapshot([sampleRow, mutated], { sheetId: SHEET_ID, tab: "Admin." });
assert.notEqual(s1.etag, s3.etag);

// 8. board.json-compat projection shape.
const compat = projectBoardJsonCompat(snapshot);
assert.equal(compat.length, 2);
assert.ok(compat[0].qid, "qid required by legacy board.json consumers");
assert.equal(compat[0].source, "admin");

// 9. validateRowUpdate — happy + rejection paths.
assert.equal(validateRowUpdate({}).ok, false);
assert.equal(validateRowUpdate({ admin_row: 1 }).ok, false);
assert.equal(validateRowUpdate({ admin_row: 5 }).ok, false, "no patchable fields → 400");
const vOk = validateRowUpdate({
  admin_row: 7,
  estado: "Enviado",
  respuesta: "ok",
  interpretacion: "escenario=solo_techo",
  datos_faltantes: "faltan medidas",
  link: "https://drive.example.com/x.pdf",
});
assert.equal(vOk.ok, true);
assert.equal(vOk.admin_row, 7);
assert.equal(vOk.patch.estado, "Enviado");
assert.equal(vOk.patch.respuesta, "ok");
assert.equal(vOk.patch.interpretacion, "escenario=solo_techo");
assert.equal(vOk.patch.datos_faltantes, "faltan medidas");
assert.equal(vOk.patch.link, "https://drive.example.com/x.pdf");

// Aliases → canonical patch keys.
assert.equal(validateRowUpdate({ admin_row: 7, respuesta_ai: "x" }).patch.respuesta, "x");
assert.equal(validateRowUpdate({ admin_row: 7, interpretacion_ai: "y" }).patch.interpretacion, "y");
assert.equal(validateRowUpdate({ admin_row: 7, presupuesto: "https://x" }).patch.link, "https://x");

// replay_snapshot_url is accepted (so legacy callers don't 400) but DROPPED:
// writing it to M would overwrite PRESUPUESTO on the live header.
const vDropped = validateRowUpdate({ admin_row: 7, respuesta: "ok", replay_snapshot_url: "gs://x/replay.json" });
assert.equal(vDropped.ok, true);
assert.ok(!("replay_snapshot_url" in vDropped.patch), "replay_snapshot_url must not reach the patch");
assert.deepEqual(vDropped.dropped, ["replay_snapshot_url"]);
assert.equal(
  validateRowUpdate({ admin_row: 7, replay_snapshot_url: "gs://x" }).ok,
  false,
  "replay_snapshot_url alone must not satisfy the 'at least one patchable' rule",
);

// Long inputs are rejected.
const tooLong = "x".repeat(5000);
assert.equal(validateRowUpdate({ admin_row: 7, respuesta: tooLong }).ok, false);

// Unknown fields are ignored (require at least one patchable).
assert.equal(validateRowUpdate({ admin_row: 7, foo: "bar" }).ok, false);

// 10. computeEtag is deterministic across runs.
const payload = { counts: { a: 1 }, items: [{ admin_row: 2 }] };
assert.equal(computeEtag(payload), computeEtag(payload));

console.log("hitlAdminBoard.test.js: ok");
