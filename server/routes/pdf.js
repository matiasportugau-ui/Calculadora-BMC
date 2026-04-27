// ═══════════════════════════════════════════════════════════════════════════
// server/routes/pdf.js — Server-side PDF generation via @sparticuz/chromium
//
// POST /api/pdf/generate
//   body: { html: string, filename?: string }
//   returns: application/pdf blob
//
// Uses @sparticuz/chromium (Chromium optimized for serverless / Cloud Run).
// Preserves @page CSS, SVG vectors, fonts, colors — identical to window.print().
// Falls back gracefully: if Chromium is unavailable the route returns 503
// and pdfGenerator.js client-side falls back to html2pdf.js.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export function createPdfRouter() {
  const router = express.Router();

  // Larger body limit for HTML payloads (SVG content can be verbose)
  router.use(express.json({ limit: "8mb" }));

  router.post("/generate", async (req, res) => {
    const { html, filename = "cotizacion.pdf" } = req.body || {};

    if (!html || typeof html !== "string") {
      return res.status(400).json({ error: "body.html (string) is required" });
    }

    let browser;
    try {
      const { existsSync } = await import("node:fs");

      const executablePath =
        process.env.CHROMIUM_EXECUTABLE_PATH ||
        (await chromium.executablePath());

      // Debug: log state to Cloud Run logs so we can diagnose remotely
      console.info("[pdf] executablePath:", executablePath);
      console.info("[pdf] exists:", existsSync(executablePath));
      console.info("[pdf] chromium.headless:", chromium.headless);
      console.info("[pdf] chromium.args:", JSON.stringify(chromium.args));

      if (!existsSync(executablePath)) {
        return res.status(503).json({ error: "pdf_renderer_unavailable", detail: `binary not found at ${executablePath}` });
      }

      // Ensure executable — @sparticuz decompresses but may not chmod in all envs
      const { chmodSync, statSync } = await import("node:fs");
      try {
        const mode = statSync(executablePath).mode;
        console.info("[pdf] file mode:", mode.toString(8));
        if (!(mode & 0o111)) {
          chmodSync(executablePath, 0o755);
          console.info("[pdf] chmod 755 applied");
        }
      } catch (e) {
        console.warn("[pdf] chmod failed:", e.message);
      }

      // Cloud Run / container sandbox flags — required for headless Chromium
      const extraArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",   // /dev/shm is 64MB in Cloud Run — use /tmp instead
        "--disable-gpu",
        "--single-process",          // avoids zygote + sandbox restrictions in containers
      ];
      const launchArgs = [
        ...new Set([...(chromium.args || []), ...extraArgs]),
      ];

      browser = await puppeteer.launch({
        args: launchArgs,
        defaultViewport: chromium.defaultViewport,
        executablePath,
        headless: true,
      });

      const page = await browser.newPage();

      // Emulate print media so @page / @media print rules take effect
      await page.emulateMediaType("print");

      await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
      });

      const safeName = String(filename).replace(/[^\w\-. áéíóúÁÉÍÓÚñÑ]/g, "_");
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "no-store",
      });
      return res.send(pdfBuffer);

    } catch (err) {
      console.error("[pdf/generate] error:", err.code, err.message?.slice(0, 200));
      return res.status(503).json({ error: "pdf_renderer_unavailable", detail: err.message?.slice(0, 120) });
    } finally {
      await browser?.close().catch(() => {});
    }
  });

  return router;
}
