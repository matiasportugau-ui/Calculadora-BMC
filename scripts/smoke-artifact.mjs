#!/usr/bin/env node
// Smoke test the generated artifact HTML in a headless browser.
// Verifies it loads without console errors and renders the calculator root.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT = path.resolve(__dirname, "../artifact/calculadora-bmc.html");
const URL = `file://${ARTIFACT}`;

const PW_CANDIDATES = [
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
];
const executablePath = PW_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error("[smoke] No chromium binary found under /opt/pw-browsers");
  process.exit(2);
}
console.log(`[smoke] Using browser: ${executablePath}`);

const browser = await chromium.launch({ headless: true, executablePath });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleMessages = [];
const pageErrors = [];

page.on("console", (msg) => {
  consoleMessages.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
  pageErrors.push(err.message);
});

console.log(`[smoke] Loading ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2_000);

const rootChildren = await page.evaluate(() => {
  const r = document.getElementById("root");
  return r ? r.childElementCount : -1;
});
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
const title = await page.title();

const wizardSignals = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    hasVersion: /Panelin v3\.\d+\.\d+/.test(text),
    hasWizard: /Escenario de obra/.test(text),
    hasGuardar: /Guardar/.test(text),
    hasImprimir: /Imprimir/.test(text),
    hasPanelin: /Panelin/.test(text),
    btnCount: document.querySelectorAll("button").length,
    inputCount: document.querySelectorAll("input, select, textarea").length,
  };
});
console.log(`[smoke] wizard signals: ${JSON.stringify(wizardSignals)}`);

const errors = consoleMessages.filter((m) => m.type === "error");
const warnings = consoleMessages.filter((m) => m.type === "warning");

console.log(`[smoke] title="${title}"`);
console.log(`[smoke] #root children=${rootChildren}`);
console.log(`[smoke] body text (first 200 chars): ${bodyText.slice(0, 200).replace(/\s+/g, " ")}`);
console.log(`[smoke] page errors: ${pageErrors.length}`);
pageErrors.forEach((e) => console.log(`  ERR: ${e}`));
console.log(`[smoke] console errors: ${errors.length}`);
errors.forEach((e) => console.log(`  ${e.text}`));
console.log(`[smoke] console warnings: ${warnings.length}`);
warnings.slice(0, 5).forEach((e) => console.log(`  ${e.text}`));

await browser.close();

const fatal = pageErrors.length > 0 || rootChildren <= 0;
if (fatal) {
  console.error("\n[smoke] FAIL");
  process.exit(1);
}
console.log("\n[smoke] OK — artifact loads and mounts");
