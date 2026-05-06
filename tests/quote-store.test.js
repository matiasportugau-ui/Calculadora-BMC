// ═══════════════════════════════════════════════════════════════════════════
// tests/quote-store.test.js — unit tests for server/lib/quoteStore.js
// ───────────────────────────────────────────────────────────────────────────
// Mocks pg.Pool with an in-memory shim and exercises every public function:
// upsertQuote insert + dedupe by client_quote_id, listMyQuotes filtering,
// getMyQuote ownership, softDeleteQuote, claimAnonymousQuotes by ID list.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

const mod = await import("../server/lib/quoteStore.js");
const { upsertQuote, listMyQuotes, getMyQuote, softDeleteQuote, claimAnonymousQuotes, __test__ } = mod;

function makeShim() {
  const tables = { quotes: [], quote_events: [] };
  let nextQuoteId = 1;
  function uuid() { return `q-${nextQuoteId++}`; }

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    // upsert by (user_id, client_quote_id)
    if (norm.startsWith("update identity.quotes set payload = $3::jsonb,")) {
      const [user_id, client_quote_id, payload, total_usd, total_uyu, pdf_id, pdf_url, gcs_uri, drive_file_id, wizard_step, status] = params;
      const row = tables.quotes.find(
        (q) => q.user_id === user_id && q.client_quote_id === client_quote_id,
      );
      if (!row) return { rows: [] };
      row.payload = JSON.parse(payload);
      if (total_usd != null) row.total_usd = Number(total_usd);
      if (total_uyu != null) row.total_uyu = Number(total_uyu);
      if (pdf_id) row.pdf_id = pdf_id;
      if (pdf_url) row.pdf_url = pdf_url;
      if (gcs_uri) row.gcs_uri = gcs_uri;
      if (drive_file_id) row.drive_file_id = drive_file_id;
      if (wizard_step != null) row.wizard_step = wizard_step;
      if (row.status !== "deleted") row.status = status;
      row.updated_at = new Date();
      return { rows: [{ ...row }] };
    }

    if (norm.startsWith("insert into identity.quotes")) {
      const [user_id, client_quote_id, payload, total_usd, total_uyu, pdf_id, pdf_url, gcs_uri, drive_file_id, wizard_step, status] = params;
      const row = {
        quote_id: uuid(),
        user_id,
        client_quote_id,
        payload: JSON.parse(payload),
        total_usd: total_usd != null ? Number(total_usd) : null,
        total_uyu: total_uyu != null ? Number(total_uyu) : null,
        pdf_id: pdf_id || null,
        pdf_url: pdf_url || null,
        gcs_uri: gcs_uri || null,
        drive_file_id: drive_file_id || null,
        wizard_step: wizard_step ?? null,
        status: status || "draft",
        created_at: new Date(),
        updated_at: new Date(),
      };
      tables.quotes.push(row);
      return { rows: [{ ...row }] };
    }

    // claim anonymous
    if (norm.startsWith("update identity.quotes set user_id = $1 where user_id is null")) {
      const [user_id, ids] = params;
      let count = 0;
      for (const r of tables.quotes) {
        if (r.user_id === null && ids.includes(r.client_quote_id)) {
          r.user_id = user_id;
          count += 1;
        }
      }
      return { rowCount: count, rows: [] };
    }

    // list (no deleted)
    if (norm.startsWith("select quote_id, client_quote_id, total_usd, total_uyu, status,") &&
        norm.includes("status <> 'deleted'")) {
      const [user_id, limit] = params;
      const rows = tables.quotes
        .filter((r) => r.user_id === user_id && r.status !== "deleted")
        .sort((a, b) => +b.created_at - +a.created_at)
        .slice(0, limit);
      return { rows };
    }
    // list (include deleted)
    if (norm.startsWith("select quote_id, client_quote_id, total_usd, total_uyu, status,")) {
      const [user_id, limit] = params;
      const rows = tables.quotes
        .filter((r) => r.user_id === user_id)
        .sort((a, b) => +b.created_at - +a.created_at)
        .slice(0, limit);
      return { rows };
    }

    // get one
    if (norm.startsWith("select quote_id, client_quote_id, payload, total_usd, total_uyu, status, pdf_id,")) {
      const [quote_id, user_id] = params;
      const r = tables.quotes.find((x) => x.quote_id === quote_id && x.user_id === user_id);
      return { rows: r ? [r] : [] };
    }

    // soft delete
    if (norm.startsWith("update identity.quotes set status = 'deleted'")) {
      const [quote_id, user_id] = params;
      const r = tables.quotes.find((x) => x.quote_id === quote_id && x.user_id === user_id);
      if (!r) return { rows: [] };
      r.status = "deleted";
      return { rows: [{ quote_id: r.quote_id }] };
    }

    // events
    if (norm.startsWith("insert into identity.quote_events")) {
      tables.quote_events.push({ params });
      return { rows: [] };
    }

    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }

  return { query, _tables: tables };
}

let pool;

beforeEach(() => {
  pool = makeShim();
  __test__.setPool(pool);
});

