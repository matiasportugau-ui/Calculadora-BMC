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
import { existsSync } from "node:fs";
import { glob } from "node:fs/promises";
import os from "node:os";

// Locate the Chromium executable across all known installation paths.
// Cloud Run maps container users dynamically (uid may differ from Dockerfile USER),
// so os.homedir() at runtime may not match the build-time root install path.
async function findChromiumExecutable(chromium) {
  // 1. Explicit override via env var
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }

  // 2. Playwright canonical path (works when PLAYWRIGHT_BROWSERS_PATH is set
  //    and the binary was installed to that exact path as the same user)
  try {
    const playwrightPath = chromium.executablePath();
    if (existsSync(playwrightPath)) return playwrightPath;
    console.info("[pdf] chromium.executablePath() not found:", playwrightPath);
  } catch { /* playwright not installed */ }

  // 3. Glob search — covers root-installed playwright cache regardless of runtime user
  const searchRoots = [
    "/root/.cache/ms-playwright",
    "/ms-playwright",
    `${os.homedir()}/.cache/ms-playwright`,
    "/home/node/.cache/ms-playwright",
  ];
  for (const root of searchRoots) {
    if (!existsSync(root)) continue;
    for await (const f of glob("chromium-*/chrome-linux64/chrome", { cwd: root })) {
      const full = `${root}/${f}`;
      if (existsSync(full)) {
        console.info("[pdf] chromium found via glob:", full);
        return full;
      }
    }
  }

  // 4. System chromium (apk/apt install)
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    if (existsSync(p)) return p;
  }

  return null;
}

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

      const executablePath = await findChromiumExecutable(chromium);
      if (!executablePath) {
        console.error("[pdf/generate] chromium binary not found anywhere");
        return res.status(503).json({ error: "pdf_renderer_unavailable" });
      }

      console.info("[pdf/generate] launching chromium at:", executablePath);

      browser = await chromium.launch({
        executablePath,
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
      console.error("[pdf/generate] error:", err.code, err.message);
      const isUnavailable =
        err.code === "ERR_MODULE_NOT_FOUND" ||
        /executable doesn't exist/i.test(err.message) ||
        /Failed to launch/i.test(err.message) ||
        /browserType\.launch/i.test(err.message);
      if (isUnavailable) {
        return res.status(503).json({ error: "pdf_renderer_unavailable" });
      }
      return res.status(500).json({ error: "pdf_generation_failed", detail: err.message });
    } finally {
      await browser?.close().catch(() => {});
    }
  });

  return router;
}
