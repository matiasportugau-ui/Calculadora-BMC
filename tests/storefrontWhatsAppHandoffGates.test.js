// Shop WhatsApp handoff URL — BMC number fallback, encoding, no shopper phone.
// Complementary to tip storefrontVoicePack happy-path wa.me assert.
// Run: node tests/storefrontWhatsAppHandoffGates.test.js

import assert from "node:assert/strict";
import {
  buildWhatsAppHandoff,
  STOREFRONT_WA_NUMBER_DEFAULT,
} from "../server/lib/voice/storefrontVoicePack.js";

assert.equal(STOREFRONT_WA_NUMBER_DEFAULT, "59892663245");

const payload = { cliente: "Juan Pérez", consulta: "techo 10×8? flete=440 & lista=venta" };

{
  const wa = buildWhatsAppHandoff(payload);
  assert.equal(wa.ok, true);
  assert.equal(wa.telefono_bmc, STOREFRONT_WA_NUMBER_DEFAULT);
  assert.ok(wa.url.startsWith(`https://wa.me/${STOREFRONT_WA_NUMBER_DEFAULT}?text=`));
  assert.ok(wa.url.includes(encodeURIComponent("Hola, vengo del sitio de BMC (voz Panelin).")));
  assert.ok(wa.url.includes(encodeURIComponent("Soy Juan Pérez.")));
  assert.ok(wa.url.includes(encodeURIComponent("techo 10×8? flete=440 & lista=venta")));
  assert.ok(!wa.url.includes("flete=440"), "raw query must be encoded, not appended");
  assert.ok(!wa.url.includes("099"), "shopper phone is not a handoff field");
  assert.ok(!wa.url.includes("telefono"), "no telefono query");
}

{
  const wa = buildWhatsAppHandoff(payload, "");
  assert.equal(wa.telefono_bmc, STOREFRONT_WA_NUMBER_DEFAULT, "empty number → default");
  assert.ok(wa.url.includes(`wa.me/${STOREFRONT_WA_NUMBER_DEFAULT}`));
}

{
  const wa = buildWhatsAppHandoff(payload, "abc");
  assert.equal(wa.telefono_bmc, STOREFRONT_WA_NUMBER_DEFAULT, "letters-only → default");
}

{
  const wa = buildWhatsAppHandoff(payload, "+598 92 663 245");
  assert.equal(wa.telefono_bmc, "59892663245", "strip spaces and plus");
  assert.ok(wa.url.startsWith("https://wa.me/59892663245?text="));
}

{
  const wa = buildWhatsAppHandoff({ cliente: "", consulta: "" }, "59811111111");
  assert.equal(wa.ok, true);
  assert.equal(wa.telefono_bmc, "59811111111");
  assert.ok(wa.url.includes(encodeURIComponent("Hola, vengo del sitio de BMC (voz Panelin).")));
  assert.ok(!wa.url.includes("Soy "), "empty cliente is omitted");
}

{
  const wa = buildWhatsAppHandoff({ cliente: "Ana", telefono: "099162401", consulta: "IsoDec" });
  assert.ok(!wa.url.includes("099162401"), "shopper celular never lands on wa.me");
  assert.ok(!JSON.stringify(wa).includes("099162401"));
}

console.log("storefrontWhatsAppHandoffGates.test.js: ok");
