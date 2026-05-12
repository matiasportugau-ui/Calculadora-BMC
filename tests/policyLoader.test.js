/**
 * Contract tests for server/lib/policyLoader.js
 * Run: node tests/policyLoader.test.js
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadCommercialPolicy,
  _resetPolicyCacheForTests,
  getIvaPct,
  getValidezHoras,
  getFleteNota,
  POLICY_DEFAULTS,
} from "../server/lib/policyLoader.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

function tmpFile(content) {
  const p = path.join(os.tmpdir(), `policy-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

group("Loads real shipped JSON", () => {
  _resetPolicyCacheForTests();
  const { policy, source } = loadCommercialPolicy({ force: true });
  assert(source === "file", "source === file");
  assert(policy.iva.pct === 22, "iva.pct === 22");
  assert(Array.isArray(policy.listas.internas), "listas.internas array");
  assert(policy.listas.publicar_nombre_publico === false, "listas.publicar_nombre_publico false");
  assert(typeof policy.disclaimers.flete_nota === "string", "flete_nota string");
});

group("Falls back to defaults when file missing", () => {
  _resetPolicyCacheForTests();
  const { policy, source } = loadCommercialPolicy({ force: true, customPath: "/nonexistent/policy.json" });
  assert(source === "defaults", "source === defaults");
  assert(policy.iva.pct === POLICY_DEFAULTS.iva.pct, "iva matches defaults");
  assert(policy.disclaimers.validez_horas === POLICY_DEFAULTS.disclaimers.validez_horas, "validez matches defaults");
});

group("Falls back when JSON is malformed", () => {
  _resetPolicyCacheForTests();
  const p = tmpFile("{not valid json");
  const { source } = loadCommercialPolicy({ force: true, customPath: p });
  assert(source === "defaults", "malformed → defaults");
  fs.unlinkSync(p);
});

group("Falls back when shape is invalid", () => {
  _resetPolicyCacheForTests();
  const p = tmpFile(JSON.stringify({ iva: { pct: "not-a-number" } }));
  const { source } = loadCommercialPolicy({ force: true, customPath: p });
  assert(source === "defaults", "bad shape → defaults");
  fs.unlinkSync(p);
});

group("Caches across calls", () => {
  _resetPolicyCacheForTests();
  loadCommercialPolicy({ force: true });
  const a = loadCommercialPolicy();
  const b = loadCommercialPolicy();
  assert(a.policy === b.policy, "same object on repeat reads");
});

group("Convenience getters", () => {
  _resetPolicyCacheForTests();
  loadCommercialPolicy({ force: true });
  assert(getIvaPct() === 22, "getIvaPct === 22");
  assert(getValidezHoras() === 48, "getValidezHoras === 48");
  assert(/flete/i.test(getFleteNota()), "getFleteNota mentions flete");
});

console.log(`\n${failed === 0 ? "✓" : "✗"} policyLoader: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
