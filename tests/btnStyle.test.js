/**
 * Envíos F7 — onDark button contrast harness
 * Run: node tests/btnStyle.test.js
 */
import assert from "node:assert/strict";
import { btnStyle, isOnDarkContrastSafe } from "../src/utils/logistica/btnStyle.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("btnStyle");

{
  const s = btnStyle({ variant: "onDark", small: true });
  assert.equal(s.color, "#ffffff");
  assert.ok(String(s.background).includes("rgba(255,255,255"));
  assert.equal(isOnDarkContrastSafe(s), true);
  ok("onDark base contrast safe");
}

{
  // Regression: previous bug passed color white without bg → ghost buttons
  const s = btnStyle({
    variant: "onDark",
    outline: true,
    style: { color: "rgba(255,255,255,.85)", borderColor: "rgba(255,255,255,.2)" },
  });
  assert.equal(isOnDarkContrastSafe(s), true);
  assert.notEqual(String(s.background).toLowerCase(), "#ffffff");
  assert.notEqual(String(s.background), "#fff");
  ok("onDark resists white-text-only override");
}

{
  const s = btnStyle({ outline: true });
  assert.ok(s.background);
  assert.notEqual(s.color, "#ffffff");
  ok("default outline still light-surface for forms");
}

{
  const active = btnStyle({ variant: "onDark", active: true });
  const idle = btnStyle({ variant: "onDark", active: false });
  assert.notEqual(active.background, idle.background);
  ok("active state differs");
}

console.log(`btnStyle: ${passed} passed`);
