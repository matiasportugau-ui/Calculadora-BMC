// ═══════════════════════════════════════════════════════════════════════════
// tests/public-lead-event.test.js — POST /api/public/lead-event
// ───────────────────────────────────────────────────────────────────────────
// Anonymous (no auth) conversion beacon for the public calculator. Verifies:
//   - a PUBLIC_EMITTABLE action inserts a row with actor_user_id null
//   - a valid-taxonomy-but-not-public action is rejected (can't forge server events)
//   - an unknown action is rejected
//   - a missing action is rejected
// Uses the in-memory pool shim via __test__.setPool — never touches a real DB.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";

const publicLeadEventModule = await import("../server/routes/publicLeadEvent.js");
const publicLeadEventRouter = publicLeadEventModule.default;
const publicLeadEventTest = publicLeadEventModule.__test__;

function makeShim() {
  const inserted = [];
  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (norm.startsWith("insert into identity.user_activity_log")) {
      const [actorId, sessionId, action, module, resourceType, resourceId, outcome, durationMs, ip, userAgent, clientEmitted, payload] = params;
      inserted.push({ actorId, sessionId, action, module, resourceType, resourceId, outcome, durationMs, ip, userAgent, clientEmitted, payload: JSON.parse(payload) });
      return { rows: [] };
    }
    throw new Error(`unshimmed query: ${sql}`);
  }
  return { query, inserted };
}

let server, port, pool;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(publicLeadEventRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => { port = server.address().port; resolve(); });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  pool = makeShim();
  publicLeadEventTest.setPool(pool);
});

function url(p) { return `http://127.0.0.1:${port}${p}`; }

describe("POST /api/public/lead-event", () => {
  it("202 + inserts a row with actor_user_id null for a PUBLIC_EMITTABLE action", async () => {
    const r = await fetch(url("/api/public/lead-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quote.send.whatsapp", payload: { utm: { utm_source: "meta" } } }),
    });
    assert.equal(r.status, 202);
    assert.equal(pool.inserted.length, 1);
    assert.equal(pool.inserted[0].actorId, null);
    assert.equal(pool.inserted[0].action, "quote.send.whatsapp");
    assert.equal(pool.inserted[0].clientEmitted, true);
    assert.deepEqual(pool.inserted[0].payload, { utm: { utm_source: "meta" } });
  });

  it("202 for quote.complete", async () => {
    const r = await fetch(url("/api/public/lead-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quote.complete" }),
    });
    assert.equal(r.status, 202);
    assert.equal(pool.inserted[0].action, "quote.complete");
  });

  it("403 for a real taxonomy action that isn't public-emittable (can't forge server events)", async () => {
    const r = await fetch(url("/api/public/lead-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "admin.role_grant.add" }),
    });
    assert.equal(r.status, 403);
    assert.equal(pool.inserted.length, 0);
  });

  it("403 for an unknown action", async () => {
    const r = await fetch(url("/api/public/lead-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "totally.fake" }),
    });
    assert.equal(r.status, 403);
    assert.equal(pool.inserted.length, 0);
  });

  it("400 for a missing action", async () => {
    const r = await fetch(url("/api/public/lead-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 400);
    assert.equal(pool.inserted.length, 0);
  });
});
