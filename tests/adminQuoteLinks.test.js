import assert from "node:assert/strict";
import {
  multiLinkCell,
  buildPdfLinkCell,
  normalizePdfVariants,
} from "../server/lib/adminQuoteLinks.js";
import { isAllowedQuotePdfUrl } from "../server/lib/driveUpload.js";
import { sanitizeCellValue } from "../server/lib/sheetsCsvGuard.js";
import { VOICE_BRAIN_TOOL_ALLOWLIST } from "../server/lib/voiceBrainPack.js";

const one = buildPdfLinkCell([{ pdfUrl: "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/a.pdf" }]);
assert.equal(one.text, "🧾");
assert.equal(one.runs.length, 1);
assert.ok(one.runs[0].format.link.uri.includes("bmc-cotizaciones"));

const two = buildPdfLinkCell([
  { pdfUrl: "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/a.pdf" },
  { pdfUrl: "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/b.pdf" },
]);
assert.equal(two.text, "🧾1  🧾2");
assert.equal(two.runs.length, 2);

// Phishing / non-GCS https must not become Admin rich links.
assert.equal(buildPdfLinkCell([{ pdfUrl: "https://evil.example/fake.pdf" }]), null);
assert.equal(
  buildPdfLinkCell([
    { pdfUrl: "https://evil.example/fake.pdf" },
    { pdfUrl: "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/ok.pdf" },
  ])?.text,
  "🧾",
);

const mixed = normalizePdfVariants([
  "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/a.pdf",
  { url: "https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/b.pdf" },
]);
assert.equal(mixed.length, 2);

const cell = multiLinkCell([{ label: "A", url: "https://example.com/x" }]);
assert.equal(cell.runs[0].startIndex, 0);

assert.equal(
  isAllowedQuotePdfUrl("https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/x.pdf"),
  true,
);
assert.equal(isAllowedQuotePdfUrl("https://evil.example/x.pdf"), false);
assert.equal(isAllowedQuotePdfUrl("http://storage.googleapis.com/bmc-cotizaciones/x.pdf"), false);

// estado col L uses USER_ENTERED — leading =/+/-/@ must be neutralized.
assert.equal(sanitizeCellValue('=HYPERLINK("https://evil.example")').startsWith("'"), true);
assert.equal(sanitizeCellValue("Listo aprobación"), "Listo aprobación");

for (const n of ["admin_cargar_pdfs_fila", "archivar_pdfs_drive"]) {
  assert.ok(VOICE_BRAIN_TOOL_ALLOWLIST.includes(n), n);
}

console.log("adminQuoteLinks.test.js: ok");
