// tests/panelinAiSelection.test.js
import assert from "node:assert/strict";
import {
  loadPanelinAiSelection,
  savePanelinAiSelection,
  resolveEffectiveAiPick,
  formatAiChatModelLabel,
  PANELIN_AI_STORAGE_KEY,
  PANELIN_AI_EVENT,
} from "../src/utils/panelinAiSelection.js";

// Minimal localStorage + window event polyfill for node (#796 same-tab sync)
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const listeners = new Map();
globalThis.window = {
  dispatchEvent(ev) {
    const fns = listeners.get(ev.type) || [];
    for (const fn of fns) fn(ev);
    return true;
  },
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  removeEventListener(type, fn) {
    const fns = listeners.get(type) || [];
    listeners.set(
      type,
      fns.filter((f) => f !== fn),
    );
  },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
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

// Same-tab sync event (#796) — voice label / floating chat stay aligned with header
{
  let saw = null;
  const onSel = (ev) => {
    saw = ev.detail;
  };
  window.addEventListener(PANELIN_AI_EVENT, onSel);
  const next = savePanelinAiSelection({ aiProvider: "grok", aiModel: "grok-3-mini" });
  assert.deepEqual(next, { aiProvider: "grok", aiModel: "grok-3-mini" });
  assert.deepEqual(saw, next);
  window.removeEventListener(PANELIN_AI_EVENT, onSel);
}

console.log("✅ panelinAiSelection tests OK");
