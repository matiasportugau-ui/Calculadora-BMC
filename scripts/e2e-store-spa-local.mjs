#!/usr/bin/env node
/**
 * Full Store SPA S0–S6 against a live BMC API (local recommended).
 *
 * Env:
 *   BMC_API_BASE=http://127.0.0.1:3001
 *   STORE_URL=http://127.0.0.1:3100/workspace/store
 *   SCRATCH=...
 *
 * Prerequisites:
 *   - API running with DATABASE_URL + workspace migrated + dev-browser-login enabled
 *   - SPA: NEXT_PUBLIC_BMC_API_BASE=$BMC_API_BASE npm run dev -- -p 3100
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH =
  process.env.SCRATCH || path.join(__dirname, "..", ".runtime", "e2e-store");
const BMC = (process.env.BMC_API_BASE || "http://127.0.0.1:3001").replace(/\/$/, "");
const STORE =
  process.env.STORE_URL || "http://127.0.0.1:3100/workspace/store";
const STAMP = `FullVerify_${Date.now()}`;

fs.mkdirSync(SCRATCH, { recursive: true });
const results = [];
const r = (id, status, note) => {
  results.push({ id, status, note, at: new Date().toISOString() });
  console.log(`${status}\t${id}\t${note}`);
};

async function main() {
  // Preflight API
  const health = await fetch(`${BMC}/api/workspace/health`).then((x) => x.json()).catch((e) => ({ ok: false, e: String(e) }));
  if (!health.ok) {
    r("S0", "fail", `API health fail ${JSON.stringify(health)}`);
    fs.writeFileSync(path.join(SCRATCH, "e2e-store-spa.log"), results.map((x) => `${x.status}\t${x.id}\t${x.note}`).join("\n"));
    process.exit(1);
  }

  const login = await fetch(`${BMC}/api/auth/dev-browser-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));

  if (login.status !== 200 || !login.body.accessToken) {
    r("S0", "fail", `dev-login ${login.status} ${JSON.stringify(login.body)}`);
    fs.writeFileSync(path.join(SCRATCH, "e2e-store-spa.log"), results.map((x) => `${x.status}\t${x.id}\t${x.note}`).join("\n"));
    process.exit(1);
  }
  const token = login.body.accessToken;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  // Seed SPA session storage like bmcAuth
  await context.addInitScript(
    ({ token, user }) => {
      sessionStorage.setItem("pw.bmc.accessToken", token);
      sessionStorage.setItem("pw.bmc.authUser", JSON.stringify(user));
    },
    {
      token,
      user: {
        id: String(login.body.user?.id || "u"),
        email: String(login.body.user?.email || "dev@local"),
        name: login.body.user?.name || "Dev",
        role: String(login.body.role || "operator"),
      },
    },
  );

  const page = await context.newPage();
  await page.goto(STORE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(SCRATCH, "store-S0.png"), fullPage: true });

  let text = await page.locator("body").innerText();
  const hasStore = /Store comercial|Crear cliente|Nuevo cliente/i.test(text);
  const networkSeed = /BMC no disponible/i.test(text);
  r("S0", hasStore && !networkSeed ? "pass" : hasStore ? "fail" : "fail", networkSeed ? "still seed/network" : "store chrome");
  r(
    "S1",
    (await page.getByText(/Store \(clientes\)/i).count()) > 0 || hasStore ? "pass" : "fail",
    "nav",
  );

  if (networkSeed || !hasStore) {
    for (const id of ["S2", "S3", "S4", "S5", "S6"]) r(id, "fail", "SPA not talking to API");
    await browser.close();
    fs.writeFileSync(path.join(SCRATCH, "e2e-store-results.json"), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(SCRATCH, "e2e-store-spa.log"), results.map((x) => `${x.status}\t${x.id}\t${x.note}`).join("\n") + "\n");
    process.exit(1);
  }

  // Click refrescar to hydrate
  const refresh = page.getByRole("button", { name: /Refrescar API/i });
  if (await refresh.count()) {
    await refresh.click();
    await page.waitForTimeout(1500);
  }

  const custName = `Verify Cliente ${STAMP}`;
  await page.getByPlaceholder(/^Nombre$/i).first().fill(custName);
  await page.getByRole("button", { name: /Crear cliente/i }).click();
  await page.waitForTimeout(2000);
  text = await page.locator("body").innerText();
  r("S2", text.includes(custName) ? "pass" : "fail", custName);

  const qTitle = `Verify Quote ${STAMP}`;
  await page.getByPlaceholder(/Título/i).first().fill(qTitle);
  // select first real customer option if needed
  const custSelect = page.locator("select").first();
  if (await custSelect.count()) {
    const opts = await custSelect.locator("option").allTextContents();
    const match = opts.findIndex((o) => o.includes(custName));
    if (match >= 0) await custSelect.selectOption({ index: match });
  }
  await page.getByRole("button", { name: /Crear cotización/i }).click();
  await page.waitForTimeout(2000);
  text = await page.locator("body").innerText();
  r("S3", text.includes(qTitle) ? "pass" : "fail", qTitle);

  const fName = `verify-${STAMP}.pdf`;
  const fPath = `/verify/${fName}`;
  const namePlaceholders = page.getByPlaceholder(/Nombre/i);
  const countPh = await namePlaceholders.count();
  // last name field is file name
  await namePlaceholders.nth(Math.max(0, countPh - 1)).fill(fName);
  await page.getByPlaceholder(/Path o URL/i).fill(fPath);
  const qSelect = page.locator("select").nth(1);
  if (await qSelect.count()) {
    const opts = await qSelect.locator("option").allTextContents();
    const match = opts.findIndex((o) => o.includes(qTitle));
    if (match >= 0) await qSelect.selectOption({ index: match });
  }
  await page.getByRole("button", { name: /Adjuntar archivo/i }).click();
  await page.waitForTimeout(2000);
  text = await page.locator("body").innerText();
  r("S4", text.includes(fName) ? "pass" : "fail", fName);
  await page.screenshot({ path: path.join(SCRATCH, "store-S4.png"), fullPage: true });

  if (await refresh.count()) {
    await refresh.click();
    await page.waitForTimeout(2000);
  }
  text = await page.locator("body").innerText();
  r("S5", text.includes(custName) && text.includes(qTitle) ? "pass" : "fail", "after refrescar");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // re-seed token after reload? initScript runs again on new docs
  text = await page.locator("body").innerText();
  // may need hydrate click
  if (await refresh.count()) {
    await refresh.click();
    await page.waitForTimeout(2000);
    text = await page.locator("body").innerText();
  }
  r(
    "S6",
    text.includes(custName) || text.includes(qTitle) || text.includes(fName) ? "pass" : "fail",
    "after hard refresh",
  );
  await page.screenshot({ path: path.join(SCRATCH, "store-S6.png"), fullPage: true });

  // API-level get-after-set proof (same backend)
  const listC = await fetch(`${BMC}/api/workspace/customers`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((x) => x.json());
  const found = (listC.customers || []).some((c) => c.name === custName);
  r("S2_api", found ? "pass" : "fail", "list customers contains stamp");

  await browser.close();
  fs.writeFileSync(path.join(SCRATCH, "e2e-store-results.json"), JSON.stringify(results, null, 2));
  fs.writeFileSync(
    path.join(SCRATCH, "e2e-store-spa.log"),
    results.map((x) => `${x.status}\t${x.id}\t${x.note}`).join("\n") + "\n",
  );

  const core = ["S0", "S1", "S2", "S3", "S4", "S5", "S6"];
  const ok = core.every((id) => results.find((x) => x.id === id)?.status === "pass");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(SCRATCH, "e2e-store-fatal.err.txt"), String(e?.stack || e));
  process.exit(1);
});
