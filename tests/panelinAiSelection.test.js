// tests/panelinAiSelection.test.js
import assert from "node:assert/strict";
import {
  loadPanelinAiSelection,
  savePanelinAiSelection,
  resolveEffectiveAiPick,
  formatAiChatModelLabel,
  PANELIN_AI_STORAGE_KEY,
} from "../src/utils/panelinAiSelection.js";

// Minimal localStorage polyfill for node
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

store.clear();
assert.deepEqual(loadPanelinAiSelection(), { aiProvider: "auto", aiModel: "" });

savePanelinAiSelection({ aiProvider: "grok", aiModel: "" });
assert.equal(store.get(PANELIN_AI_STORAGE_KEY).includes("grok"), true);
assert.deepEqual(loadPanelinAiSelection(), { aiProvider: "grok", aiModel: "" });

// Explicit prop wins
assert.deepEqual(resolveEffectiveAiPick("openai", "gpt-4o"), {
  aiProvider: "openai",
  aiModel: "gpt-4o",
});
// Props auto → fall back to stored grok
assert.deepEqual(resolveEffectiveAiPick("auto", ""), {
  aiProvider: "grok",
  aiModel: "",
});

assert.equal(formatAiChatModelLabel("auto"), "Auto (cadena del servidor)");
assert.equal(formatAiChatModelLabel("grok", ""), "grok");
assert.equal(formatAiChatModelLabel("grok", "grok-3-mini"), "grok / grok-3-mini");

// Invalid provider coerced to auto on save
savePanelinAiSelection({ aiProvider: "nope", aiModel: "x" });
assert.deepEqual(loadPanelinAiSelection(), { aiProvider: "auto", aiModel: "" });

console.log("✅ panelinAiSelection tests OK");
