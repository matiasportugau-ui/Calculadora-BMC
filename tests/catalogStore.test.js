// ═══════════════════════════════════════════════════════════════════════════
// tests/catalogStore.test.js — bmc_catalog products store (Fase 0)
// ───────────────────────────────────────────────────────────────────────────
// Exercises server/lib/catalog/store.js against an in-memory pg shim
// (pattern copied from identity-routes.test.js) and verifies that
// productosMaestro.loadLinks/saveLinks route through Postgres when a pool
// is available — the fix for links living on Cloud Run's ephemeral FS.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

const { __test__ } = await import("../server/lib/catalog/db.js");
const store = await import("../server/lib/catalog/store.js");

// In-memory shim for bmc_catalog.products. Matches the exact SQL shapes the
// store emits; anything else throws so new queries get a test update.
function makeShim() {
  const products = new Map(); // sku → row

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (norm === "begin" || norm === "commit" || norm === "rollback") {
      return { rows: [] };
    }

    if (norm.startsWith("select sku, codigo_stock from bmc_catalog.products")) {
      const rows = [...products.values()]
        .filter((p) => p.sku && p.codigo_stock)
        .map((p) => ({ sku: p.sku, codigo_stock: p.codigo_stock }));
      return { rows };
    }

    if (norm.startsWith("update bmc_catalog.products set codigo_stock = null")) {
      const [skus, updatedBy] = params;
      for (const p of products.values()) {
        if (p.codigo_stock && !skus.includes(p.sku)) {
          p.codigo_stock = null;
          p.updated_by = updatedBy;
        }
      }
      return { rows: [] };
    }

    if (norm.startsWith("insert into bmc_catalog.products (sku, codigo_stock, calc_path, updated_by)")) {
      const [sku, codigo, calcPath, updatedBy] = params;
      const existing = products.get(sku);
      if (existing) {
        existing.codigo_stock = codigo;
        existing.calc_path = existing.calc_path || calcPath;
        existing.updated_by = updatedBy;
        return { rows: [{ is_insert: false }] };
      }
      products.set(sku, { sku, codigo_stock: codigo, calc_path: calcPath, updated_by: updatedBy });
      return { rows: [{ is_insert: true }] };
    }

    throw new Error(`shim: unhandled SQL: ${norm.slice(0, 100)}`);
  }

  return {
    products,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

describe("catalog store (bmc_catalog.products)", () => {
  let shim;

  beforeEach(() => {
    shim = makeShim();
    __test__.setPool(shim);
  });

  after(() => {
    __test__.reset();
  });

  it("saveLinks + getLinks round-trip", async () => {
    await store.saveLinks({ ISOCOL40: "E-001", IW80: "E-002" });
    const links = await store.getLinks();
    assert.deepEqual(links, { ISOCOL40: "E-001", IW80: "E-002" });
  });

  it("saveLinks is a full replace: missing SKUs get unlinked, product row survives", async () => {
    await store.saveLinks({ ISOCOL40: "E-001", IW80: "E-002" });
    await store.saveLinks({ ISOCOL40: "E-009" });

    const links = await store.getLinks();
    assert.deepEqual(links, { ISOCOL40: "E-009" });

    // IW80 is unlinked but NOT deleted (enrichment must survive unlinking)
    const iw80 = shim.products.get("IW80");
    assert.ok(iw80, "unlinked product row should still exist");
    assert.equal(iw80.codigo_stock, null);
  });

  it("saveLinks ignores empty SKUs/codigos and stamps calc_path on insert", async () => {
    await store.saveLinks(
      { ISOCOL40: "E-001", "": "E-XXX", BAD: "" },
      { calcPathBySku: { ISOCOL40: "PANELS_TECHO.ISOROOF_COLONIAL.esp.40" } },
    );
    const links = await store.getLinks();
    assert.deepEqual(links, { ISOCOL40: "E-001" });
    assert.equal(shim.products.get("ISOCOL40").calc_path, "PANELS_TECHO.ISOROOF_COLONIAL.esp.40");
  });

  it("productosMaestro.loadLinks/saveLinks route through the DB store when a pool exists", async () => {
    const pm = await import("../server/lib/productosMaestro.js");
    const saved = await pm.saveLinks({ ISOCOL40: "E-100" });
    assert.equal(saved.meta.storage, "postgres");

    const links = await pm.loadLinks();
    assert.deepEqual(links, { ISOCOL40: "E-100" });
  });
});
