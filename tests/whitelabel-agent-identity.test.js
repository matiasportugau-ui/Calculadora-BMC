import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { agentIdentity, WHITELABEL_AGENT } from "../src/config/whitelabel.js";

test("BMC default is Panelin and never JenIA", () => {
  const id = agentIdentity(null);
  assert.equal(id.name, "Panelin");
  assert.equal(id.slug, null);
  assert.match(id.subtitle, /BMC/);
  assert.equal(WHITELABEL_AGENT.name, "Panelin");
});

test("BC is JenIA, LAM is MonkIA, SmartBuilding is Basuuuu IA", () => {
  assert.equal(agentIdentity("bc").name, "JenIA");
  assert.equal(agentIdentity("paneleslam").name, "MonkIA");
  assert.equal(agentIdentity("smartbuilding").name, "Basuuuu IA");
});

test("tenant identities do not mention BMC or Panelin", () => {
  for (const slug of ["bc", "paneleslam", "smartbuilding"]) {
    const id = agentIdentity(slug);
    const blob = `${id.name} ${id.subtitle} ${id.greeting} ${id.brandName}`;
    assert.doesNotMatch(blob, /Panelin|BMC|Metalog/i);
  }
});

function probe(slug) {
  const r = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `
      process.env.VITE_WHITELABEL = ${JSON.stringify(slug)};
      process.env.WHITELABEL = ${JSON.stringify(slug)};
      const m = await import("./src/config/whitelabel.js");
      process.stdout.write(JSON.stringify(m.WHITELABEL_AGENT));
    `],
    { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" },
  );
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  assert.ok(line, r.stderr || r.stdout);
  return JSON.parse(line);
}

test("WHITELABEL=bc deploy agent is JenIA", () => {
  assert.equal(probe("bc").name, "JenIA");
});

test("WHITELABEL=paneleslam deploy agent is MonkIA", () => {
  assert.equal(probe("paneleslam").name, "MonkIA");
});

test("WHITELABEL=smartbuilding deploy agent is Basuuuu IA", () => {
  assert.equal(probe("smartbuilding").name, "Basuuuu IA");
});
