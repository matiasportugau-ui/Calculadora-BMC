/**
 * tests/workspace-store.test.js
 *
 * Hits shipped workspaceStore against real Postgres (DATABASE_URL).
 * Path under test: createCustomer → getCustomer → createQuote → getQuote
 * → createFile linked → listFiles by quoteId.
 *
 * Run: node --test tests/workspace-store.test.js
 * Or:  node tests/workspace-store.test.js
 */
import dotenv from "dotenv";
dotenv.config();

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import pg from "pg";
import * as store from "../server/lib/workspaceStore.js";

const databaseUrl = process.env.DATABASE_URL;
const hasDb = Boolean(databaseUrl);

describe("workspaceStore durable customers/quotes/files", { skip: !hasDb }, () => {
  /** @type {import("pg").Pool} */
  let pool;
  const wsId = "ws-1";
  const stamp = Date.now();

  before(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
    // Ensure seed workspace exists (FK parent)
    const { rows } = await pool.query(
      `SELECT id FROM panelin_workspace.workspaces WHERE id = $1`,
      [wsId],
    );
    if (!rows.length) {
      await pool.query(
        `INSERT INTO panelin_workspace.ws_users (id, email, display_name, role)
         VALUES ('u-store-test', 'store-test@example.com', 'Store Test', 'superadmin')
         ON CONFLICT (id) DO NOTHING`,
      );
      await pool.query(
        `INSERT INTO panelin_workspace.workspaces (id, owner_user_id, name, agent_config_id)
         VALUES ($1, 'u-store-test', 'Store Test WS', 'cfg-1')
         ON CONFLICT (id) DO NOTHING`,
        [wsId],
      );
    }
  });

  after(async () => {
    if (pool) await pool.end();
  });

  it("createCustomer + getCustomer round-trip", async () => {
    const name = `Cliente Store ${stamp}`;
    const created = await store.createCustomer(pool, {
      workspaceId: wsId,
      name,
      rut: "21.000.000-1",
      phone: "+59899000000",
      source: "test",
      tags: ["store-test"],
    });
    assert.ok(created?.id, "created id");
    assert.equal(created.name, name);
    assert.equal(created.workspaceId, wsId);

    const got = await store.getCustomer(pool, created.id);
    assert.ok(got, "get after set");
    assert.equal(got.id, created.id);
    assert.equal(got.name, name);
    assert.equal(got.rut, "21.000.000-1");
  });

  it("createQuote linked to customer + getQuote", async () => {
    const customer = await store.createCustomer(pool, {
      workspaceId: wsId,
      name: `Cliente Quote ${stamp}`,
    });
    const created = await store.createQuote(pool, {
      workspaceId: wsId,
      customerId: customer.id,
      title: `Cotización ${stamp}`,
      code: `BMC-TEST-${stamp}`,
      status: "draft",
      currency: "USD",
      totalConIva: 1234.56,
      payloadJson: { scenario: "techo", area: 200 },
    });
    assert.ok(created?.id);
    assert.equal(created.customerId, customer.id);
    assert.equal(created.title, `Cotización ${stamp}`);
    assert.equal(created.totalConIva, 1234.56);

    const got = await store.getQuote(pool, created.id);
    assert.ok(got);
    assert.equal(got.id, created.id);
    assert.equal(got.customerId, customer.id);
    assert.equal(got.payloadJson?.scenario, "techo");
  });

  it("createFile linked to customer+quote and list by quoteId", async () => {
    const chain = await store.createCustomerQuoteFileChain(pool, {
      workspaceId: wsId,
      customerName: `Chain Customer ${stamp}`,
      quoteTitle: `Chain Quote ${stamp}`,
      fileName: `chain-${stamp}.pdf`,
    });
    assert.ok(chain.customer.id);
    assert.ok(chain.quote.id);
    assert.ok(chain.file.id);
    assert.equal(chain.file.customerId, chain.customer.id);
    assert.equal(chain.file.quoteId, chain.quote.id);
    assert.equal(chain.file.kind, "quote_pdf");

    const listed = await store.listFiles(pool, {
      workspaceId: wsId,
      quoteId: chain.quote.id,
    });
    assert.ok(listed.some((f) => f.id === chain.file.id), "file appears in list by quoteId");

    const gotFile = await store.getFile(pool, chain.file.id);
    assert.equal(gotFile?.path, chain.file.path);
    assert.equal(gotFile?.storageUrl, chain.file.storageUrl);
  });

  it("listCustomers finds by name fragment", async () => {
    const unique = `ZetaUnique${stamp}`;
    await store.createCustomer(pool, { workspaceId: wsId, name: unique });
    const found = await store.listCustomers(pool, { workspaceId: wsId, q: `ZetaUnique${stamp}` });
    assert.ok(found.some((c) => c.name === unique));
  });
});

// CLI-friendly summary when run without node:test reporter filtering
if (!hasDb) {
  console.error("SKIP: DATABASE_URL not set — workspace-store tests require real Postgres");
  process.exit(0);
}
