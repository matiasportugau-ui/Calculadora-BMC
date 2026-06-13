// TraKtiMe × ActivityWatch (opt-in) — offline test.
//  1. activityWatchClient.getTodaySummary aggregates window events per app.
//  2. The real /api/activity router requires auth (401 without bearer).
//  3. The traktime_activity_today agent tool maps to /api/activity/today and
//     handles both enabled (summary) and disabled (aw_disabled) cases.
// No real ActivityWatch, no DB, no network.
//
// Run: node tests/traktime-activity.test.js

import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../server/config.js";
import { awEnabled, getTodaySummary, startOfLocalDayIso } from "../server/lib/activityWatchClient.js";
import createActivityRouter from "../server/routes/activity.js";
import { executeTool } from "../server/lib/agentTools.js";
import * as identityAuth from "../server/lib/identityAuth.js";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

function reqJson(port, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let c = ""; res.on("data", (d) => (c += d));
      res.on("end", () => { let b = null; try { b = c ? JSON.parse(c) : null; } catch { b = { raw: c }; } resolve({ status: res.statusCode, body: b }); });
    });
    r.on("error", reject); r.end();
  });
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

function makeIdentityPool() {
  const users = new Map([
    ["u-buyer", {
      user_id: "u-buyer",
      email: "buyer@example.com",
      name: "Buyer",
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
    }],
    ["u-operator", {
      user_id: "u-operator",
      email: "operator@example.com",
      name: "Operator",
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
    }],
  ]);
  const roles = new Map([
    ["u-buyer", [{ role: "comprador" }]],
    ["u-operator", [{ role: "operator" }]],
  ]);
  return {
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
      if (norm.startsWith("select user_id, email, name, picture_url, avatar_preset, plan_tier, status, jwt_revoked_at")) {
        const user = users.get(params[0]);
        return { rows: user ? [user] : [] };
      }
      if (norm.startsWith("select role from identity.role_grants")) {
        return { rows: roles.get(params[0]) || [] };
      }
      if (norm.startsWith("update identity.users set last_active_at = now()")) {
        return { rows: [] };
      }
      throw new Error(`unhandled identity SQL in activity test: ${norm.slice(0, 100)}`);
    },
  };
}

