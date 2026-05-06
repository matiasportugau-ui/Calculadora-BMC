// ═══════════════════════════════════════════════════════════════════════════
// WA Cockpit — query limit normalization
// ═══════════════════════════════════════════════════════════════════════════

import { parseWaLimit } from "../server/routes/wa.js";

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

console.log("\n═══ WA Cockpit · limit normalization ═══");

{
  const value = parseWaLimit(undefined, 100, 500);
  assert("undefined uses default", value === 100, value, 100);
}
{
  const value = parseWaLimit("", 100, 500);
  assert("empty string uses default", value === 100, value, 100);
}
{
  const value = parseWaLimit("abc", 100, 500);
  assert("non-numeric uses default instead of NaN", value === 100, value, 100);
}
{
  const value = parseWaLimit("0", 100, 500);
  assert("zero clamps to minimum", value === 1, value, 1);
}
{
  const value = parseWaLimit("9999", 100, 500);
  assert("large value clamps to max", value === 500, value, 500);
}
{
  const value = parseWaLimit("12.8", 100, 500);
  assert("decimal floors to integer", value === 12, value, 12);
}

console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
