// TraKtiMe authz regression tests for manual entries and hours-report PDFs.
//
// Run: node --test tests/traktime-authz-regression.test.js

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import * as identityAuth from "../server/lib/identityAuth.js";
import createTraktimeRouter from "../server/routes/traktime.js";
import {
  resetTraktimePoolForTests,
  setTraktimePoolForTests,
} from "../server/lib/traktimeDb.js";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";

const USERS = {
  "u-member": { user_id: "u-member", email: "member@example.com", name: "Member", status: "active" },
  "u-admin": { user_id: "u-admin", email: "admin@example.com", name: "Admin", status: "active" },
};

class PoolShim {
  constructor({ memberships = [] } = {}) {
    this.memberships = new Set(memberships.map(([projectId, userId]) => `${projectId}:${userId}`));
    this.inserts = [];
    this.updates = [];
  }

  async query(sql, params = []) {
    const q = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

    if (q.includes("from identity.users where user_id = $1")) {
      const user = USERS[params[0]];
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }
    if (q.includes("select role from identity.role_grants")) {
      const role = params[0] === "u-admin" ? "admin" : "comprador";
      return { rows: [{ role }], rowCount: 1 };
    }
    if (q.startsWith("update identity.users set last_active_at")) {
      return { rows: [], rowCount: 1 };
    }

    if (q.includes("from tk_project_members where project_id = $1 and user_id = $2")) {
      const ok = this.memberships.has(`${params[0]}:${params[1]}`);
      return { rows: ok ? [{ "?column?": 1 }] : [], rowCount: ok ? 1 : 0 };
    }
    if (q.startsWith("select 1")) return { rows: [{ "?column?": 1 }], rowCount: 1 };

    if (q.startsWith("insert into tk_entries")) {
      this.inserts.push(params);
      return {
        rows: [{ entry_id: "entry-new", user_id: params[0], project_id: params[1] }],
        rowCount: 1,
      };
    }
    if (q.includes("select user_id, invoice_line_id from tk_entries where entry_id = $1")) {
      return { rows: [{ user_id: "u-member", invoice_line_id: null }], rowCount: 1 };
    }
    if (q.startsWith("update tk_entries set")) {
      this.updates.push(params);
      return {
        rows: [{ entry_id: params.at(-1), user_id: "u-member", project_id: params[0] }],
        rowCount: 1,
      };
    }
    if (q.includes("from tk_entries e") && q.includes("join tk_projects")) {
      return { rows: [], rowCount: 0 };
    }
    if (q.includes("select user_id as id, email, name from identity.users")) {
      const user = USERS[params[0]];
      return {
        rows: user ? [{ id: user.user_id, email: user.email, name: user.name }] : [],
        rowCount: user ? 1 : 0,
      };
    }
    if (q.startsWith("insert into tk_audit_log")) return { rows: [], rowCount: 1 };

    throw new Error(`unhandled query: ${q}`);
  }
}

function bearerFor(userId) {
  const token = jwt.sign(
    { sub: userId, sid: "sess-test", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 60 * 15,
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  );
  return `Bearer ${token}`;
}

async function withServer(pool, fn) {
  setTraktimePoolForTests(pool);
  identityAuth.initIdentityAuth({
    pool,
    logger: { warn() {}, error() {}, info() {} },
  });
  const app = express();
  app.use(express.json());
  app.use(createTraktimeRouter({ databaseUrl: "postgres://test" }, { warn() {}, error() {}, info() {} }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

describe("TraKtiMe manual entry project authorization", () => {
  beforeEach(async () => {
    identityAuth.__test__.reset();
    await resetTraktimePoolForTests();
  });

  afterEach(async () => {
    identityAuth.__test__.reset();
    await resetTraktimePoolForTests();
  });

  it("forbids non-admin entry creation on projects outside their membership", async () => {
    const pool = new PoolShim();
    await withServer(pool, async (base) => {
      const r = await jsonFetch(`${base}/api/traktime/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bearerFor("u-member") },
        body: JSON.stringify({
          project_id: "project-private",
          started_at: "2026-06-11T09:00:00-03:00",
          stopped_at: "2026-06-11T10:00:00-03:00",
        }),
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error, "not_a_member");
      assert.equal(pool.inserts.length, 0);
    });
  });

  it("allows member entry creation on their own project", async () => {
    const pool = new PoolShim({ memberships: [["project-member", "u-member"]] });
    await withServer(pool, async (base) => {
      const r = await jsonFetch(`${base}/api/traktime/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: bearerFor("u-member") },
        body: JSON.stringify({
          project_id: "project-member",
          started_at: "2026-06-11T09:00:00-03:00",
          stopped_at: "2026-06-11T10:00:00-03:00",
        }),
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.entry.project_id, "project-member");
      assert.equal(pool.inserts.length, 1);
    });
  });

  it("forbids non-admin moving an existing entry to a non-member project", async () => {
    const pool = new PoolShim();
    await withServer(pool, async (base) => {
      const r = await jsonFetch(`${base}/api/traktime/entries/entry-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: bearerFor("u-member") },
        body: JSON.stringify({ project_id: "project-private" }),
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error, "not_a_member");
      assert.equal(pool.updates.length, 0);
    });
  });
});

describe("TraKtiMe hours report PDF exposure", () => {
  beforeEach(async () => {
    identityAuth.__test__.reset();
    await resetTraktimePoolForTests();
  });

  afterEach(async () => {
    identityAuth.__test__.reset();
    await resetTraktimePoolForTests();
  });

  it("month-report does not return a permanent public GCS PDF URL", async () => {
    const pool = new PoolShim();
    await withServer(pool, async (base) => {
      const r = await jsonFetch(`${base}/api/traktime/month-report?month=2026-06`, {
        headers: { Authorization: bearerFor("u-member") },
      });
      assert.equal(r.status, 200);
      assert.equal(r.body.pdf_url, null);
      assert.equal(r.body.pdf_download_url, "/api/traktime/month-report.pdf?month=2026-06");
      assert.doesNotMatch(JSON.stringify(r.body), /storage\.googleapis\.com/);
    });
  });

  it("month-report.pdf remains bearer-authenticated", async () => {
    const pool = new PoolShim();
    await withServer(pool, async (base) => {
      const r = await jsonFetch(`${base}/api/traktime/month-report.pdf?month=2026-06`);
      assert.equal(r.status, 401);
      assert.equal(r.body.error, "missing_credentials");
    });
  });
});
