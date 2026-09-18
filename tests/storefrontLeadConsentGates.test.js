// Identify / capture_lead consent + field gates (#1198).
// Tip storefrontVoicePack pins consent:false vs happy path.
// Open #1251 pins parse ok===true after Sheets, not these validators.
// Run: node tests/storefrontLeadConsentGates.test.js

import assert from "node:assert/strict";
import {
  assertCaptureLead,
  assertIdentifyLead,
  STOREFRONT_LEAD_ORIGEN,
  STOREFRONT_CHAT_START_CONSULTA,
} from "../server/lib/voice/storefrontVoicePack.js";

const BASE = {
  cliente: "Ana Pérez",
  telefono: "099123456",
  consulta: "techo IsoDec 10x8",
  consent: true,
};

{
  const okBool = assertCaptureLead(BASE);
  assert.equal(okBool.ok, true);
  assert.equal(okBool.lead.origen, STOREFRONT_LEAD_ORIGEN);
  assert.equal(okBool.lead.consent, true);
  assert.equal(okBool.lead.cliente, "Ana Pérez");

  const okStr = assertCaptureLead({ ...BASE, consent: "true" });
  assert.equal(okStr.ok, true, "HTML checkbox often posts consent as the string true");
}

{
  for (const consent of [false, undefined, null, 1, "1", "yes", "TRUE", "True"]) {
    const r = assertCaptureLead({ ...BASE, consent });
    assert.equal(r.ok, false, `consent ${JSON.stringify(consent)} must not save a VW lead`);
    assert.match(String(r.error), /consentimiento/i);
  }
}

{
  const noName = assertCaptureLead({ ...BASE, cliente: "  " });
  assert.equal(noName.ok, false);
  assert.match(String(noName.error), /nombre/i);

  const short = assertCaptureLead({ ...BASE, consulta: "techo 1" });
  assert.equal(short.ok, false, "consulta length 7 is rejected");
  assert.match(String(short.error), /consulta/i);

  const just8 = assertCaptureLead({ ...BASE, consulta: "techo 10" });
  assert.equal(just8.ok, true, "consulta length 8 is the current floor (pin, do not raise)");

  const phone = assertCaptureLead({ ...BASE, telefono: "099" });
  assert.equal(phone.ok, false);
  assert.match(String(phone.error), /tel[eé]fono/i);
}

{
  const withPdf = assertCaptureLead({
    ...BASE,
    pdfUrl: "https://bmcuruguay.com.uy/p/1.pdf",
    zona: "Maldonado",
    quote_orientacion: "IsoDec 100",
  });
  assert.equal(withPdf.ok, true);
  assert.equal(withPdf.lead.pdf_url, "https://bmcuruguay.com.uy/p/1.pdf");
  assert.equal(withPdf.lead.zona, "Maldonado");
  assert.equal(withPdf.lead.quote_orientacion, "IsoDec 100");
  assert.equal(withPdf.lead.origen, "VW");
}

{
  const idConsent = assertIdentifyLead({
    nombre: "Ana",
    telefono: "099123456",
    consent: "true",
  });
  assert.equal(idConsent.ok, true, "identify accepts nombre alias + consent string");
  assert.equal(idConsent.lead.cliente, "Ana");
  assert.equal(idConsent.lead.consulta, STOREFRONT_CHAT_START_CONSULTA);
  assert.ok(idConsent.lead.consulta.length >= 8);
}

{
  const noConsent = assertIdentifyLead({
    cliente: "Ana",
    telefono: "099123456",
    consent: false,
  });
  assert.equal(noConsent.ok, false);
  assert.match(String(noConsent.error), /nombre y celular/i);

  const initial = assertIdentifyLead({
    cliente: "A",
    telefono: "099123456",
    consent: true,
  });
  assert.equal(initial.ok, false, "identify requires cliente length ≥ 2 (capture only checks non-empty)");
  assert.match(String(initial.error), /nombre/i);
}

console.log("storefrontLeadConsentGates.test.js: ok");
