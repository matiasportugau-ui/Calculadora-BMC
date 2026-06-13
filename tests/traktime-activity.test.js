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
import { config } from "../server/config.js";
import { awEnabled, getTodaySummary } from "../server/lib/activityWatchClient.js";
import createActivityRouter from "../server/routes/activity.js";
import { executeTool } from "../server/lib/agentTools.js";

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

async function main() {
  console.log("\n═══ TraKtiMe · ActivityWatch (offline) ═══");
  const saved = {
    awEnabled: config.traktimeAwEnabled,
    awBaseUrl: config.traktimeAwBaseUrl,
    port: config.port,
  };

  // ── Stub aw-server ────────────────────────────────────────────────────────
  const aw = express();
  aw.get("/api/0/buckets/", (_req, res) => res.json({ "aw-watcher-window_host": { id: "aw-watcher-window_host", type: "currentwindow" } }));
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
    const app = express();
    app.use(express.json());
    app.use(createActivityRouter(config, console));
    const srv = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
    const port = srv.address().port;
    const a = await reqJson(port, "GET", "/api/activity/today");
    assert("activity/today → 401 without bearer", a.status === 401, `status=${a.status}`);
    const b = await reqJson(port, "GET", "/api/activity/status");
    assert("activity/status → 401 without bearer", b.status === 401, `status=${b.status}`);
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
