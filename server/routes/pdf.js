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
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { requireServiceOrUser } from "../middleware/requireServiceOrUser.js";

const FALLBACK_BMC_LOGO_DATA_URL =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" role="img" aria-label="BMC Uruguay">
      <rect width="240" height="80" rx="12" fill="#12385f"/>
      <text x="24" y="48" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800">BMC</text>
      <text x="121" y="35" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700">URUGUAY</text>
      <text x="121" y="56" fill="#d6e7f7" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="600">METALOG SAS</text>
    </svg>`,
  );

function inlineBmcLogo(html) {
  const logoCandidates = [
    path.resolve(process.cwd(), "public/bmc-pdf/assets/bmc-logo.png"),
    path.resolve(process.cwd(), "dist/bmc-pdf/assets/bmc-logo.png"),
  ];
  const logoPath = logoCandidates.find((p) => existsSync(p));
  const dataUrl = logoPath
    ? `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
    : FALLBACK_BMC_LOGO_DATA_URL;

  return {
    html: html
      .replace(/src=["']\/bmc-pdf\/assets\/bmc-logo\.png["']/gi, `src="${dataUrl}"`)
      .replace(/src=["']assets\/bmc-logo\.png["']/gi, `src="${dataUrl}"`)
      .replace(/src=["'][^"']*bmc-logo\.png["']/gi, `src="${dataUrl}"`),
    source: logoPath ? "file" : "fallback",
  };
}

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

    let browser;
    try {
      // Early guard: @sparticuz/chromium ships Linux binaries only.
      // On macOS/Windows dev without explicit CHROMIUM_EXECUTABLE_PATH the spawn will ENOEXEC.
      // Client-side html2pdf fallback handles this gracefully.
      const platform = process.platform;
      const hasExplicitBinary = !!process.env.CHROMIUM_EXECUTABLE_PATH;
      if (platform !== "linux" && !hasExplicitBinary) {
        return res.status(503).json({
          ok: false,
          error: "pdf_renderer_unavailable",
          detail: "Server PDF requires Linux Chromium (prod/Cloud Run). Client fallback will be used."
        });
      }

      const executablePath =
        process.env.CHROMIUM_EXECUTABLE_PATH ||
        (await chromium.executablePath());

      // Debug: log state to Cloud Run logs so we can diagnose remotely
      console.info("[pdf] executablePath:", executablePath);
      console.info("[pdf] exists:", existsSync(executablePath));
      console.info("[pdf] chromium.headless:", chromium.headless);
      console.info("[pdf] chromium.args:", JSON.stringify(chromium.args));

      if (!existsSync(executablePath)) {
        return res.status(503).json({ ok: false, error: "pdf_renderer_unavailable", detail: `binary not found at ${executablePath}` });
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

      // When CHROMIUM_EXECUTABLE_PATH points to a system binary (e.g. /usr/bin/chromium),
      // @sparticuz/chromium args are Lambda-specific (--headless='shell', SwiftShader flags)
      // and incompatible with the distro Chromium. Use a clean standard headless arg set instead.
      const useSystemBinary = !!process.env.CHROMIUM_EXECUTABLE_PATH;

      const launchArgs = useSystemBinary
        ? [
            "--headless=new",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--disable-translate",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-first-run",
            "--safebrowsing-disable-auto-update",
            "--font-render-hinting=none",
          ]
        : [
            ...new Set([...(chromium.args || [])]),
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ];

      console.info("[pdf] useSystemBinary:", useSystemBinary, "args[0]:", launchArgs[0]);

      browser = await puppeteer.launch({
        args: launchArgs,
        defaultViewport: { width: 1280, height: 900 },
        executablePath,
        headless: useSystemBinary ? "new" : true,
      });

      const page = await browser.newPage();

      // Emulate print media so @page / @media print rules take effect
      await page.emulateMediaType("print");

      // Inline logo so puppeteer setContent always has it (no origin for / paths).
      // Handles paths used across templates: /bmc-pdf/assets/... and relative assets/...
      let processedHtml = html;
      let logoSource = null;
      try {
        const inlined = inlineBmcLogo(html);
        processedHtml = inlined.html;
        logoSource = inlined.source;
      } catch (logoErr) {
        console.warn("[pdf] logo inlining skipped:", logoErr.message);
      }
      if (logoSource) {
        console.info(`[pdf] logo inlined as data URL for reliable render (${logoSource})`);
      } else {
        console.warn("[pdf] proceeding without logo (inlining failed)");
      }

      await page.setContent(processedHtml, { waitUntil: "networkidle0", timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true, // honor @page { size; margin } rules defined in templates (e.g. 7mm 8mm)
        margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" }, // soft fallback only
      });

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
    } finally {
      await browser?.close().catch(() => {});
    }
  });

  // Lightweight metrics endpoint (admin / observability)
  router.get("/metrics", requireServiceOrUser({ role: "admin" }), (_req, res) => {
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
