// TraKtiMe ↔ agent tools — offline integration test.
// Mounts a STUB /api/traktime/* router on 127.0.0.1:0, points config.port at
// it, and drives executeTool() for each traktime_* tool. Asserts: correct
// path+method, the user JWT is forwarded as Bearer, writes require explicit
// confirmation, and missing identity yields a clear auth error.
//
// Run: node tests/traktime-agent-tools.test.js

import express from "express";
import { config } from "../server/config.js";
import { executeTool } from "../server/lib/agentTools.js";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

const calls = [];
function record(req) {
  calls.push({
    method: req.method,
    path: req.path,
    auth: req.headers.authorization || null,
    query: req.query,
    body: req.body,
  });
}

async function main() {
  console.log("\n═══ TraKtiMe · agent tools (offline) ═══");

  const app = express();
  app.use(express.json());
  app.get("/api/traktime/timer/current", (req, res) => { record(req); res.json({ ok: true, running: { entry_id: "e1", project_id: "p1", project_name: "Proj", started_at: new Date(Date.now() - 60000).toISOString() } }); });
  app.post("/api/traktime/timer/start", (req, res) => { record(req); res.status(201).json({ ok: true, entry: { entry_id: "e2", project_id: req.body.project_id } }); });
  app.post("/api/traktime/timer/stop", (req, res) => { record(req); res.json({ ok: true, entry: { entry_id: "e1", duration_seconds: 60, started_at: "x", stopped_at: "y" } }); });
  app.get("/api/traktime/entries", (req, res) => { record(req); res.json({ ok: true, entries: [{ entry_id: "e1", project_name: "Proj", duration_seconds: 60 }] }); });
  app.post("/api/traktime/entries", (req, res) => { record(req); res.status(201).json({ ok: true, entry: { entry_id: "e3" } }); });
  app.get("/api/traktime/day-report", (req, res) => { record(req); res.json({ ok: true, date: req.query.date, tz: "America/Montevideo", day: { effective_seconds: 100 } }); });
  app.get("/api/traktime/month-report", (req, res) => { record(req); res.json({ ok: true, month: req.query.month, tz: "America/Montevideo", report: { totals: { effective_seconds: 1 }, projects: [] }, pdf_url: null, pdf_download_url: "/api/traktime/month-report.pdf?month=2026-06" }); });
  app.get("/api/traktime/reports/billable", (req, res) => { record(req); res.json({ ok: true, groups: [], subtotal_usd: 0 }); });

  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const origPort = config.port;
  config.port = server.address().port;
  const TOKEN = "user-jwt-abc";

  try {
    // ── Missing identity → honest auth error, no HTTP call ──────────────────
    {
      calls.length = 0;
      const r = JSON.parse(await executeTool("traktime_timer_current", {}, {}, {}));
      assert("no token → traktime_requires_user_identity", r.ok === false && r.error === "traktime_requires_user_identity", JSON.stringify(r));
      assert("no token → no HTTP call made", calls.length === 0, `calls=${calls.length}`);
    }

    // ── Read: timer_current forwards Bearer + hits right path ───────────────
    {
      calls.length = 0;
      const r = JSON.parse(await executeTool("traktime_timer_current", {}, {}, { callerAuthToken: TOKEN }));
      assert("timer_current ok", r.ok === true, JSON.stringify(r));
      assert("timer_current GET /timer/current", calls[0]?.method === "GET" && calls[0]?.path === "/api/traktime/timer/current", JSON.stringify(calls[0]));
      assert("timer_current forwards Bearer", calls[0]?.auth === `Bearer ${TOKEN}`, calls[0]?.auth);
      assert("timer_current computes elapsed", r.running === true && r.elapsed_seconds >= 59, JSON.stringify(r));
    }

    // ── user_jwt in input also works (MCP path) ─────────────────────────────
    {
      calls.length = 0;
      const r = JSON.parse(await executeTool("traktime_timer_current", { user_jwt: "mcp-jwt" }, {}, {}));
      assert("input.user_jwt forwarded as Bearer", calls[0]?.auth === "Bearer mcp-jwt", calls[0]?.auth);
      assert("input.user_jwt → ok", r.ok === true);
    }

    // ── Write: timer_start requires confirmation ────────────────────────────
    {
      calls.length = 0;
      const blocked = JSON.parse(await executeTool("traktime_timer_start", { project_id: "p1" }, {}, { callerAuthToken: TOKEN }));
      assert("timer_start without confirm → blocked", blocked.ok === false && /confirm/i.test(blocked.error), JSON.stringify(blocked));
      assert("timer_start blocked → no HTTP call", calls.length === 0, `calls=${calls.length}`);

      const ok = JSON.parse(await executeTool("traktime_timer_start", { project_id: "p1", user_confirmed: true }, {}, { callerAuthToken: TOKEN }));
      assert("timer_start confirmed → POST /timer/start", calls[0]?.method === "POST" && calls[0]?.path === "/api/traktime/timer/start", JSON.stringify(calls[0]));
      assert("timer_start forwards project_id + source", calls[0]?.body?.project_id === "p1" && calls[0]?.body?.source === "ae_agent", JSON.stringify(calls[0]?.body));
      assert("timer_start ok", ok.ok === true, JSON.stringify(ok));
    }

    // ── Write: timer_stop requires confirmation ─────────────────────────────
    {
      calls.length = 0;
      const blocked = JSON.parse(await executeTool("traktime_timer_stop", {}, {}, { callerAuthToken: TOKEN }));
      assert("timer_stop without confirm → blocked", blocked.ok === false, JSON.stringify(blocked));
      const ok = JSON.parse(await executeTool("traktime_timer_stop", { user_confirmed: true }, {}, { callerAuthToken: TOKEN }));
      assert("timer_stop confirmed → POST /timer/stop", calls.at(-1)?.path === "/api/traktime/timer/stop", JSON.stringify(calls.at(-1)));
      assert("timer_stop returns duration", ok.duration_seconds === 60, JSON.stringify(ok));
    }

    // ── Write: create_entry requires confirmation + validates ───────────────
    {
      calls.length = 0;
      const ok = JSON.parse(await executeTool("traktime_create_entry", { project_id: "p1", started_at: "2026-06-11T09:00:00-03:00", stopped_at: "2026-06-11T10:00:00-03:00", user_confirmed: true }, {}, { callerAuthToken: TOKEN }));
      assert("create_entry confirmed → POST /entries", calls[0]?.method === "POST" && calls[0]?.path === "/api/traktime/entries", JSON.stringify(calls[0]));
      assert("create_entry ok", ok.ok === true, JSON.stringify(ok));
    }

    // ── Reads: list_entries / day / month / billable map correctly ──────────
    {
      calls.length = 0;
      await executeTool("traktime_list_entries", { project_id: "p1", limit: 10 }, {}, { callerAuthToken: TOKEN });
      assert("list_entries GET /entries + query", calls[0]?.path === "/api/traktime/entries" && calls[0]?.query?.project_id === "p1" && calls[0]?.query?.limit === "10", JSON.stringify(calls[0]?.query));

      const day = JSON.parse(await executeTool("traktime_day_report", { date: "2026-06-11" }, {}, { callerAuthToken: TOKEN }));
      assert("day_report GET /day-report + date", calls.at(-1)?.path === "/api/traktime/day-report" && calls.at(-1)?.query?.date === "2026-06-11", JSON.stringify(calls.at(-1)?.query));
      assert("day_report returns day", day.ok === true && day.day?.effective_seconds === 100, JSON.stringify(day));

      const month = JSON.parse(await executeTool("traktime_month_report", { month: "2026-06" }, {}, { callerAuthToken: TOKEN }));
      assert("month_report GET /month-report + authenticated pdf path", calls.at(-1)?.path === "/api/traktime/month-report" && month.pdf_url === null && month.pdf_download_url === "/api/traktime/month-report.pdf?month=2026-06", JSON.stringify(month));

      await executeTool("traktime_billable_report", { client_id: "c1" }, {}, { callerAuthToken: TOKEN });
      assert("billable GET /reports/billable", calls.at(-1)?.path === "/api/traktime/reports/billable" && calls.at(-1)?.query?.client_id === "c1", JSON.stringify(calls.at(-1)?.query));
    }

    // ── suggest_entry: read-only context gather (no write) ──────────────────
    {
      calls.length = 0;
      const r = JSON.parse(await executeTool("traktime_suggest_entry", { lookback_hours: 12 }, {}, { callerAuthToken: TOKEN }));
      assert("suggest_entry ok, no write call", r.ok === true && calls.every((c) => c.method === "GET"), JSON.stringify(calls.map((c) => c.method)));
      assert("suggest_entry returns running_timer + recent_entries", "running_timer" in r && Array.isArray(r.recent_entries), JSON.stringify(Object.keys(r)));
    }
  } finally {
    config.port = origPort;
    await new Promise((r) => server.close(r));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
