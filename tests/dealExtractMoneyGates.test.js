// Offline. No model, no database. node tests/dealExtractMoneyGates.test.js
import assert from "node:assert/strict";
import { extractDealFields } from "../server/lib/omni/deals/dealExtractor.js";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

await check("European thousands become an integer and US thousands collapse", async () => {
  const eu = extractDealFields("total USD 1.500");
  assert.equal(eu.value_usd, 1500);
  assert.equal(eu.stage, "qualified");

  const euCents = extractDealFields("total USD 1.500,50");
  assert.equal(euCents.value_usd, 1500.5);

  const us = extractDealFields("total USD 1,500.50");
  assert.equal(us.value_usd, 1.5005);
  assert.equal(us.stage, "qualified");
});

await check("u$s and a bare dollar sign count, and zero or a bare number do not", async () => {
  assert.equal(extractDealFields("u$s 200").value_usd, 200);
  assert.equal(extractDealFields("U$S200").value_usd, 200);
  assert.equal(extractDealFields("$ 200").value_usd, 200);
  assert.equal(extractDealFields("USD 0").value_usd, null);
  assert.equal(extractDealFields("USD 0").stage, "lead");
  assert.equal(extractDealFields("son 1500 dolares").value_usd, null);
  assert.equal(extractDealFields("USD 1,5").value_usd, 1.5);
});

await check("pdf or propuesta overrides a parsed amount and stays proposal", async () => {
  const both = extractDealFields("techo USD 10 ver el pdf");
  assert.equal(both.value_usd, 10);
  assert.equal(both.stage, "proposal");
  assert.equal(both.confidence, 0.75);
  assert.equal(both.signals.hasQuoteIntent, true);

  const word = extractDealFields("PROPUESTAS para el techo");
  assert.equal(word.value_usd, null);
  assert.equal(word.stage, "proposal");
  assert.equal(word.title.startsWith("Cotización — "), true);
});

await check("panel intent without money stays a lead, and a greeting stays a consulta", async () => {
  const panel = extractDealFields("quiero panel", { contactName: "Ana" });
  assert.equal(panel.stage, "lead");
  assert.equal(panel.value_usd, null);
  assert.equal(panel.confidence, 0.75);
  assert.equal(panel.title, "Cotización — Ana");
  assert.equal(panel.signals.m2, false);

  const hello = extractDealFields("hola");
  assert.equal(hello.stage, "lead");
  assert.equal(hello.confidence, 0.4);
  assert.equal(hello.title, "Consulta — Cliente");
  assert.equal(hello.signals.hasQuoteIntent, false);
});

await check("square metres match with or without a space, and a long name is clipped", async () => {
  assert.equal(extractDealFields("200m2").signals.m2, true);
  assert.equal(extractDealFields("200 m²").signals.hasQuoteIntent, true);
  assert.equal(extractDealFields("200M2").stage, "lead");
  assert.equal(extractDealFields("m2 solo").signals.m2, false);

  const name = "Ñ".repeat(600);
  const titled = extractDealFields("cotización", { contactName: name });
  assert.equal(titled.title.length, 512);
  assert.equal(titled.title.startsWith("Cotización — Ñ"), true);
  assert.equal(titled.title.includes(name), false);
});

await check("empty, numeric, and null bodies authorize no amount", async () => {
  for (const body of ["", null, 12, false]) {
    const extracted = extractDealFields(body);
    assert.equal(extracted.value_usd, null);
    assert.equal(extracted.stage, "lead");
    assert.equal(extracted.signals.hasQuoteIntent, false);
    assert.equal(extracted.title, "Consulta — Cliente");
  }
});

console.log(`dealExtractMoneyGates: ${passed} passed`);
