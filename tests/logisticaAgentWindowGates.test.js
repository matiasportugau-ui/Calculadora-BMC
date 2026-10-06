// Logística agent window URL and popup fallback. Offline. No browser.
// node tests/logisticaAgentWindowGates.test.js
import assert from "node:assert/strict";
import {
  LOGISTICA_AGENT_WINDOW_NAME,
  buildLogisticaAgentUrl,
  isLogisticaAgentWindow,
  openLogisticaAgentWindow,
} from "../src/utils/logistica/openLogisticaAgentWindow.js";

const savedWindow = globalThis.window;

function restoreWindow() {
  if (savedWindow === undefined) delete globalThis.window;
  else globalThis.window = savedWindow;
}

function pipDocument() {
  const body = {
    style: {},
    child: null,
    replaceChildren(node) {
      this.child = node;
    },
  };
  return {
    documentElement: { style: {} },
    body,
    querySelector(sel) {
      return sel === "iframe[data-logistica-agent]" ? body.child : null;
    },
    createElement() {
      return {
        style: {},
        attrs: {},
        src: "",
        setAttribute(key, value) {
          this.attrs[key] = value;
        },
        getAttribute(key) {
          return this.attrs[key] ?? null;
        },
      };
    },
  };
}

try {
  delete globalThis.window;
  assert.equal(isLogisticaAgentWindow(), false);
  assert.equal(
    buildLogisticaAgentUrl(),
    "http://localhost/logistica?agentWindow=1",
  );
  assert.equal(
    buildLogisticaAgentUrl({ origin: "" }),
    "http://localhost/logistica?agentWindow=1",
  );
  assert.equal(await openLogisticaAgentWindow(), null);

  assert.equal(
    buildLogisticaAgentUrl({ origin: "https://bmc.test/prefix" }),
    "https://bmc.test/logistica?agentWindow=1",
  );

  const drafted = new URL(buildLogisticaAgentUrl({
    origin: "https://bmc.test",
    draft: " ENV-1&agentWindow=0#hash ",
  }));
  assert.equal(drafted.origin, "https://bmc.test");
  assert.equal(drafted.pathname, "/logistica");
  assert.equal(drafted.hash, "");
  assert.equal(drafted.searchParams.get("draft"), "ENV-1&agentWindow=0#hash");
  assert.equal(drafted.searchParams.get("agentWindow"), "1");
  assert.equal(drafted.toString().includes("\n"), false);

  const blankDraft = new URL(buildLogisticaAgentUrl({ origin: "https://bmc.test", draft: "   " }));
  assert.equal(blankDraft.searchParams.has("draft"), false);
  assert.equal(blankDraft.searchParams.get("agentWindow"), "1");

  const zeroDraft = new URL(buildLogisticaAgentUrl({ origin: "https://bmc.test", draft: "  0  " }));
  assert.equal(zeroDraft.searchParams.get("draft"), "0");

  assert.throws(() => buildLogisticaAgentUrl({ origin: "javascript:alert(1)" }));

  globalThis.window = { location: { origin: "https://evil.test", search: "?agentWindow=1" } };
  assert.equal(isLogisticaAgentWindow(), true);
  assert.equal(buildLogisticaAgentUrl({}), "https://evil.test/logistica?agentWindow=1");
  assert.equal(
    buildLogisticaAgentUrl({ origin: "https://bmc.test" }),
    "https://bmc.test/logistica?agentWindow=1",
  );

  globalThis.window = { location: { search: "?agentWindow=01" } };
  assert.equal(isLogisticaAgentWindow(), false);
  globalThis.window = { location: { search: "?draft=1" } };
  assert.equal(isLogisticaAgentWindow(), false);
  globalThis.window = { get location() { throw new Error("bad location"); } };
  assert.equal(isLogisticaAgentWindow(), false);

  const existing = { closed: false, document: pipDocument(), focused: 0, focus() { this.focused += 1; } };
  let opens = 0;
  let requests = 0;
  globalThis.window = {
    location: { origin: "https://bmc.test", search: "" },
    documentPictureInPicture: {
      window: existing,
      requestWindow() { requests += 1; return Promise.reject(new Error("should not request")); },
    },
    open() { opens += 1; return null; },
  };
  const reused = await openLogisticaAgentWindow({ draft: "ENV-9", origin: "https://bmc.test" });
  assert.equal(reused, existing);
  assert.equal(existing.focused, 1);
  assert.equal(opens, 0);
  assert.equal(requests, 0);
  assert.equal(existing.document.body.child.getAttribute("data-logistica-agent"), "1");
  assert.equal(existing.document.body.child.attrs.allow, "microphone; clipboard-read; clipboard-write");
  assert.equal(
    existing.document.body.child.src,
    "https://bmc.test/logistica?draft=ENV-9&agentWindow=1",
  );

  existing.focus = () => { throw new Error("no focus"); };
  const reusedAgain = await openLogisticaAgentWindow({ draft: "ENV-9", origin: "https://bmc.test" });
  assert.equal(reusedAgain, existing);
  assert.equal(existing.document.body.child.src, "https://bmc.test/logistica?draft=ENV-9&agentWindow=1");

  const freshDoc = pipDocument();
  globalThis.window = {
    location: { origin: "https://bmc.test", search: "" },
    documentPictureInPicture: {
      requestWindow: async () => ({ document: freshDoc, closed: false }),
    },
    open() { opens += 1; throw new Error("popup should not open"); },
  };
  const pipWin = await openLogisticaAgentWindow({ width: 440.5, height: "10px", origin: "https://bmc.test" });
  assert.equal(pipWin.document, freshDoc);
  assert.equal(opens, 0);
  assert.equal(freshDoc.body.child.src, "https://bmc.test/logistica?agentWindow=1");

  const opened = [];
  globalThis.window = {
    location: { origin: "https://bmc.test", search: "" },
    documentPictureInPicture: {
      requestWindow: async () => { throw new Error("dismissed"); },
    },
    open(url, name, features) {
      const win = { url, name, features, focus() { throw new Error("no focus"); } };
      opened.push(win);
      return win;
    },
  };
  const popup = await openLogisticaAgentWindow({ width: 0, height: -4, draft: "ENV-2" });
  assert.equal(popup, opened[0]);
  assert.equal(popup.name, LOGISTICA_AGENT_WINDOW_NAME);
  assert.equal(popup.name, "logistica-trucker");
  assert.equal(popup.features, "popup=yes,width=440,height=760,resizable=yes,scrollbars=yes");
  assert.equal(popup.url, "https://bmc.test/logistica?draft=ENV-2&agentWindow=1");

  globalThis.window.open = () => null;
  assert.equal(await openLogisticaAgentWindow({ width: "10px", height: "100" }), null);
} finally {
  restoreWindow();
}

console.log("logisticaAgentWindowGates tests OK");
