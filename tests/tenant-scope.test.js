import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function probe(slug) {
  const r = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `
      if (${JSON.stringify(slug)}) {
        process.env.VITE_WHITELABEL = ${JSON.stringify(slug)};
        process.env.WHITELABEL = ${JSON.stringify(slug)};
      }
      const mem = new Map();
      globalThis.localStorage = {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => { mem.set(k, String(v)); },
        removeItem: (k) => { mem.delete(k); },
      };
      const scope = await import("./src/utils/tenantScope.js");
      const vars = await import("./src/utils/tenantVars.js");
      scope.writeScopedItem("calculator-config", JSON.stringify({ iva: 0.1 }), "bmc-calculator-config");
      vars.setTenantVars({ demo: ${JSON.stringify(slug || "bmc")} });
      process.stdout.write(JSON.stringify({
        slug: scope.tenantSlug(),
        calcKey: scope.tenantStorageKey("calculator-config"),
        keys: [...mem.keys()],
        vars: vars.getTenantVars(),
        label: vars.tenantVarsLabel(),
      }));
    `],
    { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" },
  );
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  if (!line) throw new Error(r.stderr || r.stdout || "no json");
  return JSON.parse(line);
}

test("BMC, BC, LAM and SmartBuilding use different storage keys and never write each other", () => {
  const bmc = probe(null);
  const bc = probe("bc");
  const lam = probe("paneleslam");
  const sb = probe("smartbuilding");
  assert.equal(bmc.slug, null);
  assert.equal(bmc.calcKey, null);
  assert.ok(bmc.keys.includes("bmc-calculator-config"));
  assert.equal(bc.calcKey, "tenant:bc:calculator-config");
  assert.equal(lam.calcKey, "tenant:paneleslam:calculator-config");
  assert.equal(sb.calcKey, "tenant:smartbuilding:calculator-config");
  assert.notEqual(bc.calcKey, lam.calcKey);
  assert.notEqual(lam.calcKey, sb.calcKey);
  assert.equal(bc.keys.some((k) => k.includes("paneleslam") || k.includes("smartbuilding")), false);
  assert.equal(lam.keys.some((k) => k.includes(":bc:") || k.includes("smartbuilding")), false);
  assert.equal(sb.keys.some((k) => k.includes(":bc:") || k.includes("paneleslam") || k === "bmc-calculator-config"), false);
  assert.equal(lam.vars.demo, "paneleslam");
  assert.equal(sb.vars.demo, "smartbuilding");
  assert.match(lam.label, /LAM/);
  assert.match(sb.label, /SMARTBUILDING/);
  assert.doesNotMatch(lam.label, /BMC|Jenerik/);
  assert.doesNotMatch(sb.label, /BMC|Jenerik|LAM/);
});
