// ═══════════════════════════════════════════════════════════════════════════
// server/routes/pdf.js — Server-side PDF generation via Playwright/Chromium
//
// POST /api/pdf/generate
//   body: { html: string, filename?: string }
//   returns: application/pdf blob
//
// Uses the browser already bundled with Playwright — renders HTML exactly as
// window.print() would, preserving @page CSS, SVG vectors, fonts, colors.
// Falls back gracefully: if Playwright is unavailable the route returns 503
// and the client falls back to html2pdf.js.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";

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
      const { chromium } = await import("playwright");

      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Emulate print media so @page / @media print rules take effect
      await page.emulateMedia({ media: "print" });

      await page.setContent(html, { waitUntil: "networkidle" });

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
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("playwright")) {
        // Playwright not installed in this environment — client should fallback
        return res.status(503).json({ error: "pdf_renderer_unavailable" });
      }
      console.error("[pdf/generate]", err.message);
      return res.status(500).json({ error: "pdf_generation_failed" });
    } finally {
      await browser?.close().catch(() => {});
    }
  });

  return router;
}
