// TraKtiMe — jornada / coordinación derivation (offline unit test).
// Pure-function tests for server/lib/traktimeJornada.js — no DB, no network.
//
// Run: node tests/traktime-jornada.test.js

import {
  buildJornadaReport,
  computeDay,
  DEFAULT_PAUSA_THRESHOLD_SECONDS,
} from "../server/lib/traktimeJornada.js";

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

// Helper: build a UY-local (UTC-3) ISO timestamp for a given clock time.
function uy(date, hhmm) {
  return `${date}T${hhmm}:00-03:00`;
}

// Entry with explicit duration (mirrors the generated tk_entries column).
function entry(date, start, end, extra = {}) {
  const startedMs = new Date(uy(date, start)).getTime();
  const stoppedMs = new Date(uy(date, end)).getTime();
  return {
    started_at: uy(date, start),
    stopped_at: uy(date, end),
    duration_seconds: Math.round((stoppedMs - startedMs) / 1000),
    project_id: extra.project_id || "p1",
    project_name: extra.project_name || "Proyecto",
    client_name: extra.client_name || "Cliente",
    color_hex: extra.color_hex || "#0071e3",
    ...extra,
  };
}

console.log("\n═══ TraKtiMe · jornada/gaps (offline) ═══");

// ── Fixture: Ramiro's acceptance sequence ─────────────────────────────────
// 09:00–10:30 A; 10:33–11:15 B; 11:18–12:00 C
// effective 2h54m (10440s), coordinación 6m (360s), jornada 3h00m (10800s)
{
  const entries = [
    entry("2026-06-11", "09:00", "10:30"),
    entry("2026-06-11", "10:33", "11:15"),
    entry("2026-06-11", "11:18", "12:00"),
  ];
  const d = computeDay(entries, { date: "2026-06-11" });
  assert("fixture effective = 10440s", d.effective_seconds === 10440, `got ${d.effective_seconds}`);
  assert("fixture coordinación = 360s", d.coordinacion_seconds === 360, `got ${d.coordinacion_seconds}`);
  assert("fixture pausa = 0s", d.pausa_seconds === 0, `got ${d.pausa_seconds}`);
  assert("fixture jornada = 10800s", d.jornada_seconds === 10800, `got ${d.jornada_seconds}`);
  assert("fixture idle = 360s", d.idle_seconds === 360, `got ${d.idle_seconds}`);
  assert("fixture 2 gaps, both coordinación",
    d.gaps.length === 2 && d.gaps.every((g) => g.kind === "coordinacion"),
    JSON.stringify(d.gaps.map((g) => g.kind)));
  assert("fixture first_in 09:00 / last_out 12:00",
    d.first_in_local === "09:00" && d.last_out_local === "12:00",
    `${d.first_in_local}..${d.last_out_local}`);
}

// ── Single entry: no gaps, jornada == effective ───────────────────────────
{
  const d = computeDay([entry("2026-06-11", "09:00", "10:00")], { date: "2026-06-11" });
  assert("single: no gaps", d.gaps.length === 0);
  assert("single: coordinación 0", d.coordinacion_seconds === 0);
  assert("single: effective == jornada == 3600",
    d.effective_seconds === 3600 && d.jornada_seconds === 3600,
    `${d.effective_seconds}/${d.jornada_seconds}`);
  assert("single: idle 0", d.idle_seconds === 0);
}

// ── Overlapping entries: no negative gap; idle clamped to 0 ────────────────
{
  // A 09:00–10:00, B 09:30–10:30 (overlap). effective 3600+3600=7200,
  // span 09:00→10:30 = 5400. idle = max(0, 5400-7200) = 0. No positive gap.
  const entries = [
    entry("2026-06-11", "09:00", "10:00"),
    entry("2026-06-11", "09:30", "10:30"),
  ];
  const d = computeDay(entries, { date: "2026-06-11" });
  assert("overlap: no gaps", d.gaps.length === 0, JSON.stringify(d.gaps));
  assert("overlap: effective 7200", d.effective_seconds === 7200, `got ${d.effective_seconds}`);
  assert("overlap: jornada 5400", d.jornada_seconds === 5400, `got ${d.jornada_seconds}`);
  assert("overlap: idle clamped to 0", d.idle_seconds === 0, `got ${d.idle_seconds}`);
}

