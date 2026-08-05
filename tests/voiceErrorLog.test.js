/**
 * IMP-09 voiceErrorLog — in-memory ring + privacy-safe dual-write to voiceMetrics.
 * Covers truncation, newest-first listing, capacity, and clear (no DATABASE_URL).
 *
 * Run: node --test tests/voiceErrorLog.test.js
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordVoiceError,
  listVoiceErrors,
  clearVoiceErrors,
} from "../server/lib/voiceErrorLog.js";
import {
  getVoiceMetrics,
  _resetVoiceMetricsForTests,
} from "../server/lib/voiceMetrics.js";

describe("voiceErrorLog", () => {
  beforeEach(() => {
    clearVoiceErrors();
    _resetVoiceMetricsForTests();
  });
  afterEach(() => {
    clearVoiceErrors();
    _resetVoiceMetricsForTests();
  });

  it("records entry and lists newest first", () => {
    recordVoiceError({ kind: "mint_fail", message: "first", status: 401 });
    recordVoiceError({ kind: "sdp_fail", message: "second", status: 502 });
    const list = listVoiceErrors();
    assert.equal(list.length, 2);
    assert.equal(list[0].kind, "sdp_fail");
    assert.equal(list[1].kind, "mint_fail");
    assert.equal(list[0].status, 502);
    assert.ok(typeof list[0].ts === "string" && list[0].ts.includes("T"));
  });

  it("clips long message/detail and never returns raw oversize strings", () => {
    const longMsg = "m".repeat(600);
    const longDetail = "d".repeat(2500);
    const entry = recordVoiceError({
      kind: "network",
      message: longMsg,
      detail: longDetail,
      status: "503",
    });
    assert.ok(entry.message.length < 520);
    assert.match(entry.message, /truncated/);
    assert.ok(entry.detail.length < 2020);
    assert.match(entry.detail, /truncated/);
    assert.equal(entry.status, 503);
  });

  it("caps ring at 50 entries", () => {
    for (let i = 0; i < 55; i += 1) {
      recordVoiceError({ kind: `k${i}`, message: `m${i}` });
    }
    const list = listVoiceErrors();
    assert.equal(list.length, 50);
    assert.equal(list[0].kind, "k54");
    assert.equal(list[49].kind, "k5");
  });

  it("clearVoiceErrors empties the buffer", () => {
    recordVoiceError({ kind: "x", message: "y" });
    clearVoiceErrors();
    assert.deepEqual(listVoiceErrors(), []);
  });

  it("dual-writes a privacy-safe event into voiceMetrics memory", () => {
    recordVoiceError({
      kind: "mint_fail",
      message: "OpenAI client_secrets 401",
      detail: "should prefer message for metrics detail",
    });
    const m = getVoiceMetrics();
    assert.equal(m.total, 1);
    assert.equal(m.by_kind.mint_fail, 1);
    assert.equal(m.source, "memory");
  });

  it("defaults kind to unknown and null status when omitted", () => {
    const entry = recordVoiceError({ message: "oops" });
    assert.equal(entry.kind, "unknown");
    assert.equal(entry.status, null);
  });
});
