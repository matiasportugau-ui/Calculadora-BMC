/**
 * Public catalog/calc tools always force lista web and zero flete (#1141).
 * Complementary to storefrontVoicePack (do not re-land #1142 / #1177 HTTP).
 * Run: node tests/storefrontListaWebCatalog.test.js
 */
import assert from "node:assert/strict";
import {
  forceListaWeb,
  isPublicStorefrontTool,
  assertCaptureLead,
  assertIdentifyLead,
  stripInternalPrices,
} from "../server/lib/voice/storefrontVoicePack.js";

console.log("storefrontListaWebCatalog");

{
  for (const name of [
    "obtener_precio_panel",
    "listar_opciones_panel",
    "obtener_catalogo",
    "buscar_producto",
    "obtener_escenarios",
  ]) {
    const out = forceListaWeb(name, { lista: "venta", familia: "ISODEC_EPS" });
    assert.equal(out.lista, "web", name);
    assert.equal(out.familia, "ISODEC_EPS");
  }
  const calc = forceListaWeb("calcular_cotizacion", {
    listaPrecios: "venta",
    flete: 440,
    scenario: "solo_techo",
  });
  assert.equal(calc.listaPrecios, "web");
  assert.equal(calc.flete, 0);
  const pdf = forceListaWeb("generar_pdf", { listaPrecios: "venta", flete: 99 });
  assert.equal(pdf.listaPrecios, "web");
  assert.equal(pdf.flete, 0);

  const shop = forceListaWeb("shop_search", { lista: "venta", q: "isodec" });
  assert.equal(shop.lista, "venta", "browser shop tools are not price tools");
  assert.equal(forceListaWeb("navigate", { href: "/products/x" }).href, "/products/x");
  console.log("  ✓ catalog + calc/PDF force web + flete 0; shop tools untouched");
}

{
  assert.equal(isPublicStorefrontTool("obtener_catalogo"), true);
  assert.equal(isPublicStorefrontTool("listar_opciones_panel"), true);
  assert.equal(isPublicStorefrontTool("obtener_escenarios"), true);
  assert.equal(isPublicStorefrontTool("guardar_en_crm"), false);
  assert.equal(isPublicStorefrontTool("sheets_write_range"), false);
  assert.equal(isPublicStorefrontTool("admin_cargar_pdfs_fila"), false);
  assert.equal(isPublicStorefrontTool("archivar_pdfs_drive"), false);
  console.log("  ✓ public allowlist excludes CRM / Sheets / Admin-Drive writes");
}

{
  const noConsent = assertIdentifyLead({
    cliente: "Ana",
    telefono: "099123456",
    consent: false,
  });
  assert.equal(noConsent.ok, false);

  const noName = assertCaptureLead({
    cliente: "",
    telefono: "099123456",
    consulta: "techo IsoDec 10x8",
    consent: true,
  });
  assert.equal(noName.ok, false);

  const short = assertCaptureLead({
    cliente: "Ana",
    telefono: "099123456",
    consulta: "techo",
    consent: true,
  });
  assert.equal(short.ok, false);
  console.log("  ✓ identify/capture refuse without consent, name, or consulta");
}

{
  const stripped = stripInternalPrices([
    { sku: "ISODEC", precio_usd_m2_sin_iva: 41, precio_venta: 33, costo: 20 },
    { ok: true, flete: 12 },
  ]);
  assert.equal(stripped[0].sku, "ISODEC");
  assert.equal(stripped[0].precio_usd_m2_sin_iva, 41);
  assert.equal(stripped[0].precio_venta, undefined);
  assert.equal(stripped[0].costo, undefined);
  assert.equal(stripped[1].ok, true);
  assert.equal(stripped[1].flete, undefined);
  console.log("  ✓ stripInternalPrices walks arrays");
}

console.log("storefrontListaWebCatalog OK");
