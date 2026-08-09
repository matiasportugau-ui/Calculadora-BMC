/**
 * Unit tests for adjuntoInfer (proxy-first path helpers + messaging).
 */
import assert from "node:assert/strict";
import {
  classifyAdjuntoHost,
  extractGoogleDriveFileId,
  formatAdjuntoProxyError,
  getAdjuntoBadge,
  shouldSkipBrowserAdjuntoFetch,
  summarizeAdjuntoInfer,
  toFetchablePdfUrl,
  inferPanelsAndAccessoriesFromPdf,
} from "../src/utils/logistica/adjuntoInfer.js";

console.log("adjuntoInfer — classify / drive id / fetchable");

assert.equal(classifyAdjuntoHost("https://drive.google.com/file/d/abc/view"), "drive");
assert.equal(classifyAdjuntoHost("https://www.dropbox.com/s/x/file.pdf?dl=0"), "dropbox");
assert.equal(classifyAdjuntoHost("https://example.com/a.pdf"), "other");
assert.equal(shouldSkipBrowserAdjuntoFetch("https://drive.google.com/file/d/abc/view"), true);
assert.equal(shouldSkipBrowserAdjuntoFetch("https://www.dropbox.com/s/x/file.pdf"), false);

assert.equal(extractGoogleDriveFileId("https://drive.google.com/file/d/ABC123/view"), "ABC123");
const dbx = toFetchablePdfUrl("https://www.dropbox.com/s/abc/file.pdf?dl=0");
assert.ok(dbx.includes("dl=1"), "dropbox forces dl=1");

console.log("adjuntoInfer — error messages");
assert.match(formatAdjuntoProxyError("Unauthorized"), /no autorizado/i);
assert.match(formatAdjuntoProxyError("drive_fetch_status", { status: 403 }), /403/);
assert.match(formatAdjuntoProxyError("file_too_large"), /grande/i);

console.log("adjuntoInfer — summarize + badge");
assert.match(
  summarizeAdjuntoInfer({
    ok: true,
    source: "adjunto_proxy",
    paneles: [{}],
    accesorios: [],
    warnings: [],
  }),
  /proxy/i,
);
assert.equal(getAdjuntoBadge({ pdfLink: "" }).label, "Sin adjunto");
assert.equal(
  getAdjuntoBadge({
    pdfLink: "https://x",
    adjuntoMeta: { source: "adjunto_failed", ok: false },
  }).tone,
  "danger",
);

console.log("adjuntoInfer — proxy success path");
const fakePdf = new TextEncoder().encode("%PDF-1.4 panel 50mm");
const b64 = Buffer.from(fakePdf).toString("base64");
const proxyOk = await inferPanelsAndAccessoriesFromPdf("https://www.dropbox.com/s/x/file.pdf", {
  token: "tok",
  apiBase: "https://api.example",
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, base64: b64, contentType: "application/pdf" }),
  }),
  extractTextFromPdfArrayBuffer: async () => ({
    text: "Panel Isodec 50mm 2x1",
    warnings: [],
  }),
  parseLogisticaFromAdjuntoText: (text) => ({
    paneles: text ? [{ tipo: "ISODEC", esp: 50 }] : [],
    accesorios: [],
    warnings: [],
  }),
});
assert.equal(proxyOk.source, "adjunto_proxy");
assert.equal(proxyOk.proxyAttempted, true);
assert.equal(proxyOk.ok, true);
assert.equal(proxyOk.paneles.length, 1);

console.log("adjuntoInfer — Drive skips browser after proxy fail");
const driveFail = await inferPanelsAndAccessoriesFromPdf(
  "https://drive.google.com/file/d/xyz/view",
  {
    token: "tok",
    apiBase: "https://api.example",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      json: async () => ({ ok: false, error: "drive_fetch_failed", message: "timeout" }),
    }),
    extractTextFromPdfArrayBuffer: async () => ({ text: "", warnings: [] }),
    parseLogisticaFromAdjuntoText: () => ({ paneles: [], accesorios: [], warnings: [] }),
  },
);
assert.equal(driveFail.source, "adjunto_failed");
assert.equal(driveFail.browserAttempted, false);
assert.equal(driveFail.proxyAttempted, true);
assert.match(driveFail.userMessage || "", /Drive|proxy/i);

console.log("adjuntoInfer — Dropbox browser fallback");
let browserCalled = false;
const dropboxBrowser = await inferPanelsAndAccessoriesFromPdf(
  "https://www.dropbox.com/s/abc/file.pdf?dl=0",
  {
    token: "",
    apiBase: "https://api.example",
    fetchImpl: async (url, init) => {
      if (init?.method === "POST") {
        throw new Error("should not proxy without token");
      }
      browserCalled = true;
      const body = new TextEncoder().encode("%PDF fake");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/pdf" },
        arrayBuffer: async () => body.buffer,
      };
    },
    extractTextFromPdfArrayBuffer: async () => ({ text: "Panel 100mm", warnings: [] }),
    parseLogisticaFromAdjuntoText: (t) => ({
      paneles: t ? [{ tipo: "P", esp: 100 }] : [],
      accesorios: [],
      warnings: [],
    }),
  },
);
assert.equal(browserCalled, true);
assert.equal(dropboxBrowser.source, "adjunto_browser");
assert.equal(dropboxBrowser.ok, true);

console.log("adjuntoInfer — OK");
