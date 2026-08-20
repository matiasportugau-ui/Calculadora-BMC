// tests/tenant-smartbuilding.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { takeNextTenantCode } from "../server/lib/tenantBc.js";
import { WHITELABEL_BRANDS, quoteCodePrefix } from "../src/config/whitelabel.js";

test("smartbuilding brand is registered and default-off without env", () => {
  assert.ok(WHITELABEL_BRANDS.smartbuilding);
  assert.equal(WHITELABEL_BRANDS.smartbuilding.marca, "SMARTBUILDING");
  assert.equal(WHITELABEL_BRANDS.smartbuilding.layout, "smartbuilding");
  assert.equal(WHITELABEL_BRANDS.smartbuilding.theme.headerBg, "#0B0B0C");
});

test("quote prefix is BMC when white-label is off", () => {
  assert.equal(quoteCodePrefix(), "BMC");
});

test("tenant counters do not share sequences across BC / LAM / SMART", async () => {
  const seq = { bc: 0, paneleslam: 0, smartbuilding: 0 };
  const pool = {
    query: async (sql, params) => {
      if (/create table/i.test(sql)) return { rows: [] };
      const slug = params[0];
      seq[slug] = (seq[slug] || 0) + 1;
      return { rows: [{ seq: seq[slug], year: 2026 }] };
    },
  };
  const a = await takeNextTenantCode(pool, "bc");
  const b = await takeNextTenantCode(pool, "paneleslam");
  const c = await takeNextTenantCode(pool, "smartbuilding");
  const d = await takeNextTenantCode(pool, "smartbuilding");
  assert.equal(a, "BC-2026-0001");
  assert.equal(b, "LAM-2026-0001");
  assert.equal(c, "SMART-2026-0001");
  assert.equal(d, "SMART-2026-0002");
});

test("WHITELABEL=smartbuilding forces SB layout, prefix and theme", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "smartbuilding";
    process.env.WHITELABEL = "smartbuilding";
    const { WHITELABEL, WHITELABEL_LAYOUT, quoteCodePrefix, brandTheme } = await import("./src/config/whitelabel.js");
    const { DEFAULT_LAYOUT, isAllowedLayout } = await import("./src/pdf-templates/index.js");
    process.stdout.write(JSON.stringify({
      WHITELABEL, WHITELABEL_LAYOUT, prefix: quoteCodePrefix(), DEFAULT_LAYOUT,
      sbOk: isAllowedLayout("smartbuilding"),
      bcHidden: !isAllowedLayout("bc"),
      bmcPdfHidden: !isAllowedLayout("bmc-pdf"),
      theme: brandTheme(),
    }));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" });
  const line = r.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
  assert.ok(line, r.stderr || r.stdout);
  const j = JSON.parse(line);
  assert.equal(j.WHITELABEL, "smartbuilding");
  assert.equal(j.WHITELABEL_LAYOUT, "smartbuilding");
  assert.equal(j.prefix, "SMART");
  assert.equal(j.DEFAULT_LAYOUT, "smartbuilding");
  assert.equal(j.sbOk, true);
  assert.equal(j.bcHidden, true);
  assert.equal(j.bmcPdfHidden, true);
  assert.equal(j.theme.headerBg, "#0B0B0C");
  assert.equal(j.theme.accent, "#E4E7EB");
});

test("tenant price labels never say BMC", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "smartbuilding";
    process.env.WHITELABEL = "smartbuilding";
    const { priceListLabels } = await import("./src/config/whitelabel.js");
    process.stdout.write(JSON.stringify(priceListLabels()));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" });
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  const j = JSON.parse(line);
  assert.doesNotMatch(j.venta, /BMC/i);
  assert.doesNotMatch(j.web, /BMC/i);
});

test("white-label smartbuilding PDF uses SB mark and no BMC leak", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "smartbuilding";
    process.env.WHITELABEL = "smartbuilding";
    const m = await import("./src/pdf-templates/index.js");
    const html = await m.renderPdfLayout("smartbuilding", {
      ref: "SMART-2026-0001",
      fecha: "18/08/2026",
      escenario: "Techo",
      validez: "10 días",
      bomDetailGroups: [],
      subtotalSinIva: 10,
      ivaAmount: 2.2,
      totalConIva: 12.2,
      bmcExtra: { client: { nombre: "Obra Demo" } },
    });
    process.stdout.write(JSON.stringify({
      hasMark: html.includes("SmartBuilding") || html.includes("data:image/jpeg;base64,"),
      hasBmc: html.includes("BMC URUGUAY") || html.includes("120403430012"),
      hasTheme: html.includes("--gold:#E4E7EB") || html.includes("#0B0B0C"),
      terms: /SMARTBUILDING no asume/.test(html),
    }));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  assert.ok(line, r.stderr || r.stdout);
  const j = JSON.parse(line);
  assert.equal(j.hasMark, true);
  assert.equal(j.hasBmc, false);
  assert.equal(j.hasTheme, true);
  assert.equal(j.terms, true);
});
