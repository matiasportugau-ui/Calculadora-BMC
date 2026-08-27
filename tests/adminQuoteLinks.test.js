import assert from "node:assert/strict";
import {
  multiLinkCell,
  buildPdfLinkCell,
  normalizePdfVariants,
  writeAdminPdfLinks,
} from "../server/lib/adminQuoteLinks.js";
import { isAllowedQuotePdfUrl } from "../server/lib/driveUpload.js";
import { VOICE_BRAIN_TOOL_ALLOWLIST, VOICE_WRITE_AUTOCONFIRM } from "../server/lib/voiceBrainPack.js";

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

for (const n of ["admin_cargar_pdfs_fila", "archivar_pdfs_drive"]) {
  assert.ok(VOICE_BRAIN_TOOL_ALLOWLIST.includes(n), n);
  assert.ok(VOICE_WRITE_AUTOCONFIRM.includes(n), `${n} voice auto-confirm`);
}
assert.ok(VOICE_WRITE_AUTOCONFIRM.includes("generar_pdf"), "generar_pdf voice auto-confirm");
for (const n of ["guardar_en_crm", "sheets_write_range", "enviar_whatsapp_link", "wa_lead_to_admin"]) {
  assert.equal(VOICE_WRITE_AUTOCONFIRM.includes(n), false, `${n} must not auto-confirm`);
}

{
  const badRow = await writeAdminPdfLinks({
    row: 1,
    pdfs: ["https://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/a.pdf"],
  });
  assert.equal(badRow.ok, false);
  assert.match(String(badRow.error || ""), /row/i);

  const noHttps = await writeAdminPdfLinks({
    row: 21,
    pdfs: ["http://storage.googleapis.com/bmc-cotizaciones/quotes/pdf/a.pdf"],
  });
  assert.equal(noHttps.ok, false);
  assert.match(String(noHttps.error || ""), /https/i);

  const empty = await writeAdminPdfLinks({ row: 21, pdfs: [] });
  assert.equal(empty.ok, false);
}

console.log("adminQuoteLinks.test.js: ok");
