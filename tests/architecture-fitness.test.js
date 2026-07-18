/**
 * Architecture fitness sensors — computational harness for agent-safe boundaries.
 * Network-free. Fails CI if known anti-patterns reappear in hot paths.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git" || ent.name === "worktrees") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

// 1) Frontend must not embed private API keys
const srcFiles = walk(path.join(ROOT, "src"));
const keyPattern = /sk-(?:ant|proj|live|test)-[A-Za-z0-9]{12,}|OPENAI_API_KEY\s*=\s*['"][^'"]+['"]/;
for (const f of srcFiles) {
  const t = fs.readFileSync(f, "utf8");
  assert.ok(!keyPattern.test(t), `secret-like literal in frontend: ${path.relative(ROOT, f)}`);
}

// 2) No hardcoded Google Sheet spreadsheet IDs in src/ (must come from config/env)
// Allow comments and test fixtures under src only if clearly placeholders — real IDs are long base64-ish.
const sheetIdLiteral = /['"]1[A-Za-z0-9_-]{30,}['"]/g;
const allowSrc = /constants\.js|mock|fixture|test|__tests__|\.test\./i;
for (const f of srcFiles) {
  if (allowSrc.test(f)) continue;
  const t = fs.readFileSync(f, "utf8");
  const matches = t.match(sheetIdLiteral) || [];
  // Filter common false positives (hashes, long CSS-ish strings less common with leading 1)
  for (const m of matches) {
    if (/googleapis|gstatic|shopify|cdn\./i.test(t.slice(Math.max(0, t.indexOf(m) - 40), t.indexOf(m) + 80))) {
      continue;
    }
    // Soft: only flag if near "sheet" keyword
    const idx = t.indexOf(m);
    const window = t.slice(Math.max(0, idx - 80), idx + 80);
    if (/sheet|spreadsheet|SHEET_ID/i.test(window)) {
      assert.fail(`possible hardcoded sheet id near sheet keyword in ${path.relative(ROOT, f)}: ${m}`);
    }
  }
}

// 3) agentCore must not reintroduce raw TODO without module — prefer costTelemetry import
const agentCore = fs.readFileSync(path.join(ROOT, "server/lib/agentCore.js"), "utf8");
assert.ok(
  /costTelemetry|logAgentCost/.test(agentCore) || !/TODO: thread pino logger here once cost-telemetry/.test(agentCore),
  "agentCore should use costTelemetry (or remove obsolete TODO without wiring)",
);

// 4) Human gates must remain — fitness fails if finanzas unlock or requireGrant removed
assert.ok(fs.existsSync(path.join(ROOT, "server/middleware/requireGrant.js")) || /requireGrant/.test(fs.readFileSync(path.join(ROOT, "server/index.js"), "utf8")));
assert.ok(
  fs.existsSync(path.join(ROOT, "server/lib/finanzasUnlock.js")) ||
    fs.existsSync(path.join(ROOT, "src/components/hub/finanzas/FinanzasUnlockGate.jsx")),
  "finanzas human gate artifacts must remain",
);

console.log("architecture-fitness.test.js: ok");
