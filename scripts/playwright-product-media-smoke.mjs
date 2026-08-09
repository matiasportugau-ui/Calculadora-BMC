#!/usr/bin/env node
/**
 * Product media smoke — mapper UI + baked resolve sanity on prod/local.
 *
 *   node scripts/playwright-product-media-smoke.mjs
 *   BASE_URL=https://calculadora-bmc.vercel.app node scripts/playwright-product-media-smoke.mjs
 */
import { chromium } from "playwright";
import {
  resolveBorderMedia,
  resolvePanelMedia,
} from "../src/data/product-media/productMediaResolve.js";

const BASE = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
  console.error("FAIL", msg);
}
function warn(msg) {
  warnings.push(msg);
  console.warn("WARN", msg);
}
function pass(msg) {
  console.log("OK  ", msg);
}

// Offline resolve (baked JSON) — no browser needed
{
  const bab = resolveBorderMedia({ borderId: "babeta_empotrar", familia: "ISODEC" });
  if (!bab.primaryImage) fail("resolve babeta_empotrar missing image");
  else if (/isowall/i.test(bab.primaryImage)) fail("babeta_empotrar resolves to isowall");
  else pass(`resolve babeta → ${bab.title || bab.handle}`);

  const panel = resolvePanelMedia({ familia: "ISODEC_EPS" });
  if (!panel.primaryImage) fail("panel ISODEC_EPS missing image");
  else pass(`resolve panel ISODEC_EPS → ${panel.title || panel.handle}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const res = await page.goto(`${BASE}/preview/product-media-mapper`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  if (!res || !res.ok()) fail(`mapper HTTP ${res?.status()}`);
  else pass(`mapper HTTP ${res.status()}`);

  await page.waitForTimeout(1500);
  const title = await page.locator("h1, .pmm__title").first().textContent().catch(() => "");
  if (!/product media mapper/i.test(title || "")) {
    // might redirect
    const url = page.url();
    if (!url.includes("product-media-mapper")) {
      fail(`mapper not loaded, url=${url} title=${title}`);
    } else warn(`title unexpected: ${title}`);
  } else pass(`mapper title: ${title.trim()}`);

  const cards = await page.locator(".pmm__card").count().catch(() => 0);
  if (cards < 40) fail(`shopify cards ${cards} < 40`);
  else pass(`shopify cards ${cards}`);

  // Selected babeta preview should not be isowall
  const previewSrc = await page
    .locator(".pmm__preview")
    .first()
    .getAttribute("src")
    .catch(() => null);
  if (previewSrc && /isowall/i.test(previewSrc)) fail(`preview isowall: ${previewSrc}`);
  else if (previewSrc) pass(`preview src ok (${previewSrc.slice(0, 60)}…)`);
  else warn("no .pmm__preview src (may need key select)");
} catch (e) {
  fail(`browser: ${e.message}`);
} finally {
  await browser.close();
}

console.log("\n---");
console.log(`failures=${failures.length} warnings=${warnings.length}`);
if (failures.length) {
  process.exit(1);
}
process.exit(0);
