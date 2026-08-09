// ═══════════════════════════════════════════════════════════════════════════
// server/routes/pdf.js — Server-side PDF generation endpoint.
//
// POST /api/pdf/generate
//   body: { html: string, filename?: string }
//   returns: application/pdf blob
//
// Rendering lives in server/lib/quotePdf.js (shared with /calc/cotizar/pdf
// and quote export). Preserves @page CSS, SVG vectors, fonts, colors —
// identical to window.print(). Falls back gracefully: if Chromium is
// unavailable the route returns 503 and pdfGenerator.js client-side falls
// back to html2pdf.js.
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import { renderHtmlToPdfBuffer } from "../lib/quotePdf.js";

export function createPdfRouter() {
  const router = express.Router();

  // Lightweight in-memory metrics for PDF generations (Phase 0 improvement)
  const pdfMetrics = {
    totalGenerated: 0,
    totalBytes: 0,
    lastGeneratedAt: null,
    byLayout: {},
  };

  // Larger body limit for HTML payloads (SVG content can be verbose)
  router.use(express.json({ limit: "8mb" }));

  router.post("/generate", async (req, res) => {
    const { html, filename = "cotizacion.pdf", layout, quoteId } = req.body || {};

    if (!html || typeof html !== "string") {
      return res.status(400).json({ ok: false, error: "body.html (string) is required" });
    }

    const start = Date.now();

    try {
      const pdfBuffer = await renderHtmlToPdfBuffer(html, { timeoutMs: 30000 });

      const safeName = String(filename).replace(/[^\w\-. áéíóúÁÉÍÓÚñÑ]/g, "_");
      const duration = Date.now() - start;

      // Update lightweight metrics
      pdfMetrics.totalGenerated += 1;
      pdfMetrics.totalBytes += pdfBuffer.length;
      pdfMetrics.lastGeneratedAt = new Date().toISOString();
      const layoutKey = layout || 'unknown';
      pdfMetrics.byLayout[layoutKey] = (pdfMetrics.byLayout[layoutKey] || 0) + 1;

      console.info(`[pdf] generated ${safeName} | ${(pdfBuffer.length/1024).toFixed(1)}KB in ${duration}ms (layout=${layoutKey}, quoteId=${quoteId || 'n/a'})`);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Content-Length": pdfBuffer.length,
        "Cache-Control": "no-store",
        "X-PDF-Generation-Time": String(duration),
      });
      return res.send(pdfBuffer);

    } catch (err) {
      console.error("[pdf/generate] error:", err.code, err.message?.slice(0, 200));
      return res.status(503).json({ ok: false, error: "pdf_renderer_unavailable", detail: err.message?.slice(0, 120) });
    }
  });

  // Lightweight metrics endpoint (admin / observability)
  router.get("/metrics", (_req, res) => {
    res.json({
      ok: true,
      ...pdfMetrics,
      avgSizeKB: pdfMetrics.totalGenerated > 0
        ? (pdfMetrics.totalBytes / pdfMetrics.totalGenerated / 1024).toFixed(1)
        : 0,
    });
  });

  return router;
}
