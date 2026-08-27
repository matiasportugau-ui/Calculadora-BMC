/**
 * Ops UX F3a — stop reorder + collapse helpers
 * Run: node tests/stopReorder.test.js
 */
import assert from "node:assert/strict";
import {
  reorderStops,
  renumberStops,
  orderStopsByIds,
  defaultCollapsedStopIds,
  toggleCollapsedStopId,
} from "../src/utils/logistica/stopReorder.js";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("stopReorder");

const colors = ["#a", "#b", "#c", "#d"];
const base = [
  { id: "s1", orden: 1, cliente: "A", color: "#a" },
  { id: "s2", orden: 2, cliente: "B", color: "#b" },
  { id: "s3", orden: 3, cliente: "C", color: "#c" },
];

{
  const next = reorderStops(base, "s3", "s1", { colors });
  assert.equal(next.map((s) => s.id).join(","), "s3,s1,s2");
  assert.equal(next[0].orden, 1);
  assert.equal(next[1].orden, 2);
  assert.equal(next[2].orden, 3);
  assert.equal(next[0].color, "#a");
  ok("reorder s3 before s1 (drag up)");
}

{
  // Drag s1 onto s3: insert *before* s3 → [s2, s1, s3] (not [s2, s3, s1])
  const next = reorderStops(base, "s1", "s3", { colors });
  assert.equal(next.map((s) => s.id).join(","), "s2,s1,s3");
  assert.equal(next[0].orden, 1);
  assert.equal(next[1].orden, 2);
  assert.equal(next[2].orden, 3);
  ok("reorder s1 before s3 (drag down — #846)");
}

{
  const next = reorderStops(base, "s1", "s2", { colors });
  assert.equal(next.map((s) => s.id).join(","), "s1,s2,s3");
  ok("reorder s1 onto s2 adjacent down is stable order");
}

{
  const same = reorderStops(base, "s1", "s1", { colors });
  assert.equal(same.map((s) => s.id).join(","), "s1,s2,s3");
  ok("noop same ids");
}

{
  const n = renumberStops([{ id: "x" }, { id: "y" }], { colors });
  assert.equal(n[0].orden, 1);
  assert.equal(n[1].orden, 2);
  ok("renumberStops");
}

{
  const next = orderStopsByIds(base, ["s3", "s1", "s2"], { colors });
  assert.equal(next.map((s) => s.id).join(","), "s3,s1,s2");
  assert.equal(next[0].orden, 1);
  assert.equal(next[2].orden, 3);
  const withExtra = orderStopsByIds(base, ["s2"], { colors });
  assert.equal(withExtra.map((s) => s.id).join(","), "s2,s1,s3");
  const ignoreUnknown = orderStopsByIds(base, ["nope", "s1", "s1"], { colors });
  assert.equal(ignoreUnknown.map((s) => s.id).join(","), "s1,s2,s3");
  ok("orderStopsByIds");
}

{
  assert.deepEqual(defaultCollapsedStopIds(base, 3), []);
  assert.deepEqual(defaultCollapsedStopIds([...base, { id: "s4" }], 3), ["s2", "s3", "s4"]);
  ok("defaultCollapsedStopIds");
}

{
  let c = [];
  c = toggleCollapsedStopId(c, "s2");
  assert.deepEqual(c, ["s2"]);
  c = toggleCollapsedStopId(c, "s2");
  assert.deepEqual(c, []);
  ok("toggleCollapsedStopId");
}

console.log(`\n${passed} assertions ok`);
