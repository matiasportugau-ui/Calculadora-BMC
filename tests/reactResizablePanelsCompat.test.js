/**
 * Guard for react-resizable-panels v4 compatibility in the canonical calculator.
 * Run: node tests/reactResizablePanelsCompat.test.js
 */

import { readFileSync } from "node:fs";

const component = readFileSync("src/components/PanelinCalculadoraV3_backup.jsx", "utf8");
const mobileCss = readFileSync("src/styles/bmc-mobile.css", "utf8");

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  x ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n- ${name}`);
  fn();
}

group("v4 exports", () => {
  assert(
    component.includes('import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";'),
    "imports the v4 Group/Separator API"
  );
  assert(!component.includes("PanelGroup"), "does not import or render removed PanelGroup export");
  assert(!component.includes("PanelResizeHandle"), "does not import or render removed PanelResizeHandle export");
});

group("layout persistence and percentages", () => {
  assert(component.includes("groupRef={mainPanelGroupRef}"), "uses groupRef for the imperative v4 group API");
  assert(component.includes("useDefaultLayout({"), "uses v4 useDefaultLayout persistence");
  assert(component.includes("setLayout?.(MAIN_SPLIT_RESET_LAYOUT)"), "resets with an id-keyed layout object");
  assert(component.includes('id="bmc-main-left"'), "left panel has a stable persisted id");
  assert(component.includes('id="bmc-main-right"'), "right panel has a stable persisted id");
  assert(component.includes('defaultSize={isCompactLayout ? "55%" : "35%"}'), "left default size remains percentage-based");
  assert(component.includes('defaultSize={isCompactLayout ? "45%" : "65%"}'), "right default size remains percentage-based");
});

group("separator styling", () => {
  assert(mobileCss.includes('[data-separator="active"]'), "active separator state is styled");
  assert(mobileCss.includes(".bmc-main-grid > [data-separator]"), "compact layout hides v4 separators");
  assert(!mobileCss.includes("[data-resize-handle]"), "CSS no longer targets the removed handle attribute");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
