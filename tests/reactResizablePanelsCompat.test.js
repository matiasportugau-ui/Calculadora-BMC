/**
 * Compatibility guard for react-resizable-panels v4.
 * Run: node tests/reactResizablePanelsCompat.test.js
 */

import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../src/components/PanelinCalculadoraV3_backup.jsx", import.meta.url), "utf8");
const mobileCss = readFileSync(new URL("../src/styles/bmc-mobile.css", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

let passed = 0;
let failed = 0;

function assert(label, condition, details = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed += 1;
    return;
  }
  console.error(`  ❌ ${label}${details ? ` — ${details}` : ""}`);
  failed += 1;
}

console.log("\n═══ react-resizable-panels v4 compatibility ═══");

assert(
  "dependency is on react-resizable-panels v4",
  /^\^?4\./.test(pkg.dependencies?.["react-resizable-panels"] ?? ""),
  pkg.dependencies?.["react-resizable-panels"],
);

assert(
  "uses v4 exports Group/Panel/Separator/useDefaultLayout",
  component.includes('import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";'),
);

for (const legacyToken of ["PanelGroup", "PanelResizeHandle", "autoSaveId=", "direction="]) {
  assert(`does not use legacy token ${legacyToken}`, !component.includes(legacyToken));
}

assert("Group uses groupRef", component.includes("groupRef={mainSplitGroupRef}"));
assert("Group uses orientation", component.includes('orientation={isCompactLayout ? "vertical" : "horizontal"}'));
assert("Group persists layout through useDefaultLayout", component.includes("mainPanelLayoutPersistence.onLayoutChanged"));
assert("reset layout uses v4 panel-id map", component.includes("setLayout?.(MAIN_SPLIT_RESET_LAYOUT)"));

for (const panelId of ['"main-input"', '"main-results"']) {
  assert(`stable panel id ${panelId}`, component.includes(panelId));
}

for (const pctSize of ['"55%"', '"35%"', '"24%"', '"85%"', '"45%"', '"65%"', '"20%"', '"32%"']) {
  assert(`panel size remains percentage string ${pctSize}`, component.includes(pctSize));
}

assert("separator disables built-in double-click reset", component.includes("disableDoubleClick"));
assert("mobile CSS targets v4 separator attribute", mobileCss.includes("[data-separator]"));
assert("sash active style targets v4 separator state", mobileCss.includes('[data-separator="active"]'));

if (failed) {
  console.error(`\nreactResizablePanelsCompat: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`\nreactResizablePanelsCompat: ${passed} passed, 0 failed`);
