// ═══════════════════════════════════════════════════════════════════════════
// server/lib/quotePdf.js — shared server-side HTML → PDF renderer.
//
// Extracted from server/routes/pdf.js so every server surface (the /api/pdf
// route, /calc/cotizar/pdf agent path, on-demand quote export) renders through
// one Chromium pipeline instead of each keeping its own copy.
//
// Prod (Cloud Run): CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
// (system binary, see server/Dockerfile). @sparticuz/chromium is the fallback
// for Linux environments without a system binary. On macOS/Windows dev the
// renderer is unavailable unless CHROMIUM_EXECUTABLE_PATH points at a local
// Chrome — callers must degrade gracefully (HTML link / client-side html2pdf).
// ═══════════════════════════════════════════════════════════════════════════

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { existsSync, readFileSync, chmodSync, statSync } from "node:fs";
import path from "node:path";

export class PdfRendererUnavailableError extends Error {
  constructor(detail) {
    super(detail || "pdf renderer unavailable on this platform");
    this.name = "PdfRendererUnavailableError";
    this.code = "pdf_renderer_unavailable";
  }
}

/**
 * True when this process can launch Chromium: Linux (prod container ships a
 * binary) or an explicit CHROMIUM_EXECUTABLE_PATH (dev override).
 */
export function isPdfRendererAvailable() {
  return process.platform === "linux" || !!process.env.CHROMIUM_EXECUTABLE_PATH;
}

// ── Render concurrency guard ─────────────────────────────────────────────────
// Each render launches a full Chromium process (~150-300MB RSS). Agent turns,
// UI exports and the sheet pipeline can land simultaneously on one Cloud Run
// instance, so renders beyond the cap queue instead of stacking processes.
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const renderWaiters = [];

function acquireRenderSlot() {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => renderWaiters.push(resolve));
}

function releaseRenderSlot() {
  const next = renderWaiters.shift();
  if (next) next(); // hand the slot to the next waiter; activeRenders unchanged
  else activeRenders = Math.max(0, activeRenders - 1);
}

