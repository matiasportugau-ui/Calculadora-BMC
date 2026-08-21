/**
 * Run: node tests/adminQuoteMatch.test.js
 */
import assert from "node:assert/strict";
import {
  normalizeUyPhone,
  nameSimilarity,
  scoreQuoteMatch,
  matchAdminQuotes,
  shouldAutoApplyMatch,
  normalizeAdminQuoteRow,
  extractPanelsFromAdminQuote,
} from "../src/utils/logistica/adminQuoteMatch.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("adminQuoteMatch");

{
  assert.equal(normalizeUyPhone("099 382 033"), "99382033");
  assert.equal(normalizeUyPhone("+598 99 382 033"), "99382033");
  assert.equal(normalizeUyPhone("099382033"), "99382033");
  ok("phone normalize UY");
}

{
  assert.ok(nameSimilarity("Luis González (Petinho)", "Luis Gonzalez Petinho") >= 0.5);
  assert.equal(nameSimilarity("Alvaro Gonzalez", "Alvaro Gonzalez"), 1);
  ok("name similarity");
}

{
  const q = { orderId: "1344059", nombre: "Luis González (Petinho)", telefono: "099 382 033" };
  const hit = scoreQuoteMatch(q, {
    orderId: "1344059",
    nombre: "Other",
    telefono: "000",
  });
  assert.ok(hit.hits.orderId);
  assert.ok(hit.score >= 0.55);
  ok("pedido exact scores high");
}

{
  const quotes = [
    { orderId: "111", nombre: "Alvaro Gonzalez", telefono: "091111111" },
    { orderId: "222", nombre: "Alvaro Gonzalez", telefono: "092222222" },
  ];
  const r = matchAdminQuotes({ orderId: "", nombre: "Alvaro Gonzalez", telefono: "" }, quotes);
  assert.equal(r.ambiguous, true);
  assert.equal(r.autoApply, false);
  ok("same name different phones → ambiguous no auto-apply");
}

{
  const quotes = [
    { orderId: "1345381", nombre: "Alvaro Gonzalez", telefono: "091111111" },
    { orderId: "999", nombre: "Alvaro Gonzalez", telefono: "092222222" },
  ];
  const r = matchAdminQuotes(
    { orderId: "1345381", nombre: "Alvaro Gonzalez", telefono: "091 111 111" },
    quotes,
  );
  assert.equal(r.autoApply, true);
  assert.equal(r.best.quote.orderId, "1345381");
  ok("unique pedido auto-applies");
}

{
  const best = {
    score: 0.2,
    hits: { orderId: false, phone: false, nameExact: true, nameFuzzy: false },
  };
  assert.equal(shouldAutoApplyMatch(best, { ambiguous: false }), false);
  ok("name-only never auto-apply");
}

{
  const n = normalizeAdminQuoteRow({ CODIGO: "C1", NOMBRE: "X", TELEFONO: "099" });
  assert.equal(n.nombre, "X");
  assert.ok(n.telefono);
  ok("normalizeAdminQuoteRow");
}

{
  const sheetsOnly = normalizeAdminQuoteRow({ CODIGO: "C1", NOMBRE: "Alvaro", LINK_COTIZACION: "https://x" });
  assert.equal(extractPanelsFromAdminQuote(sheetsOnly).length, 0);
  const withZonas = {
    techo: {
      familia: "ISODEC",
      espesor: 100,
      zonas: [
        { cantPaneles: 5, largo: 10.2 },
        { cantPaneles: 5, largo: 10.1 },
      ],
    },
  };
  const loads = extractPanelsFromAdminQuote(withZonas);
  assert.equal(loads.length, 2);
  assert.equal(loads[0].longitud, 10.2);
  assert.equal(loads[1].cantidad, 5);
  ok("extractPanelsFromAdminQuote zonas vs sheets-only");
}

console.log(`adminQuoteMatch: ${passed} passed`);
