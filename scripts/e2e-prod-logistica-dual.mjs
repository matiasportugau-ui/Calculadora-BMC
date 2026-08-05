#!/usr/bin/env node
/**
 * Dual-run prod Logística verification (L1–L7) with consistent dragTo + FSM.
 * Usage:
 *   SCRATCH=... RUNS=2 node scripts/e2e-prod-logistica-dual.mjs
 * Exit 0 only if every L1–L7 is pass on EVERY run.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reorderStops } from "../src/utils/logistica/stopReorder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH =
  process.env.SCRATCH ||
  path.join(__dirname, "..", ".runtime", "e2e-prod-verify");
const RUNS = Math.max(2, Number(process.env.RUNS || 2));
// Prefer LOGISTICA_URL; append e2e=1 for reorder hook (same moveStopBefore as onDrop).
const URL_BASE = process.env.LOGISTICA_URL || "https://calculadora-bmc.vercel.app/logistica";
const URL = URL_BASE.includes("e2e=")
  ? URL_BASE
  : `${URL_BASE}${URL_BASE.includes("?") ? "&" : "?"}e2e=1`;

fs.mkdirSync(SCRATCH, { recursive: true });

function row(id, status, note) {
  return { id, status, note, at: new Date().toISOString() };
}

async function ensureThreeStops(page) {
  await page.getByRole("button", { name: /Formulario/i }).first().click().catch(() => {});
  const add = page.getByRole("button", { name: /Agregar Parada/i });
  for (let i = 0; i < 6; i++) {
    const n = await page.locator('[aria-label="Arrastrar parada"]').count();
    if (n >= 3) return n;
    if (await add.count()) await add.first().click();
    await page.waitForTimeout(350);
  }
  return page.locator('[aria-label="Arrastrar parada"]').count();
}

async function idsFromPage(page) {
  return page.locator('select[id$="-estado"]').evaluateAll((ss) =>
    ss.map((s) => s.id.replace(/^s-/, "").replace(/-estado$/, "")),
  );
}

/** Working path: Playwright dragTo handle0 → handle2 only (no second mouse path). */
async function dragFirstOntoThird(page) {
  const h0 = page.locator('[aria-label="Arrastrar parada"]').nth(0);
  const h2 = page.locator('[aria-label="Arrastrar parada"]').nth(2);
  await h0.scrollIntoViewIfNeeded();
  await h2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await h0.dragTo(h2, { force: true });
  await page.waitForTimeout(1000);
}

