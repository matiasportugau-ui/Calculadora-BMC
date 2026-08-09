/**
 * IMP-09 — durable voice metrics dual-write (mock pool).
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordVoiceEvent,
  persistVoiceEvent,
  getVoiceMetrics,
  _resetVoiceMetricsForTests,
  __test__,
} from "../server/lib/voiceMetrics.js";

function makeMockPool() {
  const rows = [];
  let ensured = false;
  return {
    rows,
    async query(sql, params = []) {
      const s = String(sql);
      if (s.includes("CREATE TABLE") || s.includes("CREATE INDEX")) {
        ensured = true;
        return { rows: [], rowCount: 0 };
      }
      if (s.includes("INSERT INTO public.agent_voice_events")) {
        assert.ok(ensured);
        rows.push({
          ts: params[0],
          kind: params[1],
          detail: params[2],
          surface: params[3],
        });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

describe("voiceMetrics persist (IMP-09)", () => {
  beforeEach(() => {
    _resetVoiceMetricsForTests();
    __test__.resetPool();
  });
  afterEach(() => {
    _resetVoiceMetricsForTests();
    __test__.resetPool();
  });

  it("memory path works without pool", () => {
    recordVoiceEvent({ kind: "wake_miss", detail: "no phrase", surface: "panelin_chat" });
    const m = getVoiceMetrics();
    assert.equal(m.total, 1);
    assert.equal(m.by_kind.wake_miss, 1);
    assert.equal(m.source, "memory");
  });

  it("persistVoiceEvent writes via pool after ensureSchema", async () => {
    const mock = makeMockPool();
    __test__.setPool(mock);
    await persistVoiceEvent({
      ts: Date.now(),
      kind: "tts_error",
      detail: "synth fail",
      surface: "panelin_chat",
    });
    assert.equal(mock.rows.length, 1);
    assert.equal(mock.rows[0].kind, "tts_error");
  });

  it("recordVoiceEvent dual-writes when pool set", async () => {
    const mock = makeMockPool();
    __test__.setPool(mock);
    recordVoiceEvent({ kind: "session_mint_fail", surface: "live" });
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(mock.rows.length >= 1);
    assert.equal(mock.rows[0].kind, "session_mint_fail");
  });
});
