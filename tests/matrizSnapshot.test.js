// Matriz snapshot (Desk D6). Run: node --test tests/matrizSnapshot.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseMatrizCSV,
  matrizVersionFor,
  freezeMatriz,
  getMatrizSnapshot,
  listMatrizSnapshots,
} from "../server/lib/matrizSnapshot.js";

function memPool() {
  const byVersion = new Map();
  const calls = [];
  return {
    byVersion,
    calls,
    async query(cfg) {
      calls.push(cfg);
      const { text, values } = cfg;
      if (/INSERT INTO matriz_snapshots/.test(text)) {
        if (!byVersion.has(values[0])) byVersion.set(values[0], { version: values[0], data: JSON.parse(values[1]) });
        return { rows: [] };
      }
      if (/WHERE version = \$1/.test(text)) return { rows: byVersion.has(values[0]) ? [byVersion.get(values[0])] : [] };
      return { rows: [...byVersion.values()] };
    },
  };
}

function failingPool(err) {
  return { async query() { throw err; } };
}

const CSV = 'sku,nombre,venta\nISODEC100,"Panel, 100mm",45.5\nPGLC,"Gotero ""L""",12\n';

describe("parseMatrizCSV", () => {
  it("handles quoted commas, escaped quotes and CRLF", () => {
    const d = parseMatrizCSV(CSV.replace(/\n/g, "\r\n"));
    assert.deepEqual(d.headers, ["sku", "nombre", "venta"]);
    assert.equal(d.rowCount, 2);
    assert.equal(d.rows[0].nombre, "Panel, 100mm");
    assert.equal(d.rows[1].nombre, 'Gotero "L"');
  });
  it("rejects header-only CSV with 400", () => {
    assert.throws(() => parseMatrizCSV("sku,venta\n"), (e) => e.status === 400);
  });
});

describe("matrizVersionFor", () => {
  it("is content-addressed and stable across line endings", () => {
    assert.equal(matrizVersionFor(CSV), matrizVersionFor(CSV.replace(/\n/g, "\r\n")));
    assert.notEqual(matrizVersionFor(CSV), matrizVersionFor(CSV + "X,y,1\n"));
    assert.match(matrizVersionFor(CSV), /^MATRIZ-[0-9a-f]{16}$/);
  });
});

describe("freezeMatriz", () => {
  it("is idempotent: same CSV twice → one snapshot, same version", async () => {
    const p = memPool();
    const v1 = await freezeMatriz(CSV, "op", p);
    const v2 = await freezeMatriz(CSV, "op", p);
    assert.equal(v1, v2);
    assert.equal(p.byVersion.size, 1);
    assert.match(p.calls[0].text, /ON CONFLICT \(version\) DO NOTHING/);
    assert.ok(p.calls[0].query_timeout > 0, "queries carry a timeout");
  });
  it("maps connection errors to 503 and other DB errors to 500", async () => {
    await assert.rejects(freezeMatriz(CSV, "op", failingPool(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))), (e) => e.status === 503);
    await assert.rejects(freezeMatriz(CSV, "op", failingPool(new Error("Query read timeout"))), (e) => e.status === 503);
    await assert.rejects(freezeMatriz(CSV, "op", failingPool(Object.assign(new Error("dup"), { code: "42P01" }))), (e) => e.status === 500);
  });
  it("rejects missing CSV with 400", async () => {
    await assert.rejects(freezeMatriz("", "op", memPool()), (e) => e.status === 400);
  });
});

describe("snapshot reads", () => {
  it("returns null only for a missing version", async () => {
    const p = memPool();
    const v = await freezeMatriz(CSV, "op", p);
    assert.equal((await getMatrizSnapshot(v, p)).version, v);
    assert.equal(await getMatrizSnapshot("MATRIZ-missing", p), null);
    assert.equal((await listMatrizSnapshots(5, p)).length, 1);
  });
  it("surfaces DB failures instead of hiding them", async () => {
    const down = failingPool(Object.assign(new Error("x"), { code: "08006" }));
    await assert.rejects(getMatrizSnapshot("MATRIZ-a", down), (e) => e.status === 503);
    await assert.rejects(listMatrizSnapshots(5, down), (e) => e.status === 503);
  });
});