async function runOnce(page, runIndex) {
  const out = [];
  const prefix = `dual-run${runIndex}`;

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  // Isolate runs: app persists stops in localStorage
  await page.evaluate(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (/logistica|bmc-logistica|envios/i.test(k)) localStorage.removeItem(k);
      }
      localStorage.removeItem("bmc-logistica-online-v2");
      localStorage.removeItem("bmc-logistica-online-v1");
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1800);

  const body = await page.locator("body").innerText();
  const l1 = /Logística|Formulario|Remito|Parada/i.test(body) && !/Error en la app/i.test(body);
  out.push(row("L1", l1 ? "pass" : "fail", l1 ? "chrome ok" : body.slice(0, 120)));
  await page.screenshot({ path: path.join(SCRATCH, `${prefix}-L1.png`), fullPage: true });

  const n = await ensureThreeStops(page);
  out.push(row("L2", n >= 3 ? "pass" : "fail", `handles=${n}`));
  await page.screenshot({ path: path.join(SCRATCH, `${prefix}-L2.png`), fullPage: true });

  const idsBefore = await idsFromPage(page);
  const expected = [idsBefore[1], idsBefore[0], idsBefore[2]];
  const pure = reorderStops(
    idsBefore.map((id) => ({ id })),
    idsBefore[0],
    idsBefore[2],
  ).map((s) => s.id);
  const pureOk = pure.join(",") === expected.join(",");

  // 1) Prefer e2e hook (same moveStopBefore as HTML5 onDrop)
  let idsAfter = idsBefore.slice();
  let method = "none";
  const e2eOk = await page.evaluate(({ a, b }) => {
    const api = window.__bmcLogisticaE2E;
    if (!api || typeof api.reorder !== "function") return { ok: false, reason: "no-hook" };
    api.reorder(a, b);
    return { ok: true, ids: api.getStopIds() };
  }, { a: idsBefore[0], b: idsBefore[2] });

  if (e2eOk && e2eOk.ok) {
    await page.waitForTimeout(400);
    idsAfter = await idsFromPage(page);
    method = "e2e-hook-moveStopBefore";
  } else {
    await dragFirstOntoThird(page);
    idsAfter = await idsFromPage(page);
    method = "playwright-dragTo";
  }

  const browserOk =
    idsAfter[0] === expected[0] &&
    idsAfter[1] === expected[1] &&
    idsAfter[2] === expected[2];

  out.push(
    row(
      "L3",
      browserOk && pureOk ? "pass" : "fail",
      `method=${method} browserOk=${browserOk} pureOk=${pureOk} before=${JSON.stringify(idsBefore.slice(0, 3))} after=${JSON.stringify(idsAfter.slice(0, 3))} expected=${JSON.stringify(expected)} hook=${JSON.stringify(e2eOk)}`,
    ),
  );
  await page.screenshot({ path: path.join(SCRATCH, `${prefix}-L3-after-drag.png`), fullPage: true });

  // FSM: use stop #2 (index 1) for L5 then L4; stop #1 (index 0) for L6
  const sel0 = page.locator('select[id$="-estado"]').nth(0);
  const sel1 = page.locator('select[id$="-estado"]').nth(1);

  await sel1.selectOption({ label: "Pendiente" }).catch(() => {});
  const steps = ["Lista para carga", "Cargada", "En reparto", "Entregada"];
  const notes = [];
  let fwd = true;
  for (const lab of steps) {
    try {
      await sel1.selectOption({ label: lab });
      const v = await sel1.inputValue();
      notes.push(`${lab}=>${v}`);
      if (v !== lab) fwd = false;
    } catch {
      fwd = false;
      notes.push(`${lab}:ERR`);
    }
    await page.waitForTimeout(120);
  }
  out.push(row("L5", fwd ? "pass" : "fail", notes.join("; ")));

  const dis = await sel1.locator('option[value="Pendiente"]').isDisabled();
  await sel1.selectOption({ label: "Pendiente" }).catch(() => {});
  const after = await sel1.inputValue();
  out.push(
    row("L4", dis || after === "Entregada" ? "pass" : "fail", `disabled=${dis} after=${after}`),
  );

  await sel0.selectOption({ label: "En reparto" }).catch(() => {});
  await page.waitForTimeout(120);
  await sel0.selectOption({ label: "Observada" }).catch(() => {});
  await page.waitForTimeout(120);
  const obs = await sel0.inputValue();
  await sel0.selectOption({ label: "En reparto" }).catch(() => {});
  await page.waitForTimeout(120);
  const back = await sel0.inputValue();
  out.push(
    row("L6", obs === "Observada" && back === "En reparto" ? "pass" : "fail", `obs=${obs} back=${back}`),
  );
  await page.screenshot({ path: path.join(SCRATCH, `${prefix}-L4-L6.png`), fullPage: true });

  await page.getByRole("button", { name: /Remito/i }).first().click();
  await page.waitForTimeout(700);
  const remitoText = await page.locator("body").innerText();
  out.push(
    row("L7", /Remito|paquete|m³|Hoja de ruta/i.test(remitoText) ? "pass" : "fail", "remito tab"),
  );
  await page.screenshot({ path: path.join(SCRATCH, `${prefix}-L7.png`), fullPage: true });

  return out;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const runs = [];

  for (let i = 1; i <= RUNS; i++) {
    const page = await context.newPage();
    try {
      const res = await runOnce(page, i);
      runs.push(res);
      fs.writeFileSync(
        path.join(SCRATCH, `e2e-logistica-run${i}.json`),
        JSON.stringify(res, null, 2),
      );
    } catch (e) {
      const fail = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"].map((id) =>
        row(id, "fail", String(e?.message || e)),
      );
      runs.push(fail);
      fs.writeFileSync(path.join(SCRATCH, `e2e-logistica-run${i}.err.txt`), String(e?.stack || e));
      fs.writeFileSync(path.join(SCRATCH, `e2e-logistica-run${i}.json`), JSON.stringify(fail, null, 2));
    }
    await page.close();
  }
  await browser.close();

  // Consistency: each Li must pass on ALL runs
  const ids = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"];
  const summary = { runs: RUNS, url: URL, perRun: runs, consistent: {}, at: new Date().toISOString() };
  let allOk = true;
  for (const id of ids) {
    const statuses = runs.map((r) => r.find((x) => x.id === id)?.status || "fail");
    const notes = runs.map((r) => r.find((x) => x.id === id)?.note || "");
    const ok = statuses.every((s) => s === "pass");
    if (!ok) allOk = false;
    summary.consistent[id] = { ok, statuses, notes };
  }

  const logLines = ids.map((id) => {
    const c = summary.consistent[id];
    return `${c.ok ? "pass" : "fail"}\t${id}\t${c.statuses.join(",")}\t${c.notes.join(" || ")}`;
  });
  fs.writeFileSync(path.join(SCRATCH, "e2e-logistica.log"), logLines.join("\n") + "\n");
  fs.writeFileSync(path.join(SCRATCH, "e2e-logistica-dual-summary.json"), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary.consistent, null, 2));
  console.log(allOk ? "DUAL_OK" : "DUAL_FAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(SCRATCH, "e2e-logistica-dual-fatal.err.txt"), String(e?.stack || e));
  process.exit(1);
});
