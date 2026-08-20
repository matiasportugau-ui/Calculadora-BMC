// tests/tenant-paneleslam.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { takeNextTenantCode } from "../server/lib/tenantBc.js";
import { WHITELABEL_BRANDS, quoteCodePrefix } from "../src/config/whitelabel.js";

test("paneleslam brand is registered and default-off without env", () => {
  assert.ok(WHITELABEL_BRANDS.paneleslam);
  assert.equal(WHITELABEL_BRANDS.paneleslam.marca, "LAM");
  assert.equal(WHITELABEL_BRANDS.paneleslam.layout, "paneleslam");
});

test("quote prefix is BMC when white-label is off", () => {
  assert.equal(quoteCodePrefix(), "BMC");
});

test("tenant counters do not share sequences", async () => {
  const seq = { bc: 0, paneleslam: 0 };
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
  const c = await takeNextTenantCode(pool, "bc");
  assert.equal(a, "BC-2026-0001");
  assert.equal(b, "LAM-2026-0001");
  assert.equal(c, "BC-2026-0002");
});

test("WHITELABEL=paneleslam forces LAM layout and prefix", () => {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", `
    process.env.VITE_WHITELABEL = "paneleslam";
    process.env.WHITELABEL = "paneleslam";
    const { WHITELABEL, WHITELABEL_LAYOUT, quoteCodePrefix } = await import("./src/config/whitelabel.js");
    const { DEFAULT_LAYOUT, isAllowedLayout } = await import("./src/pdf-templates/index.js");
    process.stdout.write(JSON.stringify({
      WHITELABEL, WHITELABEL_LAYOUT, prefix: quoteCodePrefix(), DEFAULT_LAYOUT,
      lamOk: isAllowedLayout("paneleslam"),
      bmcPdfHidden: !isAllowedLayout("bmc-pdf"),
    }));
  `], { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" });
  const line = r.stdout.split("\n").filter((l) => l.startsWith("{")).pop();
  assert.ok(line, r.stderr || r.stdout);
  const j = JSON.parse(line);
  assert.equal(j.WHITELABEL, "paneleslam");
  assert.equal(j.WHITELABEL_LAYOUT, "paneleslam");
  assert.equal(j.prefix, "LAM");
  assert.equal(j.DEFAULT_LAYOUT, "paneleslam");
  assert.equal(j.lamOk, true);
  assert.equal(j.bmcPdfHidden, true);
});
