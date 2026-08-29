/**
 * Shop KB redaction (#1166) — operator files must not leak lista venta / flete / CRM.
 * Run: node tests/knowledgeLoaderStorefront.test.js
 */
import assert from "node:assert/strict";
import {
  isUnsafeStorefrontKnowledgeLine,
  isUnsafeStorefrontQaBlock,
  redactKnowledgeForStorefront,
  STOREFRONT_KB_GUARD,
} from "../server/lib/knowledgeLoader.js";

console.log("knowledgeLoaderStorefront");

{
  const unsafe = [
    "Lista venta USD 33",
    "precio BMC interno",
    "Guardar en Google Drive",
    "Lee Google Sheets Admin",
    "abrir wolfboard",
    "fila CRM 31",
    "matriz interna de precios",
    "valor base en la calculadora",
    "costo 20 usd",
    "flete $240",
    "flete 240 USD",
    "USD 240 Montevideo",
    "USD 252 interior",
  ];
  for (const line of unsafe) {
    assert.equal(isUnsafeStorefrontKnowledgeLine(line), true, line);
  }
  const safe = [
    "ISODEC EPS 100 mm aísla λ=0,036",
    "garantía 10 años en el núcleo",
    "el flete se confirma aparte",
    "costo de instalación lo cotiza el instalador",
  ];
  for (const line of safe) {
    assert.equal(isUnsafeStorefrontKnowledgeLine(line), false, line);
  }
  console.log("  ✓ line guard drops venta/flete/CRM; keeps product facts");
}

{
  assert.equal(isUnsafeStorefrontQaBlock("flete está incluido"), false, "needs **P: marker");
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿El flete está incluido?**\nR: No."),
    true,
  );
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿El flete lo calcula la web?**\nR: Sí."),
    true,
  );
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿Puedo guardar mi cotización?**\nR: En Drive."),
    true,
  );
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿Los precios de la calculadora son los mismos?**"),
    true,
  );
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿Son los mismos que en la tienda web?**"),
    true,
  );
  assert.equal(
    isUnsafeStorefrontQaBlock("**P: ¿PIR o EPS?**\nR: PIR aísla más."),
    false,
  );
  console.log("  ✓ Q&A drop-list only when **P: matches freight/calc/store parity");
}

{
  const redacted = redactKnowledgeForStorefront(
    [
      "**P: ¿El flete está incluido?**",
      "R: No. USD 240 lista venta o USD 252 lista web.",
      "",
      "**P: ¿PIR o EPS?**",
      "R: PIR aísla más (λ=0,022).",
      "costo 18 usd en matriz interna",
      "ISODEC EPS 100 mm",
    ].join("\n"),
  );
  assert.ok(!redacted.includes("USD 240"));
  assert.ok(!redacted.includes("lista venta"));
  assert.ok(!redacted.includes("matriz interna"));
  assert.ok(redacted.includes("PIR aísla"));
  assert.ok(redacted.includes("ISODEC EPS 100 mm"));
  assert.equal(redactKnowledgeForStorefront("   "), "");
  assert.ok(STOREFRONT_KB_GUARD.includes("Never quote flete"));
  assert.ok(STOREFRONT_KB_GUARD.includes("lista web"));
  console.log("  ✓ redact drops freight Q&A + costo lines; keeps product Q&A");
}

console.log("knowledgeLoaderStorefront OK");