async function main() {
  console.log("\n═══ TraKtiMe · ActivityWatch (offline) ═══");
  const saved = {
    awEnabled: config.traktimeAwEnabled,
    awBaseUrl: config.traktimeAwBaseUrl,
    port: config.port,
  };

  // ── 0. startOfLocalDayIso handles DST-transition days ─────────────────────
  // NY spring-forward 2026-03-08: at 16:00Z (EDT, -4h) the offset differs from
  // local midnight (EST, -5h). Day start must be 05:00Z, not 04:00Z.
  {
    const s = startOfLocalDayIso("America/New_York", new Date("2026-03-08T16:00:00Z"));
    assert("DST day start = 05:00Z (offset at midnight, not now)", s === "2026-03-08T05:00:00.000Z", s);
    // Montevideo (no DST today) sanity: a fixed UTC instant maps to -03:00 midnight.
    const uy = startOfLocalDayIso("America/Montevideo", new Date("2026-06-13T12:00:00Z"));
    assert("UY day start = 03:00Z", uy === "2026-06-13T03:00:00.000Z", uy);
  }

  // ── Stub aw-server ────────────────────────────────────────────────────────
  let bucketHits = 0;
  const aw = express();
  aw.get("/api/0/buckets/", (_req, res) => {
    bucketHits += 1;
    res.json({ "aw-watcher-window_host": { id: "aw-watcher-window_host", type: "currentwindow" } });
  });
  aw.get("/api/0/buckets/:id/events", (_req, res) => res.json([
    { duration: 3600, data: { app: "Code", title: "a.js" } },
    { duration: 1800, data: { app: "Code", title: "b.js" } },
    { duration: 600, data: { app: "Chrome", title: "gmail" } },
  ]));
  const awServer = await new Promise((r) => { const s = aw.listen(0, "127.0.0.1", () => r(s)); });
  const awPort = awServer.address().port;

  // ── 1. Client aggregation ─────────────────────────────────────────────────
  config.traktimeAwEnabled = true;
  config.traktimeAwBaseUrl = `http://127.0.0.1:${awPort}`;
  assert("awEnabled() reflects config", awEnabled() === true);
  {
    const s = await getTodaySummary({ tz: "America/Montevideo" });
    assert("total_active_seconds = 6000", s.total_active_seconds === 6000, String(s.total_active_seconds));
    const code = s.by_app.find((a) => a.app === "Code");
    assert("Code aggregated to 5400s", code?.seconds === 5400, JSON.stringify(code));
    assert("Code sample titles captured", code?.sample_titles.includes("a.js") && code?.sample_titles.includes("b.js"), JSON.stringify(code?.sample_titles));
    assert("by_app sorted desc (Code first)", s.by_app[0]?.app === "Code", JSON.stringify(s.by_app.map((a) => a.app)));
  }

  // ── 2. Real router requires auth ──────────────────────────────────────────
  {
    identityAuth.__test__.reset();
    identityAuth.initIdentityAuth({
      pool: makeIdentityPool(),
      logger: { warn() {}, error() {}, info() {} },
    });
    const app = express();
    app.use(express.json());
    app.use(createActivityRouter(config, console));
    const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const port = srv.address().port;
    const a = await reqJson(port, "GET", "/api/activity/today");
    assert("activity/today → 401 without bearer", a.status === 401, `status=${a.status}`);
    const b = await reqJson(port, "GET", "/api/activity/status");
    assert("activity/status → 401 without bearer", b.status === 401, `status=${b.status}`);
    const hitsBeforeForbidden = bucketHits;
    const c = await reqJson(port, "GET", "/api/activity/today", { Authorization: bearerFor("u-buyer") });
    assert("activity/today → 403 for comprador JWT", c.status === 403, `status=${c.status} body=${JSON.stringify(c.body)}`);
    assert("forbidden comprador does not query aw-server", bucketHits === hitsBeforeForbidden, `hits=${bucketHits} before=${hitsBeforeForbidden}`);
    const d = await reqJson(port, "GET", "/api/activity/today", { Authorization: bearerFor("u-operator") });
    assert("activity/today → 200 for operator JWT", d.status === 200 && d.body?.ok === true, `status=${d.status} body=${JSON.stringify(d.body)}`);
    assert("operator response carries ActivityWatch summary", d.body?.total_active_seconds === 6000 && d.body?.by_app?.[0]?.app === "Code", JSON.stringify(d.body));
    await new Promise((r) => srv.close(r));
  }

  // ── 3. Agent tool: enabled (summary) + disabled (aw_disabled) ──────────────
  {
    let mode = "enabled";
    const stub = express();
    stub.get("/api/activity/today", (_req, res) => {
      if (mode === "disabled") return res.status(404).json({ ok: false, error: "aw_disabled" });
      res.json({ ok: true, date: "2026-06-13", tz: "America/Montevideo", total_active_seconds: 6000, by_app: [{ app: "Code", seconds: 5400, sample_titles: ["a.js"] }] });
    });
    const srv = await new Promise((r) => { const s = stub.listen(0, "127.0.0.1", () => r(s)); });
    config.port = srv.address().port;

    const en = JSON.parse(await executeTool("traktime_activity_today", {}, {}, { callerAuthToken: "jwt" }));
    assert("tool enabled → ok + enabled:true", en.ok === true && en.enabled === true, JSON.stringify(en));
    assert("tool enabled → carries by_app + total", en.total_active_seconds === 6000 && en.by_app?.[0]?.app === "Code", JSON.stringify(en));

    mode = "disabled";
    const dis = JSON.parse(await executeTool("traktime_activity_today", {}, {}, { callerAuthToken: "jwt" }));
    assert("tool disabled → ok + enabled:false + hint", dis.ok === true && dis.enabled === false && /opt-in|TRAKTIME_AW_ENABLED/.test(dis.note || ""), JSON.stringify(dis));

    const noauth = JSON.parse(await executeTool("traktime_activity_today", {}, {}, {}));
    assert("tool without identity → requires user", noauth.ok === false && noauth.error === "traktime_requires_user_identity", JSON.stringify(noauth));

    await new Promise((r) => srv.close(r));
  }

  await new Promise((r) => awServer.close(r));
  Object.assign(config, { traktimeAwEnabled: saved.awEnabled, traktimeAwBaseUrl: saved.awBaseUrl, port: saved.port });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
