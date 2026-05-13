#!/usr/bin/env node
// scripts/playwright-architecture-playground.mjs
//
// Smoke-verifies docs/team/architecture-playground.html renders correctly in a real browser:
//   - loads the file via file:// (no dev server needed)
//   - asserts the initial context diagram renders to SVG
//   - cycles through all 6 view buttons (context, containers, 4.1, 4.2, 4.3, 4.4)
//   - for each flow, toggles Actual only / Wanted only / Side-by-side
//   - for 4.3, toggles sub-tabs (a) inbound + (b) flush
//   - fails on any unexpected console / page error
//
// Run:    node scripts/playwright-architecture-playground.mjs
// Headed: HEADED=1 node scripts/playwright-architecture-playground.mjs

import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYGROUND_PATH = path.resolve(__dirname, "../docs/team/architecture-playground.html");
const FILE_URL = pathToFileURL(PLAYGROUND_PATH).href;

let passed = 0;
let failed = 0;
function assert(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function waitForDiagramRender(page, expectedAtLeast = 1, timeout = 10000) {
  await page.waitForFunction(
    (n) => {
      const nodes = document.querySelectorAll(".mermaid");
      if (nodes.length < n) return false;
      let ready = 0;
      for (const node of nodes) {
        if (node.querySelector("svg")) ready++;
      }
      return ready >= n;
    },
    expectedAtLeast,
    { timeout },
  );
}

async function clickView(page, view, expectedSvgs = 1) {
  await page.click(`.view-btn[data-view="${view}"]`);
  await page.waitForTimeout(150);
  await waitForDiagramRender(page, expectedSvgs);
}

async function clickCmp(page, cmp, expectedSvgs) {
  await page.click(`.cmp-btn[data-cmp="${cmp}"]`);
  await page.waitForTimeout(150);
  await waitForDiagramRender(page, expectedSvgs);
}

async function main() {
  const headless = process.env.HEADED !== "1";
  const browser = await chromium
    .launch({ channel: "chrome", headless })
    .catch(() => chromium.launch({ headless }));
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") jsErrors.push(`console: ${msg.text()}`);
  });

  console.log(`Loading ${FILE_URL}`);
  await page.goto(FILE_URL, { waitUntil: "load", timeout: 30000 });

  // initial context diagram
  try {
    await waitForDiagramRender(page, 1, 15000);
    const svgCount = await page.$$eval(".mermaid svg", (els) => els.length);
    assert("initial context diagram rendered", svgCount >= 1, `${svgCount} svg(s)`);
  } catch (e) {
    assert("initial context diagram rendered", false, e.message);
  }

  // each view button (overviews render 1 svg; flows in side-by-side render 2)
  const viewExpectations = [
    { v: "context", svgs: 1 },
    { v: "containers", svgs: 1 },
    { v: "4.1", svgs: 2 },
    { v: "4.2", svgs: 2 },
    { v: "4.3", svgs: 2 },
    { v: "4.4", svgs: 2 },
  ];
  for (const { v, svgs } of viewExpectations) {
    try {
      await clickView(page, v, svgs);
      const svgCount = await page.$$eval(".mermaid svg", (els) => els.length);
      assert(`view ${v} renders ≥${svgs} svg`, svgCount >= svgs, `${svgCount} svg(s)`);
    } catch (e) {
      assert(`view ${v} renders ≥${svgs} svg`, false, e.message);
    }
  }

  // compare toggles per flow
  for (const v of ["4.1", "4.2", "4.3", "4.4"]) {
    await clickView(page, v, 2);
    for (const { cmp, expected } of [
      { cmp: "actual", expected: 1 },
      { cmp: "wanted", expected: 1 },
      { cmp: "side", expected: 2 },
    ]) {
      try {
        await clickCmp(page, cmp, expected);
        const svgCount = await page.$$eval(".mermaid svg", (els) => els.length);
        assert(
          `flow ${v} cmp=${cmp} renders ${expected} svg`,
          svgCount === expected,
          `${svgCount} svg(s)`,
        );
      } catch (e) {
        assert(`flow ${v} cmp=${cmp} renders`, false, e.message);
      }
    }
  }

  // 4.3 sub-tabs (only available when actual column is visible)
  await clickView(page, "4.3", 2);
  await clickCmp(page, "actual", 1);
  for (const sub of ["b", "a"]) {
    try {
      await page.click(`.sub-tabs button[data-sub="${sub}"]`);
      await page.waitForTimeout(150);
      await waitForDiagramRender(page, 1);
      const active = await page.$eval(
        `.sub-tabs button[data-sub="${sub}"]`,
        (el) => el.classList.contains("active"),
      );
      const svgCount = await page.$$eval(".mermaid svg", (els) => els.length);
      assert(
        `4.3 sub-tab (${sub}) active + diagram rendered`,
        active && svgCount === 1,
        `active=${active} svg=${svgCount}`,
      );
    } catch (e) {
      assert(`4.3 sub-tab (${sub}) active + diagram rendered`, false, e.message);
    }
  }

  // critical console errors (filter known harmless noise)
  const criticalErrors = jsErrors.filter(
    (e) =>
      !e.includes("ResizeObserver") &&
      !e.includes("favicon") &&
      !e.includes("net::ERR_ABORTED") &&
      !e.includes("net::ERR_FILE_NOT_FOUND"),
  );
  assert(
    "no critical console/page errors",
    criticalErrors.length === 0,
    criticalErrors.join(" | "),
  );

  await browser.close();

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log(`═══════════════════════════════════════════`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
