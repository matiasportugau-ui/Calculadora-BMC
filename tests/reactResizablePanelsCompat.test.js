// Guard the calculator's resizable split against upstream export/API changes.
// Run: node tests/reactResizablePanelsCompat.test.js
import * as resizablePanels from "react-resizable-panels";

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ok ${name}`);
    passed += 1;
    return;
  }
  console.log(`  FAIL ${name} - got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

console.log("\n=== react-resizable-panels compatibility ===");

for (const exportName of ["Group", "Panel", "Separator", "useDefaultLayout"]) {
  assert(
    `exports ${exportName}`,
    typeof resizablePanels[exportName] === "function",
    typeof resizablePanels[exportName],
    "function",
  );
}

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