// ── Pausa threshold: gap over 30 min becomes "pausa" ──────────────────────
{
  // 09:00–10:00, then a 45-min gap, then 10:45–11:00.
  const entries = [
    entry("2026-06-11", "09:00", "10:00"),
    entry("2026-06-11", "10:45", "11:00"),
  ];
  const d = computeDay(entries, { date: "2026-06-11" });
  assert("pausa: one gap labeled pausa",
    d.gaps.length === 1 && d.gaps[0].kind === "pausa", JSON.stringify(d.gaps));
  assert("pausa: pausa_seconds 2700", d.pausa_seconds === 2700, `got ${d.pausa_seconds}`);
  assert("pausa: coordinación 0", d.coordinacion_seconds === 0, `got ${d.coordinacion_seconds}`);

  // Exactly 30 min stays coordinación (strict > threshold).
  const exact = computeDay(
    [entry("2026-06-11", "09:00", "10:00"), entry("2026-06-11", "10:30", "11:00")],
    { date: "2026-06-11" },
  );
  assert("threshold: exactly 30 min → coordinación",
    exact.coordinacion_seconds === 1800 && exact.pausa_seconds === 0,
    `${exact.coordinacion_seconds}/${exact.pausa_seconds}`);
  assert("default threshold is 1800s", DEFAULT_PAUSA_THRESHOLD_SECONDS === 1800);

  // Configurable threshold: lower it to 2 min so the 3-min gaps become pausa.
  const lowered = computeDay(
    [entry("2026-06-11", "09:00", "10:00"), entry("2026-06-11", "10:03", "11:00")],
    { date: "2026-06-11", pausaThresholdSeconds: 120 },
  );
  assert("configurable threshold: 3-min gap → pausa when threshold=120",
    lowered.pausa_seconds === 180 && lowered.coordinacion_seconds === 0,
    `${lowered.pausa_seconds}/${lowered.coordinacion_seconds}`);
}

// ── Empty day ─────────────────────────────────────────────────────────────
{
  const d = computeDay([], { date: "2026-06-11" });
  assert("empty: zero everything",
    d.effective_seconds === 0 && d.jornada_seconds === 0 && d.gaps.length === 0 &&
      d.entry_count === 0 && d.first_in === null,
    JSON.stringify(d));
}

// ── Overnight: entry crossing midnight stays on its start day, no spurious gap ─
{
  // 23:00–01:00 (next day). Single entry → no gaps; span == effective == 7200.
  const entries = [
    {
      started_at: uy("2026-06-11", "23:00"),
      stopped_at: uy("2026-06-12", "01:00"),
      duration_seconds: 7200,
      project_id: "p1",
      project_name: "Proyecto",
      client_name: "Cliente",
      color_hex: "#0071e3",
    },
  ];
  const report = buildJornadaReport(entries, {});
  assert("overnight: bucketed on start day 2026-06-11",
    report.days.length === 1 && report.days[0].date === "2026-06-11",
    JSON.stringify(report.days.map((d) => d.date)));
  assert("overnight: no gaps, effective==jornada==7200",
    report.days[0].gaps.length === 0 &&
      report.days[0].effective_seconds === 7200 &&
      report.days[0].jornada_seconds === 7200,
    JSON.stringify(report.days[0]));
}

// ── Cross-day boundary never produces a gap between separate entries ───────
{
  // One entry ending 23:55 on day 1, next starting 00:05 day 2. Different days
  // → two day buckets, zero gaps in each (overnight boundary never gaps).
  const entries = [
    entry("2026-06-11", "23:00", "23:55"),
    entry("2026-06-12", "00:05", "01:00"),
  ];
  const report = buildJornadaReport(entries, {});
  assert("cross-day: two day buckets", report.days.length === 2,
    JSON.stringify(report.days.map((d) => d.date)));
  assert("cross-day: no gaps in either day",
    report.days.every((d) => d.gaps.length === 0),
    JSON.stringify(report.days.map((d) => d.gaps.length)));
}

// ── Multi-day report: totals + per-project rollup ─────────────────────────
{
  const entries = [
    entry("2026-06-11", "09:00", "10:30", { project_id: "pA", project_name: "A" }),
    entry("2026-06-11", "10:33", "11:15", { project_id: "pB", project_name: "B" }),
    entry("2026-06-12", "09:00", "11:00", { project_id: "pA", project_name: "A" }),
  ];
  const report = buildJornadaReport(entries, {});
  assert("multiday: 2 days", report.totals.day_count === 2, `got ${report.totals.day_count}`);
  // effective: day1 5400+2520=7920, day2 7200 → 15120
  assert("multiday: totals.effective 15120", report.totals.effective_seconds === 15120,
    `got ${report.totals.effective_seconds}`);
  const pA = report.projects.find((p) => p.project_id === "pA");
  assert("multiday: rollup pA effective 5400+7200=12600",
    pA && pA.effective_seconds === 12600, JSON.stringify(report.projects));
  assert("multiday: rollup sorted desc (pA first)",
    report.projects[0].project_id === "pA", JSON.stringify(report.projects.map((p) => p.project_id)));
}

// ── Open timer (no stopped_at) is ignored ─────────────────────────────────
{
  const entries = [
    entry("2026-06-11", "09:00", "10:00"),
    { started_at: uy("2026-06-11", "10:00"), stopped_at: null, project_id: "p1" },
  ];
  const report = buildJornadaReport(entries, {});
  assert("open timer ignored: 1 entry counted",
    report.days[0].entry_count === 1, JSON.stringify(report.days[0]));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
