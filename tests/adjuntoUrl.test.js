/**
 * Run: node tests/adjuntoUrl.test.js
 */
import assert from "node:assert/strict";
import {
  adjuntoUrlMissingHint,
  extractAdjuntoHttpsUrl,
  extractGoogleDriveFileId,
  isAdjuntoAllowedHost,
} from "../src/utils/logistica/adjuntoUrl.js";
import { resolveAdjuntoFetchUrl } from "../server/lib/enviosAdjuntoFetch.js";
import { inferPanelsAndAccessoriesFromPdf } from "../src/utils/logistica/adjuntoInfer.js";

console.log("adjuntoUrl — extract");

assert.equal(
  extractAdjuntoHttpsUrl("https://drive.google.com/file/d/1SPwE80c1aQ6HsqR1fMPAAvcuVsk0YhQv/view?usp=drive_link"),
  "https://drive.google.com/file/d/1SPwE80c1aQ6HsqR1fMPAAvcuVsk0YhQv/view?usp=drive_link",
);
assert.equal(extractAdjuntoHttpsUrl("Cotizacion-Alvaro.pdf"), "");
assert.ok(
  extractAdjuntoHttpsUrl("Ver PDF https://drive.google.com/file/d/1abcXYZ9999/view").includes(
    "file/d/1abcXYZ9999",
  ),
);
assert.ok(
  extractAdjuntoHttpsUrl('"https://drive.google.com/file/d/1abcXYZ9999/view"').includes("drive.google"),
);
assert.ok(
  extractAdjuntoHttpsUrl(
    '=HYPERLINK("https://drive.google.com/file/d/1abcXYZ9999/view","x.pdf")',
  ).includes("1abcXYZ9999"),
);
assert.ok(
  extractAdjuntoHttpsUrl("drive.google.com/file/d/1abcXYZ9999/view").startsWith("https://"),
);
assert.equal(extractAdjuntoHttpsUrl("https://evil.com/file.pdf"), "");
assert.equal(extractGoogleDriveFileId("https://drive.google.com/file/d/ABC/view"), "ABC");
assert.equal(isAdjuntoAllowedHost("drive.google.com"), true);
assert.equal(isAdjuntoAllowedHost("evil.com"), false);

console.log("adjuntoUrl — server resolve cleans dirty cells");
assert.equal(
  resolveAdjuntoFetchUrl("Ver https://drive.google.com/file/d/abcXYZ12345/view"),
  "https://drive.google.com/uc?export=download&id=abcXYZ12345",
);

console.log("adjuntoUrl — infer skips proxy for bare filename");
const bare = await inferPanelsAndAccessoriesFromPdf("Cotizacion-solo-nombre.pdf", {
  token: "tok",
  apiBase: "https://api.example",
  fetchImpl: async () => {
    throw new Error("should not fetch bare filename");
  },
  extractTextFromPdfArrayBuffer: async () => ({ text: "", warnings: [] }),
  parseLogisticaFromAdjuntoText: () => ({ paneles: [], accesorios: [], warnings: [] }),
});
assert.equal(bare.ok, false);
assert.equal(bare.proxyAttempted, false);
assert.match(bare.userMessage || "", /nombre de archivo|enlace|Compartir/i);
assert.match(adjuntoUrlMissingHint("x.pdf"), /nombre de archivo|HYPERLINK/i);

console.log("adjuntoUrl — OK");
