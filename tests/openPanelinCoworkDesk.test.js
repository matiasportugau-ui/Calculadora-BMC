/**
 * Unit tests for Co-Work desk window URL + named-window open helper.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PANELIN_COWORK_WINDOW_NAME,
  buildPanelinCoworkDeskUrl,
  defaultDeskSize,
  readStoredDeskSize,
  persistDeskSize,
  openPanelinCoworkDesk,
} from "../src/utils/openPanelinCoworkDesk.js";
import {
  PANELIN_COWORK_CHANNEL,
  COWORK_MSG,
  postCalcState,
  postChatAction,
} from "../src/utils/panelinCoworkChannel.js";

describe("openPanelinCoworkDesk", () => {
  it("exports stable window name for single-instance focus", () => {
    assert.equal(PANELIN_COWORK_WINDOW_NAME, "panelin-cowork");
  });

  it("buildPanelinCoworkDeskUrl points at /panelin/cowork with floating+cowork flags", () => {
    const url = buildPanelinCoworkDeskUrl({ origin: "https://calculadora-bmc.vercel.app" });
    const u = new URL(url);
    assert.match(u.pathname, /\/panelin\/cowork$/);
    assert.equal(u.searchParams.get("floating"), "1");
    assert.equal(u.searchParams.get("cowork"), "1");
  });

  it("defaultDeskSize is companion-sized", () => {
    const s = defaultDeskSize();
    assert.ok(s.width >= 320);
    assert.ok(s.height >= 400);
  });

  it("persistDeskSize round-trips via localStorage when available", () => {
    if (typeof localStorage === "undefined") {
      // Node test env without jsdom — skip soft
      assert.ok(true);
      return;
    }
    persistDeskSize({ width: 500, height: 800 });
    const s = readStoredDeskSize();
    assert.equal(s.width, 500);
    assert.equal(s.height, 800);
  });

  it("openPanelinCoworkDesk uses named window and features", () => {
    const opens = [];
    const prev = globalThis.window;
    globalThis.window = {
      location: { origin: "https://example.test" },
      open(url, name, features) {
        opens.push({ url, name, features });
        return { focus() { this.focused = true; }, focused: false };
      },
    };
    try {
      const win = openPanelinCoworkDesk({ width: 440, height: 700 });
      assert.equal(opens.length, 1);
      assert.equal(opens[0].name, PANELIN_COWORK_WINDOW_NAME);
      assert.match(opens[0].url, /panelin\/cowork/);
      assert.match(opens[0].features, /width=440/);
      assert.match(opens[0].features, /height=700/);
      assert.equal(win.focused, true);
    } finally {
      if (prev === undefined) delete globalThis.window;
      else globalThis.window = prev;
    }
  });
});

describe("panelinCoworkChannel constants", () => {
  it("uses stable channel name and message types", () => {
    assert.equal(PANELIN_COWORK_CHANNEL, "bmc-panelin-cowork-v1");
    assert.equal(COWORK_MSG.CALC_STATE, "calcState");
    assert.equal(COWORK_MSG.CHAT_ACTION, "chatAction");
  });

  it("post helpers do not throw without BroadcastChannel", () => {
    assert.doesNotThrow(() => postCalcState({ scenario: "solo_techo" }));
    assert.doesNotThrow(() => postChatAction({ type: "setLP", payload: "web" }));
  });
});
