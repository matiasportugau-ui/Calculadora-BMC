// Contract tests for server/lib/suggestionsNormalize.js
// Run: node tests/suggestionsNormalize.test.js

import {
  normalizeSuggestionsPayload,
  SUGGEST_MAX_ITEMS_TOTAL,
  SUGGEST_MAX_ITEMS_PER_GROUP,
  SUGGEST_MAX_LABEL_LEN,
  SUGGEST_MAX_SEND_LEN,
  SUGGEST_MAX_GROUPS,
} from "../server/lib/suggestionsNormalize.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("null / invalid → null", () => {
  assert(normalizeSuggestionsPayload(null) === null, "null");
  assert(normalizeSuggestionsPayload(undefined) === null, "undefined");
  assert(normalizeSuggestionsPayload("x") === null, "string");
  assert(normalizeSuggestionsPayload({}) === null, "empty object");
});

group("flat items", () => {
  const r = normalizeSuggestionsPayload({
    items: [
      { label: "Techo", send: "Es techo" },
      { label: "Pared", send: "" },
    ],
  });
  assert(r != null && r.groups.length === 1, "one group");
  assert(r.groups[0].items.length === 2, "two items");
  assert(r.groups[0].items[0].label === "Techo" && r.groups[0].items[0].send === "Es techo", "send kept");
  assert(r.groups[0].items[1].send === "Pared", "empty send → label");
});

group("groups + title", () => {
  const r = normalizeSuggestionsPayload({
    groups: [{ title: "Zona", items: [{ label: "A" }, { label: "B" }] }],
  });
  assert(r.groups[0].title === "Zona", "title");
  assert(r.groups[0].items.length === 2, "two items");
});

group("total budget cap", () => {
  const groups = [];
  for (let g = 0; g < 4; g++) {
    groups.push({ title: `g${g}`, items: Array.from({ length: 5 }, (_, i) => ({ label: `${g}-${i}` })) });
  }
  const r = normalizeSuggestionsPayload({ groups });
  const total = r.groups.reduce((n, g) => n + g.items.length, 0);
  assert(total === SUGGEST_MAX_ITEMS_TOTAL, `max ${SUGGEST_MAX_ITEMS_TOTAL} items`);
});

group("per-group cap", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ label: `i${i}` }));
  const r = normalizeSuggestionsPayload({ groups: [{ title: "", items: many }] });
  assert(r.groups[0].items.length === SUGGEST_MAX_ITEMS_PER_GROUP, "per-group cap");
});

group("groups count cap", () => {
  const groups = Array.from({ length: 10 }, (_, gi) => ({
    title: `g${gi}`,
    items: [{ label: "a" }],
  }));
  const r = normalizeSuggestionsPayload({ groups });
  assert(r.groups.length === SUGGEST_MAX_GROUPS, "max groups");
});

group("label trimmed + max length", () => {
  const long = `${"L".repeat(SUGGEST_MAX_LABEL_LEN)}extra`;
  const r = normalizeSuggestionsPayload({ items: [{ label: `  ${long}  ` }] });
  assert(r.groups[0].items[0].label.length === SUGGEST_MAX_LABEL_LEN, "label clipped");
});

group("send longer than label", () => {
  const send = `${"s".repeat(SUGGEST_MAX_SEND_LEN)}tail`;
  const r = normalizeSuggestionsPayload({ items: [{ label: "x", send }] });
  assert(r.groups[0].items[0].send.length === SUGGEST_MAX_SEND_LEN, "send uses SUGGEST_MAX_SEND_LEN");
});

group("strip invalid entries", () => {
  assert(normalizeSuggestionsPayload({ items: [{ foo: 1 }] }) === null, "no valid items");
});

console.log(`\nsuggestionsNormalize: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
