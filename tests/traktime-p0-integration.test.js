/**
 * TraKtiMe P0 integration — drives the **shipped** Express router against a real
 * Postgres `tk_*` schema (DATABASE_URL) with an identity JWT shim for requireUser().
 *
 * Run: node tests/traktime-p0-integration.test.js
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import createTraktimeRouter from "../server/routes/traktime.js";
import { resetTraktimePoolForTests } from "../server/lib/traktimeDb.js";

const identityAuth = await import("../server/lib/identityAuth.js");

const databaseUrl = process.env.DATABASE_URL || "";
const hasDb = Boolean(databaseUrl);

if (!process.env.IDENTITY_JWT_SECRET || process.env.IDENTITY_JWT_SECRET.length < 32) {
  process.env.IDENTITY_JWT_SECRET = "test_traktime_p0_identity_secret_32chars_x";
}
if (process.env.WA_JWT_SECRET === process.env.IDENTITY_JWT_SECRET) {
  process.env.WA_JWT_SECRET = "wa_test_secret_different_from_identity_p0_xx";
}
process.env.APP_ENV = process.env.APP_ENV || "test";

const JWT_ISSUER = "bmc-identity";
const JWT_AUDIENCE = "bmc-identity-api";
const TEST_USER_ID = "a0000000-0000-4000-8000-0000000000b1";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function makeIdentityShim() {
  const user = {
    user_id: TEST_USER_ID,
    email: "traktime-p0@example.com",
    name: "TraKtiMe P0 Test",
    picture_url: null,
    avatar_preset: null,
    plan_tier: "plus",
    status: "active",
    jwt_revoked_at: null,
  };
  return {
    async query(sql, params = []) {
      const norm = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      if (
        norm.startsWith(
          "select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at",
        )
      ) {
        return { rows: params[0] === TEST_USER_ID ? [user] : [] };
      }
      if (norm.startsWith("select role from identity.role_grants")) {
        return { rows: params[0] === TEST_USER_ID ? [{ role: "admin" }] : [] };
      }
      if (norm.startsWith("select module, level from identity.module_grants")) {
        return { rows: [] };
      }
      if (norm.startsWith("update identity.users set last_active_at")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function signAccessToken() {
  return jwt.sign(
    { sub: TEST_USER_ID, sid: "sess-traktime-p0" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    },
  );
}

function requestJson(port, method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const data = body != null ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const req = http.request(
      { host: "127.0.0.1", port, method, path, headers },
      (res) => {
        let chunks = "";
        res.on("data", (d) => {
          chunks += d;
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = { raw: chunks };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("\n═══ TraKtiMe · P0 integration (shipped router + DB) ═══");

  if (!hasDb) {
    console.log("  ⏭  SKIP — DATABASE_URL not set");
    process.exit(0);
  }

  const probe = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const reg = await probe.query(`select to_regclass('public.tk_entries') as t`);
    if (!reg.rows[0]?.t) {
      console.log("  ⏭  SKIP — tk_entries missing (run npm run traktime:migrate)");
      await probe.end();
      process.exit(0);
    }
  } catch (e) {
    console.log(`  ⏭  SKIP — DB probe failed: ${e.message}`);
    await probe.end();
    process.exit(0);
  }

  const stamp = Date.now();
  const clientName = `P0 Client ${stamp}`;
  const projectName = `P0 Project ${stamp}`;
  let clientId = null;
  let projectId = null;
  let entryId = null;
  let closedEntryId = null;

  await resetTraktimePoolForTests();
  identityAuth.__test__.reset();
  identityAuth.initIdentityAuth({
    pool: makeIdentityShim(),
    logger: { warn() {}, error() {}, info() {} },
  });
  const token = signAccessToken();

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(
    createTraktimeRouter(
      {
        databaseUrl,
        traktimeInvoiceGcsBucket: process.env.TRAKTIME_INVOICE_GCS_BUCKET || "",
        traktimeInvoiceIssuerName: "P0 Test Issuer",
        traktimePausaThresholdMin: 30,
      },
      { warn() {}, error() {}, info() {} },
    ),
  );

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  try {
    {
      const r = await requestJson(port, "GET", "/api/traktime/health");
      assert("health → 200 ok:true", r.status === 200 && r.body?.ok === true, JSON.stringify(r));
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/timer/start", {
        body: { project_id: "00000000-0000-4000-8000-000000000099" },
      });
      assert("timer/start without token → 401", r.status === 401, `status=${r.status}`);
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/clients", {
        token,
        body: { name: clientName },
      });
      assert("create client → 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r.body));
      clientId = r.body?.client?.client_id;
      assert("client_id returned", !!clientId, String(clientId));
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/projects", {
        token,
        body: {
          client_id: clientId,
          name: projectName,
          hourly_rate_usd: 50,
          billable_default: true,
        },
      });
      assert("create project → 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r.body));
      projectId = r.body?.project?.project_id;
      assert("project_id returned", !!projectId, String(projectId));
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/tags", {
        token,
        body: { name: `p0-tag-${stamp}` },
      });
      assert(
        "create tag → 201 or exists",
        (r.status === 201 || r.status === 200) && r.body?.ok !== false,
        JSON.stringify(r.body),
      );
    }
    {
      const r = await requestJson(port, "GET", "/api/traktime/timer/current", { token });
      assert("timer current → 200", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
      if (r.body?.running) {
        await requestJson(port, "POST", "/api/traktime/timer/stop", { token });
      }
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/timer/start", {
        token,
        body: { project_id: projectId, description: "p0-timer" },
      });
      assert("timer start → 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r.body));
      entryId = r.body?.entry?.entry_id;
      assert("running entry_id", !!entryId);
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/timer/start", {
        token,
        body: { project_id: projectId, description: "dup" },
      });
      assert(
        "second timer start → 409 timer_already_running",
        r.status === 409 && r.body?.error === "timer_already_running",
        JSON.stringify(r.body),
      );
    }
    {
      const r = await requestJson(port, "GET", "/api/traktime/timer/current", { token });
      assert(
        "timer current has running entry",
        r.status === 200 && r.body?.running?.entry_id === entryId,
        JSON.stringify(r.body),
      );
    }
    {
      const r = await requestJson(port, "POST", "/api/traktime/timer/stop", { token });
      assert("timer stop → 200", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
      assert("stopped_at set", !!r.body?.entry?.stopped_at, JSON.stringify(r.body?.entry));
    }
    {
      const started = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const stopped = new Date(Date.now() - 3600 * 1000).toISOString();
      const r = await requestJson(port, "POST", "/api/traktime/entries", {
        token,
        body: {
          project_id: projectId,
          started_at: started,
          stopped_at: stopped,
          description: "p0-manual",
          billable: true,
        },
      });
      assert("create entry → 201", r.status === 201 && r.body?.ok === true, JSON.stringify(r.body));
      closedEntryId = r.body?.entry?.entry_id;
    }
    {
      const r = await requestJson(port, "GET", `/api/traktime/entries?project_id=${projectId}&limit=50`, {
        token,
      });
      assert("list entries → 200", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
      const n = (r.body?.entries || []).length;
      assert("list has ≥1 entry", n >= 1, `n=${n}`);
    }
    if (closedEntryId) {
      const r = await requestJson(port, "PATCH", `/api/traktime/entries/${closedEntryId}`, {
        token,
        body: { description: "p0-manual-patched" },
      });
      assert("patch entry → 200", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
    }
    {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const r = await requestJson(port, "GET", `/api/traktime/day-report?date=${date}`, { token });
      assert("day-report → 200 ok", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
      assert("day-report tz Montevideo", r.body?.tz === "America/Montevideo", r.body?.tz);
      assert("day-report has day object", r.body?.day && typeof r.body.day === "object", JSON.stringify(r.body?.day));
      assert(
        "day-report exposes jornada/effective fields",
        "jornada_seconds" in (r.body?.day || {}) && "effective_seconds" in (r.body?.day || {}),
        JSON.stringify(r.body?.day),
      );
    }
    {
      const month = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
      })
        .format(new Date())
        .slice(0, 7);
      const r = await requestJson(port, "GET", `/api/traktime/month-report?month=${month}`, { token });
      assert("month-report → 200 ok", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
      assert(
        "month-report has report payload",
        r.body?.report && typeof r.body.report === "object",
        JSON.stringify(r.body?.report),
      );
      assert(
        "month-report pdf path field present (url or null)",
        "pdf_url" in (r.body || {}) || r.body?.pdf_rendered === false || r.body?.report,
        JSON.stringify({ pdf_url: r.body?.pdf_url, pdf_rendered: r.body?.pdf_rendered }),
      );
    }
    {
      const r = await requestJson(port, "GET", `/api/traktime/reports/billable?client_id=${clientId}`, {
        token,
      });
      assert("billable report → 200", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body));
    }
    if (closedEntryId) {
      const r = await requestJson(port, "DELETE", `/api/traktime/entries/${closedEntryId}`, { token });
      assert(
        "delete entry → 200 or 204",
        r.status === 200 || r.status === 204 || (r.status === 200 && r.body?.ok),
        JSON.stringify(r),
      );
    }
    assert("CLOCKIFY_API_KEY not required for P0", true);
  } finally {
    try {
      if (projectId) {
        await probe.query(`delete from tk_entries where project_id = $1`, [projectId]);
        await probe.query(`delete from tk_project_members where project_id = $1`, [projectId]);
        await probe.query(`delete from tk_tasks where project_id = $1`, [projectId]);
        await probe.query(`delete from tk_projects where project_id = $1`, [projectId]);
      }
      if (clientId) {
        await probe.query(`delete from tk_clients where client_id = $1`, [clientId]);
      }
      await probe.query(`delete from tk_entries where user_id = $1`, [TEST_USER_ID]);
      await probe.query(`delete from tk_tags where name like $1`, [`p0-tag-${stamp}%`]).catch(() => {});
    } catch (e) {
      console.log(`  ⚠ cleanup: ${e.message}`);
    }
    await new Promise((r) => server.close(r));
    await resetTraktimePoolForTests();
    identityAuth.__test__.reset();
    await probe.end();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
