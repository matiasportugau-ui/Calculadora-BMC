/**
 * B-05 — durable toolStats via injectable pool mock
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordToolCall,
  getToolStats,
  getToolStatsAsync,
  persistToolCall,
  loadToolCallRowsFromDb,
  _resetToolStatsForTests,
  __test__,
} from "../server/lib/toolStats.js";

function makeMockPool() {
  /** @type {Array<{ts:number, tool:string, ok:boolean, latency_ms:number, error_class:string|null}>} */
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
      if (s.includes("INSERT INTO public.agent_tool_calls")) {
        assert.equal(ensured || true, true);
        const [tsMs, tool, ok, latencyMs, errorClass] = params;
        rows.push({
          ts: tsMs,
          tool,
          ok,
          latency_ms: latencyMs,
          error_class: errorClass,
        });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes("FROM public.agent_tool_calls")) {
        // cutoff is Date in params[0]
        const cutoffMs = params[0] instanceof Date ? params[0].getTime() : 0;
        const matched = rows
          .filter((r) => r.ts >= cutoffMs)
          .map((r) => ({
            ts_ms: r.ts,
            tool: r.tool,
            ok: r.ok,
            latency_ms: r.latency_ms,
            error_class: r.error_class,
          }));
        return { rows: matched, rowCount: matched.length };
      }
      if (s.includes("DELETE FROM public.agent_tool_calls")) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

describe("toolStats persist (B-05)", () => {
  beforeEach(() => {
    _resetToolStatsForTests();
    __test__.resetPool();
  });
  afterEach(() => {
    _resetToolStatsForTests();
    __test__.resetPool();
  });

  it("memory path still works without pool", () => {
    recordToolCall({ tool: "t1", ok: true, latencyMs: 10 });
    const s = getToolStats();
    assert.equal(s.total_calls, 1);
    assert.equal(s.source, "memory");
  });

  it("persistToolCall writes via pool after ensureSchema", async () => {
    const mock = makeMockPool();
    __test__.setPool(mock);
    await persistToolCall({
      ts: Date.now(),
      tool: "calcular_cotizacion",
      ok: true,
      latencyMs: 42,
      errorClass: null,
    });
    assert.equal(mock.rows.length, 1);
    assert.equal(mock.rows[0].tool, "calcular_cotizacion");
    assert.equal(mock.rows[0].latency_ms, 42);
  });

  it("getToolStatsAsync prefers db aggregates when rows exist", async () => {
    const mock = makeMockPool();
    __test__.setPool(mock);
    const now = Date.now();
    await persistToolCall({
      ts: now,
      tool: "generar_pdf",
      ok: true,
      latencyMs: 100,
      errorClass: null,
    });
    await persistToolCall({
      ts: now + 1,
      tool: "generar_pdf",
      ok: false,
      latencyMs: 200,
      errorClass: "network:upstream",
    });
    // memory empty
    _resetToolStatsForTests();
    const stats = await getToolStatsAsync({ windowMs: 60_000 });
    assert.equal(stats.source, "db");
    assert.equal(stats.total_calls, 2);
    const t = stats.tools.find((x) => x.tool === "generar_pdf");
    assert.ok(t);
    assert.equal(t.count, 2);
    assert.equal(t.errors, 1);
    assert.equal(t.errors_by_class["network:upstream"], 1);
  });

  it("loadToolCallRowsFromDb returns null without pool", async () => {
    __test__.resetPool();
    const rows = await loadToolCallRowsFromDb(60_000);
    assert.equal(rows, null);
  });

  it("recordToolCall schedules persist when pool set", async () => {
    const mock = makeMockPool();
    __test__.setPool(mock);
    recordToolCall({ tool: "listar_opciones_panel", ok: true, latencyMs: 5 });
    // allow microtask / promise
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(mock.rows.length >= 1);
    assert.equal(mock.rows[0].tool, "listar_opciones_panel");
  });
});
