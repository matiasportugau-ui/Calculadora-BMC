/**
 * Public storefront lead + lista-web gates beyond the pack smoke test.
 * Run: node tests/storefrontLeadGate.test.js
 */
import assert from "node:assert/strict";
import {
  assertCaptureLead,
  assertIdentifyLead,
  forceListaWeb,
  stripInternalPrices,
  buildWhatsAppHandoff,
  normalizeStorefrontPhone,
  STOREFRONT_LEAD_ORIGEN,
} from "../server/lib/voice/storefrontVoicePack.js";

console.log("storefrontLeadGate");

{
  assert.equal(assertCaptureLead({ cliente: "", telefono: "099123456", consulta: "techo IsoDec 10x8", consent: true }).ok, false);
  assert.equal(assertCaptureLead({ cliente: "Juan", telefono: "099123456", consulta: "techo", consent: true }).ok, false);
  assert.equal(assertCaptureLead({ cliente: "Juan", telefono: "0991234", consulta: "techo IsoDec 10x8", consent: true }).ok, false);
  assert.equal(assertCaptureLead({ cliente: "Juan", telefono: "099123456", consulta: "techo IsoDec 10x8", consent: false }).ok, false);
  const viaString = assertCaptureLead({
    cliente: "Juan",
    telefono: "099123456",
    consulta: "techo IsoDec 10x8",
    consent: "true",
    pdfUrl: "https://files.example/p.pdf",
  });
  assert.equal(viaString.ok, true);
  assert.equal(viaString.lead.origen, STOREFRONT_LEAD_ORIGEN);
  assert.equal(viaString.lead.pdf_url, "https://files.example/p.pdf");
  console.log("  ✓ capture_lead rejects missing name/short consulta/short phone; consent string + pdfUrl");
}

{
  assert.equal(assertIdentifyLead({ cliente: "Ana", telefono: "099123456", consent: false }).ok, false);
  const named = assertIdentifyLead({ nombre: "Ana", telefono: "099123456", consent: true });
  assert.equal(named.ok, true);
  assert.equal(named.lead.cliente, "Ana");
  assert.match(named.lead.consulta, /Chat tienda Panelin/);
  console.log("  ✓ identify requires consent; accepts nombre alias");
}

{
  assert.equal(normalizeStorefrontPhone("099 162 401"), "598099162401");
  assert.equal(normalizeStorefrontPhone("99123456"), "59899123456");
  assert.equal(normalizeStorefrontPhone(""), "");
  console.log("  ✓ normalizeStorefrontPhone keeps 099… vs 8-digit prefix");
}

{
  const unknown = forceListaWeb("sheets_read_range", { lista: "venta", flete: 99 });
  assert.equal(unknown.lista, "venta");
  assert.equal(unknown.flete, 99);
  const catalog = forceListaWeb("buscar_producto", { lista: "venta", q: "isodec" });
  assert.equal(catalog.lista, "web");
  const fromNull = forceListaWeb("calcular_cotizacion", null);
  assert.equal(fromNull.listaPrecios, "web");
  assert.equal(fromNull.flete, 0);
  console.log("  ✓ forceListaWeb only on catalog/calc/pdf; unknown tools untouched");
}

{
  assert.equal(stripInternalPrices(41), 41);
  const arr = stripInternalPrices([{ precio_venta: 1, ok: true }, { flete_usd: 8, sku: "A" }]);
  assert.equal(arr[0].precio_venta, undefined);
  assert.equal(arr[0].ok, true);
  assert.equal(arr[1].flete_usd, undefined);
  assert.equal(arr[1].sku, "A");
  console.log("  ✓ stripInternalPrices walks arrays; keeps primitives");
}

{
  const wa = buildWhatsAppHandoff({ cliente: "Juan", consulta: "techo 10x8" }, "+598 92 663 245");
  assert.ok(wa.url.startsWith("https://wa.me/59892663245?text="));
  assert.equal(wa.telefono_bmc, "59892663245");
  console.log("  ✓ handoff strips letters/spaces from BMC WA number");
}

console.log("storefrontLeadGate.test.js ok");
