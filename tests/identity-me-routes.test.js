// ═══════════════════════════════════════════════════════════════════════════
// tests/identity-me-routes.test.js — integration tests for /api/me/*
// + /api/access-requests + /api/admin/access-requests endpoints.
// ───────────────────────────────────────────────────────────────────────────
// Spins up Express with the real router from server/routes/identityMe.js,
// stubs identity.users via the in-memory pg shim, exercises:
//   - GET  /api/me/notifications + PATCH (mark read)
//   - POST /api/access-requests + GET /api/me/access-requests
//   - PATCH /api/admin/access-requests/:id grant flow
//   - POST /api/me/special-quote-requests (rejects ≤8500, accepts >8500)
//   - GET/POST/DELETE /api/me/quotes
//   - GET /api/admin/sheets/clientes/status
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";

process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.APP_ENV = "test";

const identityAuth = await import("../server/lib/identityAuth.js");
const quoteStore = await import("../server/lib/quoteStore.js");
const identityMeModule = await import("../server/routes/identityMe.js");
const identityMeRouter = identityMeModule.default;
const identityMeTest = identityMeModule.__test__;

// ─── Shim ──────────────────────────────────────────────────────────────

function makeShim() {
  const tables = {
    users: [
      { user_id: "u-comprador", email: "comp@x.com", name: "Comp", picture_url: null, avatar_preset: null, plan_tier: "base", status: "active", jwt_revoked_at: null },
      { user_id: "u-admin",     email: "adm@x.com", name: "Adm",  picture_url: null, avatar_preset: null, plan_tier: "plus", status: "active", jwt_revoked_at: null },
    ],
    role_grants: [
      { user_id: "u-comprador", role: "comprador" },
      { user_id: "u-admin",     role: "admin"     },
      { user_id: "u-admin",     role: "superadmin" }, // double role for fan-out test
    ],
    module_grants: [],
    sessions: [],
    notifications: [],
    access_requests: [],
    special_quote_requests: [],
    quotes: [],
    quote_events: [],
  };
  let nextSeq = 1;
  function uuid(prefix) { return `${prefix}-${nextSeq++}`; }

  async function query(sql, params = []) {
    const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();

    // identityAuth.requireUser flow:
    if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
      const u = tables.users.find((x) => x.user_id === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("select role from identity.role_grants")) {
      return { rows: tables.role_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("select module, level from identity.module_grants")) {
      return { rows: tables.module_grants.filter((r) => r.user_id === params[0]) };
    }
    if (norm.startsWith("update identity.users set last_active_at = now()")) return { rows: [] };

    // Notifications
    if (norm.startsWith("select notification_id, kind, title, body, payload, read_at, created_at")) {
      const [user_id, limit] = params;
      let rows = tables.notifications.filter((n) => n.user_id === user_id);
      if (norm.includes("read_at is null")) rows = rows.filter((n) => !n.read_at);
      rows = rows.sort((a, b) => +b.created_at - +a.created_at).slice(0, limit);
      return { rows };
    }
    if (norm.startsWith("update identity.notifications")) {
      const [id, user_id] = params;
      const n = tables.notifications.find((x) => x.notification_id === id && x.user_id === user_id);
      if (!n) return { rows: [] };
      n.read_at = n.read_at || new Date();
      return { rows: [{ notification_id: n.notification_id, read_at: n.read_at }] };
    }
    // Multi-row notification fan-out for superadmins (insert into ... values ($1,$2,$3,$4,$5),($6,...))
    if (norm.startsWith("insert into identity.notifications") && norm.includes("$5::jsonb)")) {
      // params come in groups of 5
      for (let i = 0; i < params.length; i += 5) {
        tables.notifications.push({
          notification_id: uuid("n"),
          user_id: params[i],
          kind: params[i + 1],
          title: params[i + 2],
          body: params[i + 3],
          payload: JSON.parse(params[i + 4]),
          read_at: null,
          created_at: new Date(),
        });
      }
      return { rows: [] };
    }
    if (norm.startsWith("insert into identity.notifications")) {
      const [user_id, kind, title, body, payload] = params;
      tables.notifications.push({
        notification_id: uuid("n"),
        user_id, kind, title, body,
        payload: typeof payload === "string" ? JSON.parse(payload) : (payload || {}),
        read_at: null,
        created_at: new Date(),
      });
      return { rows: [] };
    }

    // Superadmin lookup (notifySuperadmins)
    if (norm.startsWith("select user_id from identity.role_grants where role = 'superadmin'")) {
      return { rows: tables.role_grants.filter((r) => r.role === "superadmin").map((r) => ({ user_id: r.user_id })) };
    }

    // Access requests
    if (norm.startsWith("insert into identity.access_requests")) {
      const [user_id, module, notes] = params;
      const rec = {
        request_id: uuid("ar"),
        user_id, module, notes,
        status: "pending",
        resolved_by: null, resolved_at: null,
        created_at: new Date(),
      };
      tables.access_requests.push(rec);
      return { rows: [{ request_id: rec.request_id, status: rec.status, created_at: rec.created_at }] };
    }
    if (norm.startsWith("select request_id, module, status, notes, resolved_at, created_at")) {
      const [user_id] = params;
      return { rows: tables.access_requests.filter((r) => r.user_id === user_id) };
    }
    if (norm.startsWith("select ar.request_id, ar.user_id, u.email, u.name, ar.module")) {
      const [status] = params;
      const rows = tables.access_requests
        .filter((r) => r.status === status)
        .map((r) => ({ ...r, email: tables.users.find((u) => u.user_id === r.user_id)?.email || "?" }));
      return { rows };
    }
    if (norm.startsWith("select user_id, module from identity.access_requests")) {
      const [id] = params;
      const r = tables.access_requests.find((x) => x.request_id === id);
      return { rows: r ? [{ user_id: r.user_id, module: r.module }] : [] };
    }
    if (norm.startsWith("update identity.access_requests")) {
      const [id, decision, actor] = params;
      const r = tables.access_requests.find((x) => x.request_id === id);
      if (r) { r.status = decision; r.resolved_by = actor; r.resolved_at = new Date(); }
      return { rows: [] };
    }
    if (norm.startsWith("insert into identity.module_grants")) {
      const [user_id, module, level, granted_by] = params;
      const existing = tables.module_grants.find((g) => g.user_id === user_id && g.module === module);
      if (existing) { existing.level = level; existing.granted_by = granted_by; }
      else tables.module_grants.push({ user_id, module, level, granted_by });
      return { rows: [] };
    }

    // Special quote requests
    if (norm.startsWith("select quote_id, total_usd from identity.quotes")) {
      const [quote_id, user_id] = params;
      const q = tables.quotes.find((x) => x.quote_id === quote_id && x.user_id === user_id && x.status !== "deleted");
      return { rows: q ? [{ quote_id: q.quote_id, total_usd: q.total_usd }] : [] };
    }
    if (norm.startsWith("insert into identity.special_quote_requests")) {
      const [quote_id, user_id, notes] = params;
      const r = {
        request_id: uuid("sqr"),
        quote_id, user_id, notes,
        status: "open",
        created_at: new Date(),
      };
      tables.special_quote_requests.push(r);
      return { rows: [{ request_id: r.request_id, status: r.status, created_at: r.created_at }] };
    }
    if (norm.startsWith("select sqr.request_id")) {
      const [user_id] = params;
      return {
        rows: tables.special_quote_requests
          .filter((r) => r.user_id === user_id)
          .map((r) => {
            const q = tables.quotes.find((x) => x.quote_id === r.quote_id);
            return { ...r, total_usd: q?.total_usd || null };
          }),
      };
    }

    // Quote endpoints (delegate-friendly)
    if (norm.startsWith("update identity.quotes set payload")) return { rows: [] };

    // claimAnonymousQuotes
    if (norm.startsWith("update identity.quotes set user_id = $1 where user_id is null")) {
      const [user_id, ids] = params;
      let count = 0;
      for (const r of tables.quotes) {
        if (r.user_id === null && Array.isArray(ids) && ids.includes(r.client_quote_id)) {
          r.user_id = user_id;
          count += 1;
        }
      }
      return { rowCount: count, rows: [] };
    }
    if (norm.startsWith("insert into identity.quotes")) {
      const [user_id, client_quote_id, payload, total_usd] = params;
      const q = {
        quote_id: uuid("q"),
        user_id, client_quote_id,
        payload: JSON.parse(payload),
        total_usd: total_usd != null ? Number(total_usd) : null,
        total_uyu: null,
        status: params[10] || "draft",
        pdf_url: params[6] || null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      tables.quotes.push(q);
      return { rows: [{ ...q }] };
    }
    if (norm.startsWith("insert into identity.quote_events")) return { rows: [] };
    if (norm.startsWith("select quote_id, client_quote_id, total_usd, total_uyu, status,")) {
      const [user_id, limit] = params;
      const rows = tables.quotes
        .filter((q) => q.user_id === user_id && q.status !== "deleted")
        .sort((a, b) => +b.created_at - +a.created_at).slice(0, limit);
      return { rows };
    }

    throw new Error(`unhandled SQL: ${norm.slice(0, 120)}`);
  }
  return { query, _tables: tables };
}

// ─── Auth helper: produce a raw access JWT for a given user_id ─────────

import jwt from "jsonwebtoken";
function bearerFor(userId) {
  const token = jwt.sign(
    { sub: userId, sid: "test-sess", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 60 * 15,
      // Match production claims (round-11 hardening).
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  );
  return `Bearer ${token}`;
}

// ─── App setup ─────────────────────────────────────────────────────────

let server, port;
let pool;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(identityMeRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => { port = server.address().port; resolve(); });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  identityAuth.__test__.reset();
  pool = makeShim();
  identityAuth.initIdentityAuth({ pool, logger: { warn() {}, error() {}, info() {} } });
  quoteStore.__test__.setPool(pool);
  identityMeTest.setPool(pool);
});

function url(p) { return `http://127.0.0.1:${port}${p}`; }

// ─── Tests ─────────────────────────────────────────────────────────────

describe("GET /api/me/notifications", () => {
  it("401 unauthenticated", async () => {
    const r = await fetch(url("/api/me/notifications"));
    assert.equal(r.status, 401);
  });

  it("returns user inbox sorted by created_at desc", async () => {
    pool._tables.notifications.push(
      { notification_id: "n1", user_id: "u-comprador", kind: "system", title: "old", body: "", payload: {}, read_at: null, created_at: new Date(Date.now() - 1e5) },
      { notification_id: "n2", user_id: "u-comprador", kind: "system", title: "new", body: "", payload: {}, read_at: null, created_at: new Date() },
    );
    const r = await fetch(url("/api/me/notifications"), { headers: { Authorization: bearerFor("u-comprador") } });
    const j = await r.json();
    assert.equal(j.items.length, 2);
    assert.equal(j.items[0].title, "new");
  });

  it("PATCH marks a notification read (idempotent)", async () => {
    pool._tables.notifications.push({ notification_id: "n3", user_id: "u-comprador", kind: "system", title: "x", body: "", payload: {}, read_at: null, created_at: new Date() });
    const r = await fetch(url("/api/me/notifications/n3"), {
      method: "PATCH",
      headers: { Authorization: bearerFor("u-comprador") },
    });
    assert.equal(r.status, 200);
    assert.ok(pool._tables.notifications[0].read_at);
  });
});

describe("POST /api/access-requests", () => {
  it("inserts a pending row + fans out notifications to superadmins", async () => {
    const r = await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "wa", notes: "necesito acceso" }),
    });
    assert.equal(r.status, 200);
    assert.equal(pool._tables.access_requests.length, 1);
    // Superadmin notifications fan-out (in shim, only u-admin has superadmin)
    const nFan = pool._tables.notifications.filter((n) => n.kind === "access_request");
    assert.ok(nFan.length >= 1);
  });

  // Self-audit fix: notification payload must NOT include requester email.
  it("notification payload does NOT include requester_email (PII scrub)", async () => {
    await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "ml" }),
    });
    const n = pool._tables.notifications.find((x) => x.kind === "access_request");
    assert.ok(n, "fan-out notification should exist");
    assert.equal(n.payload.requester_email, undefined, "structured PII must not be in payload");
    // requester_id is fine — it's a UUID, not PII.
    assert.ok(n.payload.requester_id);
  });

  it("rejects an unknown module", async () => {
    const r = await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "not_a_module" }),
    });
    assert.equal(r.status, 400);
  });
});

