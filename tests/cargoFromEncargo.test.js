/**
 * Run: node tests/cargoFromEncargo.test.js
 */
import assert from "node:assert/strict";
import {
  extractFilenameFromUrl,
  parsePanelsFromFilename,
  inferCargoFromEncargoAndSheet,
} from "../src/utils/logistica/cargoFromEncargo.js";
import { sanitizeEncargoCell } from "../src/utils/logistica/ventasSheetMap.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("cargoFromEncargo");

{
  const fn = extractFilenameFromUrl(
    "https://drive.google.com/file/d/abc/view?usp=sharing",
  );
  assert.ok(typeof fn === "string");
  const fn2 = extractFilenameFromUrl(
    "https://x.com/foo/Cotizaci-n-13052026-Isopanel-100-mm-Isodec-100-mm-petinho-WA.pdf?x=1",
  );
  assert.ok(/Isopanel/i.test(fn2));
  ok("extractFilenameFromUrl");
}

{
  const r = parsePanelsFromFilename(
    "Cotizaci-n-13052026-Isopanel-100-mm-Isodec-100-mm-petinho-WA.pdf",
  );
  assert.ok(r.paneles.length >= 2, `expected ≥2 panels got ${r.paneles.length}`);
  const tipos = r.paneles.map((p) => p.tipo).sort();
  assert.ok(tipos.includes("ISOPANEL") || tipos.includes("ISODEC"));
  assert.ok(r.paneles.every((p) => p.espesor === 100));
  ok("parsePanelsFromFilename dual panels");
}

{
  const r = inferCargoFromEncargoAndSheet({
    pdf: "https://x.com/a/Isodec-150-mm-6m-foo.pdf",
    rawSheetText: "",
  });
  assert.ok(r.paneles.length >= 1);
  assert.equal(r.paneles[0].tipo, "ISODEC");
  assert.equal(r.paneles[0].espesor, 150);
  ok("inferCargoFromEncargoAndSheet");
}

{
  // Bug CH — after #985 URL sanitize, HYPERLINK label must survive into plainText
  // so autocarga still gets panels when Drive PDF bytes are unavailable.
  const cell =
    '=HYPERLINK("https://drive.google.com/file/d/1SPwE80c1aQ6HsqR1fMPAAvcuVsk0YhQv/view","Cotizacion-Isodec-100-mm-Isopanel-80-mm.pdf")';
  const san = sanitizeEncargoCell(cell);
  assert.ok(san.pdf.includes("drive.google.com/file/d/"));
  assert.ok(/Isodec-100-mm/i.test(san.plainText), `label lost: ${san.plainText}`);
  const r = inferCargoFromEncargoAndSheet({
    pdfLink: san.pdf,
    pdf: san.pdf,
    rawSheetText: san.plainText,
  });
  assert.ok(r.paneles.length >= 2, `expected ≥2 panels from HYPERLINK label, got ${r.paneles.length}`);
  const tipos = new Set(r.paneles.map((p) => p.tipo));
  assert.ok(tipos.has("ISODEC") && tipos.has("ISOPANEL"));
  ok("HYPERLINK label → filename cargo after sanitize (Bug CH)");
}

console.log(`cargoFromEncargo: ${passed} passed`);
