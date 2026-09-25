/**
 * Voice MCP result shaping. paneliMcp only checks that WhatsApp text is under
 * 2000 chars and that an informe has a note. These pins catch a failed quote
 * spoken as success, a 800-char clip widened, catalog/informe forced ok, and
 * PDF HTML leaked into the voice context.
 *
 * Run: node tests/voiceShapeGates.test.js
 */
import assert from "node:assert/strict";
import { shapeToolResult } from "../server/mcp/voiceShape.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("voiceShapeGates");

{
  const parsed = JSON.parse(
    shapeToolResult(
      "calcular_cotizacion",
      JSON.stringify({
        ok: false,
        lista: "",
        listaPrecios: "web",
        subtotalSinIVA: 10,
        IVA: 2.2,
        totalConIVA: 12.2,
        textoWhatsApp: "x".repeat(801),
        bom: [
          {
            title: "PANELES",
            items: [
              { label: "a", cant: 1, total: 1 },
              { label: "b", cant: 2, total: 2 },
              { label: "c", cant: 3, total: 3 },
              { label: "d", cant: 4, total: 4 },
            ],
          },
        ],
      }),
    ),
  );
  assert.equal(parsed.ok, false);
  assert.equal(parsed.lista, "web");
  assert.deepEqual(parsed.totals, { subtotalSinIVA: 10, iva: 2.2, totalConIVA: 12.2 });
  assert.equal(parsed.bom_groups[0].item_count, 4);
  assert.equal(parsed.bom_groups[0].sample.length, 3);
  assert.equal(parsed.bom_groups[0].sample.some((row) => row.label === "d"), false);
  assert.equal(parsed.textoWhatsApp.startsWith("x".repeat(800)), true);
  assert.equal(parsed.textoWhatsApp.endsWith("…[truncated 1 chars for voice]"), true);
  assert.equal(parsed.textoWhatsApp.includes("x".repeat(801)), false);
  ok("failed quote stays failed; IVA alias; clip is 800; BOM sample is 3");
}

{
  const parsed = JSON.parse(
    shapeToolResult("comparar_escenarios", {
      ok: false,
      totals: { totalFinal: 5 },
      subtotalSinIVA: 999,
      totalConIVA: 999,
    }),
  );
  assert.equal(parsed.ok, false);
  assert.equal(parsed.totals.totalFinal, 5);
  assert.equal(parsed.totals.subtotalSinIVA, undefined);
  ok("totals object wins over flat fields");
}

{
  assert.equal(shapeToolResult("calcular_cotizacion", "not-json"), "not-json");
  assert.equal(shapeToolResult("presupuesto_libre", null), "null");
  const zero = JSON.parse(shapeToolResult("generar_pdf", { ok: 0, pdf_id: "abcd-ef12-9999" }));
  assert.equal(zero.ok, true);
  assert.equal(zero.code, "abcdef12");
  const word = JSON.parse(shapeToolResult("calcular_cotizacion", { ok: "false" }));
  assert.equal(word.ok, true);
  ok("bad JSON stays raw; ok is only exactly false");
}

{
  const items = JSON.parse(
    shapeToolResult("presupuesto_libre", {
      ok: true,
      allItems: [1, 2, 3, 4, 5, 6].map((n) => ({ sku: `S${n}`, cant: n, total: n })),
    }),
  );
  assert.equal(items.item_count, 6);
  assert.equal(items.sample_items.length, 5);
  assert.equal(items.sample_items[0].label, "S1");
  assert.equal(items.sample_items.some((row) => row.label === "S6"), false);
  ok("allItems sample keeps five and uses sku as label");
}

{
  const raw = shapeToolResult(
    "obtener_pdf_html",
    JSON.stringify({ ok: false, html: "<b>secret</b>", pdf_id: "abc" }),
  );
  assert.equal(raw.includes("<b>secret</b>"), false);
  assert.equal(raw.includes("secret"), false);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.pdf_id, "abc");
  assert.equal(parsed.html_chars, 13);
  assert.match(parsed.note, /HTML omitido/);
  ok("voice PDF result drops HTML and keeps a failed ok");
}

{
  const informe = JSON.parse(
    shapeToolResult(
      "obtener_informe_completo",
      JSON.stringify({ ok: false, lista: "venta", asesoria: { a: 1 } }),
    ),
  );
  assert.equal(informe.ok, true);
  assert.deepEqual(informe.asesoría_keys, ["a"]);
  const catalog = JSON.parse(
    shapeToolResult("obtener_catalogo", {
      ok: false,
      lista: "web",
      techo: { ISODEC: { label: "Iso", espesores: { 50: 1, 100: 2 } } },
    }),
  );
  assert.equal(catalog.ok, true);
  assert.equal(catalog.techo_familias[0].id, "ISODEC");
  assert.deepEqual(catalog.techo_familias[0].espesores, ["50", "100"]);
  assert.equal(catalog.pared_familias, null);
  ok("informe and catalog are spoken as ok even when the payload says false");
}

console.log(`voiceShapeGates: ${passed} passed`);