// ── Logo inlining ────────────────────────────────────────────────────────────
// puppeteer setContent has no origin, so absolute/relative asset paths used by
// the templates would 404. Inline the BMC logo as a data URL.
function inlineLogo(html) {
  try {
    const logoCandidates = [
      path.resolve(process.cwd(), "public/bmc-pdf/assets/bmc-logo.png"),
      path.resolve(process.cwd(), "dist/bmc-pdf/assets/bmc-logo.png"),
    ];
    const logoPath = logoCandidates.find((p) => existsSync(p));
    if (!logoPath) {
      console.warn("[quotePdf] proceeding without logo (file not found in container)");
      return html;
    }
    const dataUrl = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
    return html
      .replace(/src=["']\/bmc-pdf\/assets\/bmc-logo\.png["']/gi, `src="${dataUrl}"`)
      .replace(/src=["']assets\/bmc-logo\.png["']/gi, `src="${dataUrl}"`)
      .replace(/src=["'][^"']*bmc-logo\.png["']/gi, `src="${dataUrl}"`);
  } catch (logoErr) {
    console.warn("[quotePdf] logo inlining skipped:", logoErr.message);
    return html;
  }
}

async function resolveExecutablePath() {
  const executablePath =
    process.env.CHROMIUM_EXECUTABLE_PATH || (await chromium.executablePath());
  if (!existsSync(executablePath)) {
    throw new PdfRendererUnavailableError(`binary not found at ${executablePath}`);
  }
  // @sparticuz decompresses but may not chmod in all envs.
  try {
    const mode = statSync(executablePath).mode;
    if (!(mode & 0o111)) chmodSync(executablePath, 0o755);
  } catch (e) {
    console.warn("[quotePdf] chmod failed:", e.message);
  }
  return executablePath;
}

const COMMON_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
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
];

function buildLaunchConfigs(useSystemBinary) {
  if (!useSystemBinary) {
    // @sparticuz bundled binary — its own Lambda-tuned args are authoritative.
    return [
      {
        name: "sparticuz",
        headless: true,
        args: [
          ...new Set([...(chromium.args || [])]),
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      },
    ];
  }
  // System-binary path (CHROMIUM_EXECUTABLE_PATH): @sparticuz args are
  // Lambda-specific (--headless='shell', SwiftShader flags) and incompatible
  // with distro Chromium. Two configs, tried in order:
  //  1. legacy — the historical arg set; works on the Chromium versions the
  //     Cloud Run image shipped through 2026-07-03.
  //  2. modern — newer Chromium builds (Alpine image rebuilds) abort at
  //     connect ("Protocol error (Target.setDiscoverTargets): Target closed")
  //     with --headless=new/--single-process/--no-zygote; a plain puppeteer-
  //     managed headless launch works there.
  return [
    {
      name: "legacy",
      headless: "new",
      args: ["--headless=new", "--no-zygote", "--single-process", ...COMMON_ARGS],
    },
    {
      name: "modern",
      headless: true,
      args: [...COMMON_ARGS],
    },
  ];
}

/**
 * Render an HTML document to a PDF Buffer (A4, print media, @page-aware).
 *
 * @param {string} html  self-contained quote HTML
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=30000]  page load timeout
 * @returns {Promise<Buffer>}
 * @throws {PdfRendererUnavailableError} when Chromium can't run here
 */
export async function renderHtmlToPdfBuffer(html, { timeoutMs = 30000 } = {}) {
  if (!html || typeof html !== "string") {
    throw new Error("renderHtmlToPdfBuffer: html (string) is required");
  }
  if (!isPdfRendererAvailable()) {
    throw new PdfRendererUnavailableError(
      "Server PDF requires Linux Chromium (prod/Cloud Run) or CHROMIUM_EXECUTABLE_PATH.",
    );
  }

  const executablePath = await resolveExecutablePath();
  const useSystemBinary = !!process.env.CHROMIUM_EXECUTABLE_PATH;
  const processedHtml = inlineLogo(html);
  const launchConfigs = buildLaunchConfigs(useSystemBinary);

  await acquireRenderSlot();
  try {
    let launchErr = null;
    for (const cfg of launchConfigs) {
      let browser;
      let page;
      // Launch/connect phase: a failure here (e.g. "Target closed" on newer
      // Chromium with the legacy flags) falls through to the next config.
      try {
        browser = await puppeteer.launch({
          args: cfg.args,
          defaultViewport: { width: 1280, height: 900 },
          executablePath,
          headless: cfg.headless,
        });
        page = await browser.newPage();
      } catch (err) {
        launchErr = err;
        console.warn(`[quotePdf] launch config "${cfg.name}" failed: ${err.message?.slice(0, 120)}`);
        await browser?.close().catch(() => {});
        continue;
      }
      // Render phase: failures here (bad HTML, load timeout) are NOT retried
      // on another config — they would fail the same way and double the wait.
      try {
        // Emulate print media so @page / @media print rules take effect.
        await page.emulateMediaType("print");
        // networkidle0 (prod behavior, kept as-is on Linux) never fires under
        // desktop Chrome's --headless=new on macOS/Windows dev — setContent
        // hangs until timeout. "load" is sufficient there: quote HTML is
        // self-contained (logo inlined above, styles inline).
        const waitUntil = process.platform === "linux" ? "networkidle0" : "load";
        await page.setContent(processedHtml, { waitUntil, timeout: timeoutMs });

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true, // honor @page { size; margin } rules defined in templates
          margin: { top: "6mm", right: "6mm", bottom: "6mm", left: "6mm" }, // soft fallback only
        });
        return Buffer.from(pdfBuffer);
      } finally {
        await browser?.close().catch(() => {});
      }
    }
    throw launchErr || new PdfRendererUnavailableError("no launch config succeeded");
  } finally {
    releaseRenderSlot();
  }
}

// Exposed for tests only (semaphore behavior).
export const _internal = {
  acquireRenderSlot,
  releaseRenderSlot,
  get activeRenders() {
    return activeRenders;
  },
  get queuedRenders() {
    return renderWaiters.length;
  },
  MAX_CONCURRENT_RENDERS,
};
