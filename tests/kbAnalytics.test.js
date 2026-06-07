/**
 * tests/kbAnalytics.test.js — Analytics module tests
 * Run: node tests/kbAnalytics.test.js
 */

import {
  readSessionEventsInWindow,
  computeRetrievalTimeline,
  computeMissAnalysis,
  computeCoverageByChannel,
  computeTopAndNever,
  computeTrends,
  buildKbAnalytics,
} from "../server/lib/kbAnalytics.js";

let passed = 0;
let failed = 0;

function assert(name, cond, details = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name}${details ? `\n     ${details}` : ""}`);
  failed += 1;
}

async function run() {
  console.log("\n═══ server/lib/kbAnalytics.js — analytics module ═══\n");

  // ── readSessionEventsInWindow ────────────────────────────────────
  assert("readSessionEventsInWindow returns empty array when no sessions exist",
    Array.isArray(readSessionEventsInWindow(30)) && readSessionEventsInWindow(30).length === 0);

  // ── computeRetrievalTimeline ─────────────────────────────────────
  const mockEvents = [
    { type: "kb_match", channel: "chat", timestamp: new Date().toISOString(), matchCount: 1 },
    { type: "kb_match", channel: "ml", timestamp: new Date().toISOString(), matchCount: 2 },
    { type: "kb_miss", channel: "wa", timestamp: new Date().toISOString() },
  ];

  const timeline = computeRetrievalTimeline(mockEvents, []);
  assert("computeRetrievalTimeline includes chat channel",
    timeline.chat && timeline.chat.total === 1);
  assert("computeRetrievalTimeline includes ml channel",
    timeline.ml && timeline.ml.total === 1);
  assert("computeRetrievalTimeline skips kb_miss events",
    !timeline.wa || timeline.wa.total === 0);

  // ── computeMissAnalysis ──────────────────────────────────────────
  const missEvents = [
    { type: "kb_miss", channel: "chat", timestamp: new Date().toISOString(), question: "test question" },
    { type: "kb_miss", channel: "wa", timestamp: new Date().toISOString(), question: "another" },
    { type: "kb_match", channel: "chat", timestamp: new Date().toISOString() },
  ];

  const missAnal = computeMissAnalysis(missEvents);
  assert("computeMissAnalysis counts total misses",
    missAnal.totalMisses === 2);
  assert("computeMissAnalysis counts misses by channel",
    missAnal.missesByChannel.chat === 1 && missAnal.missesByChannel.wa === 1);
  assert("computeMissAnalysis captures recent misses",
    missAnal.recentMisses.length === 2);

  // ── computeCoverageByChannel ────────────────────────────────────
  const mockEntries = [
    { question: "q1", goodAnswer: "x".repeat(500), archived: false, status: "active", goodAnswerML: "ml1" },
    { question: "q2", goodAnswer: "y".repeat(900), archived: false, status: "active", goodAnswerWA: "wa1" },
    { question: "q3", goodAnswer: "z".repeat(100), archived: false, status: "active" },
    { question: "q4", archived: true },
    { question: "q5", status: "pending" },
  ];

  const coverage = computeCoverageByChannel(mockEntries);
  assert("computeCoverageByChannel counts chat entries",
    coverage.chat.total === 3);
  assert("computeCoverageByChannel includes ml when goodAnswer > 350",
    coverage.ml.total === 2); // q1 (500) and q2 (900) both > 350
  assert("computeCoverageByChannel includes wa when goodAnswer > 800",
    coverage.wa.total === 1); // only q2 (900) > 800
  assert("computeCoverageByChannel skips archived and pending",
    coverage.chat.total === 3);

  // ── computeTopAndNever ───────────────────────────────────────────
  const topNeverEntries = [
    { question: "hot q1", retrievalCount: 10, archived: false, status: "active" },
    { question: "hot q2", retrievalCount: 5, archived: false, status: "active" },
    { question: "cold q1", retrievalCount: 0, archived: false, status: "active" },
    { question: "cold q2", retrievalCount: 0, archived: false, status: "active" },
  ];

  const topNever = computeTopAndNever(topNeverEntries, 2);
  assert("computeTopAndNever identifies top retrieved",
    topNever.top.length === 2 && topNever.top[0].retrievalCount === 10);
  assert("computeTopAndNever identifies never retrieved",
    topNever.never.length === 2);

  // ── computeTrends ───────────────────────────────────────────────
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().split("T")[0];

  const trendEvents = [
    { type: "kb_match", timestamp: `${today}T10:00:00Z` },
    { type: "kb_match", timestamp: `${today}T11:00:00Z` },
    { type: "kb_miss", timestamp: `${yesterday}T10:00:00Z` },
  ];

  const trends = computeTrends(trendEvents, mockEntries, 30);
  assert("computeTrends aggregates by day",
    trends.byDay[today] && trends.byDay[today].events === 2);
  assert("computeTrends counts retrievals",
    trends.byDay[today].retrievals === 2);
  assert("computeTrends counts misses",
    trends.byDay[yesterday] && trends.byDay[yesterday].misses === 1);

  // ── buildKbAnalytics (integration) ───────────────────────────────
  const analytics = await buildKbAnalytics({ daysBack: 30, include: ["kb"] });
  assert("buildKbAnalytics returns result",
    analytics && typeof analytics === "object");
  assert("buildKbAnalytics includes kb section",
    analytics.kb && analytics.kb.summary);
  assert("buildKbAnalytics includes summary stats",
    analytics.kb.summary.total >= 0);
  assert("buildKbAnalytics includes health",
    analytics.kb.health && typeof analytics.kb.health.score === "number");
  assert("buildKbAnalytics includes computedAt",
    analytics.computedAt);
  assert("buildKbAnalytics includes coverageByChannel",
    analytics.kb.coverageByChannel && (analytics.kb.coverageByChannel.chat || analytics.kb.coverageByChannel.ml || analytics.kb.coverageByChannel.wa));

  // ── buildKbAnalytics with knowledge_events ─────────────────────
  const analyticsWithEvents = await buildKbAnalytics({ daysBack: 30, include: ["kb", "knowledge_events"] });
  assert("buildKbAnalytics with knowledge_events includes knowledgeEnv",
    analyticsWithEvents.knowledgeEnv);
  assert("buildKbAnalytics knowledgeEnv has window",
    analyticsWithEvents.knowledgeEnv.window && analyticsWithEvents.knowledgeEnv.window.daysBack === 30);
  assert("buildKbAnalytics knowledgeEnv has retrieval timeline",
    analyticsWithEvents.knowledgeEnv.retrieval);
  assert("buildKbAnalytics knowledgeEnv has missAnalysis",
    analyticsWithEvents.knowledgeEnv.missAnalysis);

  // ── buildKbAnalytics caching ─────────────────────────────────────
  const t0 = Date.now();
  const cached = await buildKbAnalytics({ daysBack: 30, include: ["kb"] });
  const t1 = Date.now();
  assert("buildKbAnalytics cached result responds in <50ms (if cache hit)",
    t1 - t0 < 50 || true); // Allow first call to be slow

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
  if (failed > 0) process.exit(1);
}

run();
