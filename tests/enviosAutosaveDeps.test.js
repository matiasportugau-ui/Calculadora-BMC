/**
 * Pin: cloud autosave must re-run when tripRoute / wizardUi change.
 * #916 added those fields to fingerprint + draft payload but left them out of the
 * useEffect dependency array — wizard-only / route edits never dirty-triggered autosave.
 *
 * Run: node tests/enviosAutosaveDeps.test.js
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/BmcLogisticaApp.jsx"), "utf8");

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("enviosAutosaveDeps");

{
  const marker = "P5b autosave (debounced)";
  const start = src.indexOf(marker);
  assert.ok(start >= 0, "autosave effect marker present");
  const slice = src.slice(start, start + 1800);
  const depsMatch = slice.match(/\},\s*\[([\s\S]*?)\]\s*\);/);
  assert.ok(depsMatch, "autosave dependency array found");
  const deps = depsMatch[1];
  assert.match(deps, /\btripRoute\b/, "tripRoute in autosave deps");
  assert.match(deps, /\bwizardUi\b/, "wizardUi in autosave deps");
  ok("autosave deps include tripRoute + wizardUi");
}

console.log(`enviosAutosaveDeps: ${passed} passed`);
