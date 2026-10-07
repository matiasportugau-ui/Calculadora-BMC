// Offline. node tests/userIntentOverlapGates.test.js
// Pins tool-authorization overlaps the happy-path suite still passes if they drift.
import assert from "node:assert/strict";
import { classifyIntents } from "../server/lib/userIntentClassifier.js";

function names(message) {
  return [...classifyIntents(message)].sort();
}

assert.deepEqual(names("guardalo en la planilla"), ["sheets_write_range"]);
assert.deepEqual(names("escribilo en la planilla"), ["sheets_write_range"]);
assert.deepEqual(names("pegalo en admin"), ["sheets_write_range"]);
assert.deepEqual(names("confirma la escritura"), ["sheets_write_range"]);
assert.deepEqual(names("sí, escribi"), ["sheets_write_range"]);
assert.deepEqual(names("pegalo en crm"), ["guardar_en_crm", "sheets_write_range"]);

assert.deepEqual(names("sí, envialo"), ["email_enviar"]);
assert.deepEqual(names("envialo ya"), ["email_enviar"]);
assert.equal(names("sí, envialo").includes("enviar_whatsapp_link"), false);
assert.equal(names("sí, envialo").includes("sheets_write_range"), false);

assert.deepEqual(names("clasifica esta fila"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("clasifica contacto"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("clasifica este contacto"), []);
assert.deepEqual(names("guarda la clasificacion en crm"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("marca como proveedor en el crm"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("marca como cliente en crm"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("actualiza el tipo en el crm"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("actualiza tags en crm"), ["escribir_crm_taxonomia"]);
assert.deepEqual(names("actualiza la fila y el tipo en el crm"), ["wolfboard_actualizar_fila"]);

assert.deepEqual(names("no guardalo en CRM y envialo al cliente"), ["enviar_whatsapp_link"]);
assert.deepEqual(names("no guardalo en CRM pero envialo al cliente"), ["enviar_whatsapp_link"]);
assert.deepEqual(names("no guardalo en CRM o mandale por WhatsApp"), ["enviar_whatsapp_link"]);
assert.deepEqual(names("no guardalo en CRM mientras mandale el link"), ["enviar_whatsapp_link"]);
assert.deepEqual(names("no cancela la cotizacion mientras guardalo en CRM"), ["guardar_en_crm"]);
assert.deepEqual(names("no dar de baja la cotizacion y guardalo en CRM"), ["guardar_en_crm"]);
assert.deepEqual(names("sin guardalo en CRM"), []);
assert.deepEqual(names("dejar sin efecto la cotizacion y guardalo en CRM"), [
  "cancelar_cotizacion",
  "guardar_en_crm",
]);
assert.deepEqual(names("no envialo ya pero guardalo en CRM"), ["guardar_en_crm"]);
assert.deepEqual(names("no agregalo al presupuesto y guardalo en CRM"), ["guardar_en_crm"]);
assert.deepEqual(names("no marca como proveedor en el crm y guardalo en CRM"), ["guardar_en_crm"]);

assert.deepEqual(names(123), []);
assert.deepEqual(names(0), []);
assert.deepEqual(names(false), []);
assert.deepEqual(names({}), []);
assert.deepEqual(names(["guardalo en CRM"]), []);

console.log("userIntentOverlapGates: ok");