describe("upsertQuote", () => {
  it("inserts a fresh row when no client_quote_id supplied", async () => {
    const r = await upsertQuote({
      userId: "user-1",
      payload: { totalUsd: 1234.5 },
      status: "completed",
    });
    assert.equal(r.status, "completed");
    assert.equal(Number(r.total_usd), 1234.5);
    assert.equal(pool._tables.quotes.length, 1);
    assert.equal(pool._tables.quote_events.length, 1);
    assert.match(pool._tables.quote_events[0].params[1], /created/);
  });

  it("dedupes on (user_id, client_quote_id) — upsert path", async () => {
    await upsertQuote({ userId: "user-1", clientQuoteId: "cq-1", payload: { totalUsd: 100 } });
    await upsertQuote({ userId: "user-1", clientQuoteId: "cq-1", payload: { totalUsd: 200 }, status: "completed" });
    assert.equal(pool._tables.quotes.length, 1);
    assert.equal(Number(pool._tables.quotes[0].total_usd), 200);
    assert.equal(pool._tables.quotes[0].status, "completed");
  });

  it("requires userId", async () => {
    await assert.rejects(() => upsertQuote({ payload: {} }), /userId_required/);
  });

  it("preserves status='deleted' across updates", async () => {
    const ins = await upsertQuote({ userId: "u1", clientQuoteId: "cq-x", payload: { totalUsd: 50 } });
    pool._tables.quotes[0].status = "deleted";
    await upsertQuote({ userId: "u1", clientQuoteId: "cq-x", payload: { totalUsd: 75 }, status: "completed" });
    assert.equal(pool._tables.quotes[0].status, "deleted");
    assert.equal(Number(pool._tables.quotes[0].total_usd), 75);
    void ins;
  });

  it("extracts totals from common payload shapes", async () => {
    await upsertQuote({ userId: "u1", payload: { totals: { usd: 999.99, uyu: 41000 } } });
    const row = pool._tables.quotes[0];
    assert.equal(Number(row.total_usd), 999.99);
    assert.equal(Number(row.total_uyu), 41000);
  });
});

describe("listMyQuotes", () => {
  it("filters out deleted by default", async () => {
    await upsertQuote({ userId: "u1", payload: { totalUsd: 10 } });
    const r = await upsertQuote({ userId: "u1", payload: { totalUsd: 20 } });
    pool._tables.quotes.find((q) => q.quote_id === r.quote_id).status = "deleted";
    const list = await listMyQuotes({ userId: "u1" });
    assert.equal(list.length, 1);
  });

  it("respects limit", async () => {
    for (let i = 0; i < 5; i++) await upsertQuote({ userId: "u1", payload: { totalUsd: i } });
    const list = await listMyQuotes({ userId: "u1", limit: 2 });
    assert.equal(list.length, 2);
  });

  it("isolates by user_id", async () => {
    await upsertQuote({ userId: "u1", payload: { totalUsd: 1 } });
    await upsertQuote({ userId: "u2", payload: { totalUsd: 2 } });
    const list = await listMyQuotes({ userId: "u1" });
    assert.equal(list.length, 1);
  });
});

describe("getMyQuote", () => {
  it("returns null for non-owner", async () => {
    const r = await upsertQuote({ userId: "u1", payload: { totalUsd: 1 } });
    const fetched = await getMyQuote({ userId: "u2", quoteId: r.quote_id });
    assert.equal(fetched, null);
  });

  it("returns the quote for its owner", async () => {
    const r = await upsertQuote({ userId: "u1", payload: { totalUsd: 1 } });
    const fetched = await getMyQuote({ userId: "u1", quoteId: r.quote_id });
    assert.equal(fetched.quote_id, r.quote_id);
  });
});

describe("softDeleteQuote", () => {
  it("flips status to deleted and emits event", async () => {
    const r = await upsertQuote({ userId: "u1", payload: { totalUsd: 1 } });
    const evtBefore = pool._tables.quote_events.length;
    const out = await softDeleteQuote({ userId: "u1", quoteId: r.quote_id });
    assert.equal(out.quote_id, r.quote_id);
    assert.equal(pool._tables.quotes[0].status, "deleted");
    assert.ok(pool._tables.quote_events.length > evtBefore);
  });

  it("no-op when quote belongs to a different user", async () => {
    const r = await upsertQuote({ userId: "u1", payload: { totalUsd: 1 } });
    const out = await softDeleteQuote({ userId: "u2", quoteId: r.quote_id });
    assert.equal(out, null);
  });
});

describe("claimAnonymousQuotes", () => {
  it("re-attaches anonymous quotes by client_quote_id list", async () => {
    // Insert anonymous quote (user_id=null) with a client_quote_id.
    pool._tables.quotes.push({
      quote_id: "anon-q-1",
      user_id: null,
      client_quote_id: "cq-anon",
      payload: {},
      status: "draft",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const out = await claimAnonymousQuotes({ userId: "u1", clientQuoteIds: ["cq-anon", "cq-other"] });
    assert.equal(out.claimed, 1);
    assert.equal(pool._tables.quotes[0].user_id, "u1");
  });

  it("zero claims for empty list", async () => {
    const out = await claimAnonymousQuotes({ userId: "u1", clientQuoteIds: [] });
    assert.equal(out.claimed, 0);
  });

  it("requires userId", async () => {
    const out = await claimAnonymousQuotes({ userId: null, clientQuoteIds: ["cq-x"] });
    assert.equal(out.claimed, 0);
  });
});
