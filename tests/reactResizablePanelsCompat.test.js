// Guard the calculator split against react-resizable-panels v4 API drift.
// Run: node tests/reactResizablePanelsCompat.test.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import * as resizablePanels from "react-resizable-panels";

const source = readFileSync("src/components/PanelinCalculadoraV3_backup.jsx", "utf8");
const mobileCss = readFileSync("src/styles/bmc-mobile.css", "utf8");

assert.equal(typeof resizablePanels.Group, "function", "v4 Group export is available");
assert.equal(typeof resizablePanels.Panel, "function", "Panel export is available");
assert.equal(typeof resizablePanels.Separator, "function", "v4 Separator export is available");
assert.equal(typeof resizablePanels.useDefaultLayout, "function", "v4 useDefaultLayout export is available");
assert.equal(resizablePanels.PanelGroup, undefined, "legacy PanelGroup export is not available in v4");
assert.equal(resizablePanels.PanelResizeHandle, undefined, "legacy PanelResizeHandle export is not available in v4");

assert.match(
  source,
  /import\s+\{\s*Group,\s*Panel,\s*Separator,\s*useDefaultLayout\s*\}\s+from\s+"react-resizable-panels"/,
  "calculator imports the v4 component names"
);
assert.doesNotMatch(source, /PanelGroup|PanelResizeHandle|autoSaveId|direction=\{/, "calculator does not use v3-only props or exports");
assert.match(source, /groupRef=\{mainSplitGroupRef\}/, "imperative reset uses v4 groupRef");
assert.match(source, /orientation=\{isCompactLayout \? "vertical" : "horizontal"\}/, "group orientation uses v4 prop");
assert.match(source, /resizeTargetMinimumSize=\{\{ coarse: 36, fine: 16 \}\}/, "separator keeps a usable v4 hit target");
assert.match(source, /data-bmc-main-split-drag-shield/, "drag shield absorbs pointer-up clicks after resizing");
assert.match(source, /onPointerDownCapture=\{\(\) => setMainSplitDragging\(true\)\}/, "separator enables the drag shield on pointer down");
assert.match(source, /id=\{mainSplitPanelIds\[0\]\}/, "left panel has a stable persisted id");
assert.match(source, /id=\{mainSplitPanelIds\[1\]\}/, "right panel has a stable persisted id");
assert.match(source, /defaultSize=\{isCompactLayout \? "55%" : "35%"\}/, "left panel default size remains percentage-based");
assert.match(source, /defaultSize=\{isCompactLayout \? "45%" : "65%"\}/, "right panel default size remains percentage-based");
assert.match(source, /setLayout\?\.\(\{\s*"bmc-main-wizard": 28,\s*"bmc-main-visor": 72,\s*\}\)/s, "reset layout uses the v4 id-to-percent map");
assert.match(source, /e\.stopPropagation\(\);/, "separator double click does not bubble into calculator cards");
assert.match(mobileCss, /\[data-separator\]/, "mobile CSS targets v4 separator attribute");
assert.doesNotMatch(mobileCss, /> \[data-resize-handle\] \{ display: none !important; \}/, "mobile CSS no longer hides only the v3 handle attribute");

console.log("reactResizablePanelsCompat: ok");
