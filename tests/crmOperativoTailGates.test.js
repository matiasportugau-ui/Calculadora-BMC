/**
 * CRM_Operativo AG–AK defaults and A1 ranges used by ML/email ingest.
 * Run: node tests/crmOperativoTailGates.test.js
 *
 * The human send-gate (AI) and the auto-block (AK) must stay "No" on new rows.
 * Ranges must target the data row, not the header, and must not overlap taxonomy.
 */
import assert from "node:assert/strict";
import {
  CRM_TAB,
  HEADER_ROW,
  FIRST_DATA_ROW,
  Col,
  defaultTailAGAK_ML,
  defaultTailAHAK,
  defaultTailAGAK_Email,
  rangeAGAK,
  rangeAHAK,
  rangeALAN,
} from "../server/lib/crmOperativoLayout.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("crmOperativoTailGates");

{
  assert.equal(CRM_TAB, "CRM_Operativo");
  assert.equal(HEADER_ROW, 3);
  assert.equal(FIRST_DATA_ROW, 4);
  assert.equal(Col.PROVIDER_IA, "AG");
  assert.equal(Col.LINK_PRESUPUESTO, "AH");
  assert.equal(Col.APROBADO_ENVIAR, "AI");
  assert.equal(Col.ENVIADO_EL, "AJ");
  assert.equal(Col.BLOQUEAR_AUTO, "AK");
  assert.equal(Col.TIPO_CONTACTO, "AL");
  assert.equal(Col.NOTAS_TAXONOMIA, "AN");
  ok("gate columns stay AG–AK and taxonomy starts at AL");
}

{
  const ml = defaultTailAGAK_ML();
  const email = defaultTailAGAK_Email();
  assert.deepEqual(ml, ["", "", "No", "", "No"]);
  assert.deepEqual(email, ["", "", "No", "", "No"]);
  assert.deepEqual(defaultTailAHAK(), ["", "No", "", "No"]);
  assert.equal(ml[2], "No");
  assert.equal(ml[4], "No");
  assert.notEqual(ml.includes("Sí"), true);
  assert.notEqual(defaultTailAHAK().includes("Sí"), true);
  ml[2] = "Sí";
  email[4] = "Sí";
  assert.equal(defaultTailAGAK_ML()[2], "No");
  assert.equal(defaultTailAGAK_Email()[4], "No");
  assert.notEqual(defaultTailAGAK_ML(), defaultTailAGAK_Email());
  ok("new rows keep send-gate and auto-block on No, and tails are fresh arrays");
}

{
  assert.equal(defaultTailAGAK_ML().length, 5);
  assert.equal(defaultTailAGAK_Email().length, 5);
  assert.equal(defaultTailAHAK().length, 4);
  assert.equal(rangeAGAK(FIRST_DATA_ROW), "'CRM_Operativo'!AG4:AK4");
  assert.equal(rangeAHAK(FIRST_DATA_ROW), "'CRM_Operativo'!AH4:AK4");
  assert.equal(rangeALAN(FIRST_DATA_ROW), "'CRM_Operativo'!AL4:AN4");
  ok("tail lengths match AG:AK, AH:AK, and AL:AN on the first data row");
}

{
  assert.notEqual(rangeAGAK(HEADER_ROW), rangeAGAK(FIRST_DATA_ROW));
  assert.equal(rangeAGAK(HEADER_ROW), "'CRM_Operativo'!AG3:AK3");
  assert.equal(rangeAGAK("4"), "'CRM_Operativo'!AG4:AK4");
  assert.equal(rangeAHAK(undefined), "'CRM_Operativo'!AHundefined:AKundefined");
  assert.equal(rangeALAN(null), "'CRM_Operativo'!ALnull:ANnull");
  assert.equal(rangeAGAK(FIRST_DATA_ROW).includes("AL"), false);
  assert.equal(rangeALAN(FIRST_DATA_ROW).includes("AK"), false);
  ok("header, missing, and string rows are not rewritten into row 4");
}

console.log(`crmOperativoTailGates: ${passed} passed`);