describe("PATCH /api/admin/access-requests/:id (grant flow)", () => {
  it("grants module access on decision='granted'", async () => {
    // arrange: comprador requests
    await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "wa" }),
    });
    const reqId = pool._tables.access_requests[0].request_id;

    const r = await fetch(url(`/api/admin/access-requests/${reqId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-admin") },
      body: JSON.stringify({ decision: "granted", level: "read" }),
    });
    assert.equal(r.status, 200);
    const grant = pool._tables.module_grants.find((g) => g.user_id === "u-comprador" && g.module === "wa");
    assert.ok(grant);
    assert.equal(grant.level, "read");
  });

  it("403 when caller is not admin", async () => {
    const r = await fetch(url("/api/admin/access-requests/anything"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ decision: "granted" }),
    });
    assert.equal(r.status, 403);
  });

  // cursor[bot] F-2: level enum must be enforced.
  it("400 invalid_level when admin supplies a non-canonical level", async () => {
    // arrange: comprador requests
    await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "wa" }),
    });
    const reqId = pool._tables.access_requests[0].request_id;

    const r = await fetch(url(`/api/admin/access-requests/${reqId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-admin") },
      body: JSON.stringify({ decision: "granted", level: "superadmin" }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "invalid_level");
    assert.deepEqual([...j.allowed].sort(), ["admin", "none", "read", "write"]);
    // module_grants must NOT have been written.
    const grant = pool._tables.module_grants.find(
      (g) => g.user_id === "u-comprador" && g.module === "wa",
    );
    assert.equal(grant, undefined);
  });

  it("accepts omitted level (defaults to 'read')", async () => {
    await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "ml" }),
    });
    const reqId = pool._tables.access_requests.find((x) => x.module === "ml").request_id;

    const r = await fetch(url(`/api/admin/access-requests/${reqId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-admin") },
      body: JSON.stringify({ decision: "granted" }),
    });
    assert.equal(r.status, 200);
    const grant = pool._tables.module_grants.find(
      (g) => g.user_id === "u-comprador" && g.module === "ml",
    );
    assert.equal(grant.level, "read");
  });
});

describe("POST /api/me/special-quote-requests", () => {
  function seedQuote(totalUsd) {
    const id = `q-${pool._tables.quotes.length + 1}`;
    pool._tables.quotes.push({
      quote_id: id, user_id: "u-comprador", client_quote_id: null,
      payload: {}, total_usd: totalUsd, total_uyu: null,
      status: "completed", pdf_url: null,
      created_at: new Date(), updated_at: new Date(),
    });
    return id;
  }

  it("rejects when total_usd <= 8500", async () => {
    const id = seedQuote(8500);
    const r = await fetch(url("/api/me/special-quote-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ quoteId: id, notes: "porfa" }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "quote_not_eligible");
  });

  it("accepts when total_usd > 8500 and notifies superadmins", async () => {
    const id = seedQuote(9000);
    const r = await fetch(url("/api/me/special-quote-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ quoteId: id, notes: "presupuesto especial" }),
    });
    assert.equal(r.status, 200);
    assert.equal(pool._tables.special_quote_requests.length, 1);
    const fan = pool._tables.notifications.filter((n) => n.kind === "special_quote");
    assert.ok(fan.length >= 1);
  });

  it("404 when quote isn't owned by the requester", async () => {
    pool._tables.quotes.push({
      quote_id: "owned-by-other", user_id: "u-admin", client_quote_id: null,
      payload: {}, total_usd: 9999, total_uyu: null,
      status: "completed", pdf_url: null,
      created_at: new Date(), updated_at: new Date(),
    });
    const r = await fetch(url("/api/me/special-quote-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ quoteId: "owned-by-other" }),
    });
    assert.equal(r.status, 404);
  });
});

describe("/api/me/quotes lifecycle", () => {
  it("POST upserts then GET lists", async () => {
    const post = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ payload: { totalUsd: 250 }, status: "draft" }),
    });
    assert.equal(post.status, 200);
    const list = await fetch(url("/api/me/quotes"), { headers: { Authorization: bearerFor("u-comprador") } });
    const j = await list.json();
    assert.equal(j.items.length, 1);
  });

  it("rejects POST without payload", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 400);
  });
});

describe("POST /api/me/quotes/claim — W-3 input cap + format check", () => {
  it("filters out garbage IDs and caps at 100", async () => {
    // Seed an anonymous quote that the user could legitimately claim.
    pool._tables.quotes.push({
      quote_id: "q-anon",
      user_id: null,
      client_quote_id: "cq_real_id_12345678",
      payload: {}, total_usd: 0, total_uyu: null,
      status: "draft", pdf_url: null,
      created_at: new Date(), updated_at: new Date(),
    });

    // 105 IDs with mixed validity. Should accept ≤100 valid ones.
    const garbage = ["", null, 42, "; DROP TABLE", "javascript:1", "cq_short"];
    const valid = Array.from({ length: 200 }, (_, i) => `cq_${"x".repeat(8)}_${i}`);
    const submitted = [...garbage, ...valid];

    const r = await fetch(url("/api/me/quotes/claim"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ clientQuoteIds: submitted }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    // Garbage filtered out, the rest capped at 100.
    assert.equal(j.accepted, 100);
    assert.equal(j.submitted, submitted.length);
  });

  it("accepts an empty array as a no-op", async () => {
    const r = await fetch(url("/api/me/quotes/claim"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ clientQuoteIds: [] }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.accepted, 0);
    assert.equal(j.claimed, 0);
  });

  it("rejects non-array body without crashing", async () => {
    const r = await fetch(url("/api/me/quotes/claim"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ clientQuoteIds: "not-an-array" }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.accepted, 0);
  });
});

describe("POST /api/me/quotes — W-1 status allowlist coerces user input", () => {
  it("user-supplied status='completed' is silently coerced to 'draft'", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ payload: { totalUsd: 10 }, status: "completed" }),
    });
    assert.equal(r.status, 200);
    // The DB should have a draft, not a completed row — preventing
    // self-triggered Sheets sync via the reconciler.
    const stored = pool._tables.quotes[pool._tables.quotes.length - 1];
    assert.equal(stored.status, "draft");
  });

  it("user-supplied status='deleted' is also coerced to 'draft' (audit bypass blocked)", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ payload: { totalUsd: 10 }, status: "deleted" }),
    });
    assert.equal(r.status, 200);
    const stored = pool._tables.quotes[pool._tables.quotes.length - 1];
    assert.equal(stored.status, "draft");
  });

  it("status='draft' is accepted as-is", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ payload: { totalUsd: 10 }, status: "draft" }),
    });
    assert.equal(r.status, 200);
    const stored = pool._tables.quotes[pool._tables.quotes.length - 1];
    assert.equal(stored.status, "draft");
  });
});

describe("W-2 notes cap on access/special-quote routes", () => {
  it("/api/access-requests truncates notes to 2000 chars", async () => {
    const longNotes = "x".repeat(5000);
    const r = await fetch(url("/api/access-requests"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({ module: "wa", notes: longNotes }),
    });
    assert.equal(r.status, 200);
    const ar = pool._tables.access_requests[pool._tables.access_requests.length - 1];
    assert.equal(ar.notes.length, 2000);
  });
});

describe("GET /api/admin/access-requests — W-3 status enum guard", () => {
  it("400 invalid_status when status query is not in {pending,granted,denied}", async () => {
    const r = await fetch(url("/api/admin/access-requests?status=garbage"), {
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "invalid_status");
  });

  it("200 with status=pending (default)", async () => {
    const r = await fetch(url("/api/admin/access-requests"), {
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 200);
  });

  it("200 with status=granted", async () => {
    const r = await fetch(url("/api/admin/access-requests?status=granted"), {
      headers: { Authorization: bearerFor("u-admin") },
    });
    assert.equal(r.status, 200);
  });
});

describe("POST /api/me/quotes — H-1 pdf_url validation surfaces 400", () => {
  it("returns 400 invalid_pdf_url for javascript: scheme", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({
        payload: { totalUsd: 10 },
        pdfUrl: "javascript:alert(1)",
      }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "invalid_pdf_url");
  });

  // cursor[bot] round-4 LOW: error response must NOT include `e.detail`,
  // matching the F-1/W-3 pattern from /auth/* routes.
  it("does NOT include detail field on URL-allowlist rejection", async () => {
    const r = await fetch(url("/api/me/quotes"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: bearerFor("u-comprador") },
      body: JSON.stringify({
        payload: { totalUsd: 10 },
        pdfUrl: "https://evil.example.com/quote.pdf",
      }),
    });
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.error, "invalid_pdf_url");
    assert.equal(j.detail, undefined, "wire response must not include e.detail");
  });
});

describe("GET /api/admin/sheets/clientes/status", () => {
  it("403 for comprador", async () => {
    const r = await fetch(url("/api/admin/sheets/clientes/status"), { headers: { Authorization: bearerFor("u-comprador") } });
    assert.equal(r.status, 403);
  });

  it("200 for admin with payload shape", async () => {
    const r = await fetch(url("/api/admin/sheets/clientes/status"), { headers: { Authorization: bearerFor("u-admin") } });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(typeof j.enabled === "boolean");
    assert.ok("tab" in j);
  });
});
