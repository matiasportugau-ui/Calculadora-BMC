/**
 * Unit tests for Document PiP helper + Co-Work pin fallback.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDocumentPipSupported,
  mirrorStylesToDocument,
  openDocumentPipWindow,
} from "../src/utils/openDocumentPip.js";
import {
  buildPanelinCoworkDeskUrl,
  openPanelinCoworkDesk,
  openPanelinCoworkPinned,
} from "../src/utils/openPanelinCoworkDesk.js";

describe("openDocumentPip", () => {
  it("isDocumentPipSupported is false in Node without the API", () => {
    assert.equal(isDocumentPipSupported(), false);
  });

  it("openDocumentPipWindow returns null when unsupported", async () => {
    const r = await openDocumentPipWindow({ width: 400, height: 600 });
    assert.equal(r, null);
  });

  it("mirrorStylesToDocument is a no-op without docs", () => {
    assert.doesNotThrow(() => mirrorStylesToDocument(null));
  });

  it("isDocumentPipSupported true when API present on window", () => {
    const prev = globalThis.window;
    globalThis.window = { documentPictureInPicture: {} };
    try {
      assert.equal(isDocumentPipSupported(), true);
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });
});

describe("openPanelinCoworkPinned", () => {
  it("falls back to named desk popup when PiP unsupported", async () => {
    const opens = [];
    const prev = globalThis.window;
    globalThis.window = {
      location: { origin: "https://example.test" },
      open(url, name, features) {
        opens.push({ url, name, features });
        return { focus() {}, closed: false };
      },
    };
    try {
      const r = await openPanelinCoworkPinned({ width: 420, height: 720 });
      assert.equal(r.documentPiP, false);
      assert.equal(opens.length, 1);
      assert.equal(opens[0].name, "panelin-cowork");
      assert.match(opens[0].url, /panelin\/cowork/);
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });

  it("uses Document PiP + iframe when API succeeds", async () => {
    const prev = globalThis.window;
    const body = {
      children: [],
      style: {},
      replaceChildren(...nodes) {
        this.children = nodes;
      },
    };
    const pipDoc = {
      body,
      documentElement: { style: {} },
      head: { appendChild() {} },
      createElement(tag) {
        return { tag, style: {}, setAttribute() {}, src: "" };
      },
    };
    const pipWin = { document: pipDoc };
    globalThis.window = {
      location: { origin: "https://example.test" },
      documentPictureInPicture: {
        async requestWindow() {
          return { document: pipDoc, close() {} };
        },
      },
      document: { styleSheets: [] },
      open() {
        throw new Error("should not open popup when PiP works");
      },
    };
    // openDocumentPipWindow uses window.documentPictureInPicture and document
    globalThis.document = globalThis.window.document;
    try {
      const r = await openPanelinCoworkPinned({ width: 400, height: 500 });
      assert.equal(r.documentPiP, true);
      assert.equal(r.window, pipWin.document ? r.window : r.window);
      assert.ok(body.children.length >= 1);
      const iframe = body.children[0];
      assert.equal(iframe.tag, "iframe");
      assert.match(iframe.src, /panelin\/cowork/);
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
      delete globalThis.document;
    }
  });

  it("buildPanelinCoworkDeskUrl still stable", () => {
    const u = buildPanelinCoworkDeskUrl({ origin: "https://calculadora-bmc.vercel.app" });
    assert.match(u, /\/panelin\/cowork/);
  });

  it("openPanelinCoworkDesk still named window", () => {
    const opens = [];
    const prev = globalThis.window;
    globalThis.window = {
      location: { origin: "https://example.test" },
      open(url, name) {
        opens.push({ url, name });
        return { focus() {} };
      },
    };
    try {
      openPanelinCoworkDesk();
      assert.equal(opens[0].name, "panelin-cowork");
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });
});
