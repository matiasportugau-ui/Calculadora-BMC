/**
 * Voice/storefront tool-result compaction (catalog / PDF / totals).
 * Complementary to paneliMcp.test.js calcular_cotizacion + informe smoke.
 * Run: node tests/voiceShapeStorefront.test.js
 */
import assert from "node:assert/strict";
import { shapeToolResult } from "../server/mcp/voiceShape.js";
import { stripInternalPrices } from "../server/lib/voice/storefrontVoicePack.js";

function parse(tool, raw) {
  return JSON.parse(shapeToolResult(tool, raw));
}

{
  const catalog = parse("obtener_catalogo", {
    lista: "web",
    techo: {
      ISODEC: {
        label: "IsoDec",
        espesores: { 50: { precio_venta: 99, flete: 12 }, 80: { precio_venta: 120 } },
      },
    },
    pared: {
      ISOPANEL: { nombre: "IsoPanel", precios: { 40: 55 } },
    },
  });
  assert.equal(catalog.ok, true);
  assert.equal(catalog.techo_familias[0].id, "ISODEC");
  assert.deepEqual(catalog.techo_familias[0].espesores, ["50", "80"]);
  assert.equal(catalog.pared_familias[0].label, "IsoPanel");
  const blob = JSON.stringify(catalog);
  assert.ok(!blob.includes("99"), "catalog compact drops price amounts");
  assert.ok(!blob.includes("precio_venta"));
  assert.ok(catalog.note.includes("Catálogo compactado"));
  console.log("  ✓ obtener_catalogo keeps family keys, drops price matrix");
}

{
  const html = "<html>" + "x".repeat(400) + "</html>";
  const pdfHtml = parse("obtener_pdf_html", {
    ok: true,
    pdf_id: "abc-123",
    html,
  });
  assert.equal(pdfHtml.pdf_id, "abc-123");
  assert.equal(pdfHtml.html_chars, html.length);
  assert.equal(pdfHtml.html, undefined);
  assert.ok(pdfHtml.note.includes("HTML omitido"));
  console.log("  ✓ obtener_pdf_html keeps html_chars, drops html body");
}

{
  const pdf = parse("generar_pdf", {
    ok: true,
    pdf_url: "https://storage.example/q.pdf",
    pdf_file_url: "https://storage.example/q.pdf",
    pdf_id: "quote-uuid-1",
    quote_code: "BMC-9",
    subtotalSinIVA: 100,
    IVA: 22,
    totalConIVA: 122,
    bom: [
      {
        title: "PANELES",
        items: [
          { label: "IsoDec 50", cant: 10, total: 500, precio_venta: 50 },
          { sku: "GFS30", cant: 2, total: 20 },
          { label: "CUM", cant: 1, total: 8 },
          { label: "dropped-from-sample", cant: 1, total: 1 },
        ],
      },
    ],
  });
  assert.equal(pdf.pdf_url, "https://storage.example/q.pdf");
  assert.equal(pdf.code, "BMC-9");
  assert.equal(pdf.totals.subtotalSinIVA, 100);
  assert.equal(pdf.totals.iva, 22);
  assert.equal(pdf.totals.totalConIVA, 122);
  assert.equal(pdf.bom_groups[0].item_count, 4);
  assert.equal(pdf.bom_groups[0].sample.length, 3);
  assert.equal(pdf.bom, undefined);
  console.log("  ✓ generar_pdf keeps url/code/totals, compact BOM sample");
}

{
  const lists = parse("comparar_listas", {
    ok: true,
    lista: "venta",
    totals: { totalFinal: 800 },
    allItems: [
      { sku: "ISODEC50", cant: 4, total: 200 },
      { label: "gotero", cant: 2, total: 10 },
    ],
  });
  assert.equal(lists.lista, "venta");
  assert.equal(lists.item_count, 2);
  assert.equal(lists.sample_items[0].label, "ISODEC50");
  console.log("  ✓ comparar_listas uses cotización compact (allItems sample)");
}

{
  const raw = "not-json " + "y".repeat(80);
  const out = shapeToolResult("obtener_catalogo", raw);
  assert.equal(out.startsWith("not-json "), true);
  assert.ok(!out.includes("{"));
  console.log("  ✓ invalid JSON string passes through (truncated if huge)");
}

{
  const shaped = parse("calcular_cotizacion", {
    ok: true,
    totals: { totalFinal: 50 },
    precio_venta: 999,
    flete: 40,
    flete_usd: 40,
    bom: [{ title: "PANELES", items: [{ label: "IsoDec", cant: 1, total: 50, precio_venta: 50 }] }],
  });
  const publicPayload = stripInternalPrices(shaped);
  assert.equal(publicPayload.precio_venta, undefined);
  assert.equal(publicPayload.flete, undefined);
  assert.equal(publicPayload.flete_usd, undefined);
  assert.equal(publicPayload.totals.totalFinal, 50);
  assert.equal(publicPayload.bom_groups[0].sample[0].total, 50);
  console.log("  ✓ public pipeline: shape then stripInternalPrices drops venta/flete keys");
}

console.log("voiceShapeStorefront.test.js: ok");
