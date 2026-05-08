/**
 * kbAnalytics.js — Computation of KB coverage, miss analysis, and trends.
 *
 * Core functions:
 *   readSessionEventsInWindow(daysBack) — aggregate session events from JSONL files
 *   computeRetrievalTimeline(events, entries) — count retrievals over time by channel
 *   computeMissAnalysis(events) — which questions matched zero entries
 *   computeCoverageByChannel(entries) — per-channel health snapshot
 *   computeTopAndNever(entries, limit) — top retrieved + never retrieved
 *   computeTrends(events, entries, daysBack) — time-series stats
 *   buildKbAnalytics({daysBack, include}) — orchestrate all computations
 *
 * Caching: In-memory 5-minute cache keyed by (daysBack, include, kb.updatedAt)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrainingKB, getTrainingStats, getHealthEntries } from "./trainingKB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const sessionsDir = path.join(repoRoot, "data/training-sessions");

let _analyticsCache = null; // { key, result, computedAt }
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

function _cacheKey(daysBack, include, kbUpdatedAt) {
  return `${daysBack}|${String(include || []).split(",").sort().join(",")}|${kbUpdatedAt}`;
}

function _getCachedResult(key) {
  if (_analyticsCache && _analyticsCache.key === key && Date.now() - _analyticsCache.computedAt < CACHE_TTL_MS) {
    return _analyticsCache.result;
  }
  return null;
}

function _setCachedResult(key, result) {
  _analyticsCache = { key, result, computedAt: Date.now() };
}

export function clearAnalyticsCache() {
  _analyticsCache = null;
}

/**
 * Reads all JSONL files in data/training-sessions/ and returns array of events.
 * Each event: { timestamp, channel, question, matched, matchCount }
 */
export function readSessionEventsInWindow(daysBack = 30) {
  const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const events = [];

  if (!fs.existsSync(sessionsDir)) {
    return events;
  }

  const files = fs.readdirSync(sessionsDir).filter((f) => f.startsWith("SESSION-") && f.endsWith(".jsonl"));

  for (const file of files) {
    const filePath = path.join(sessionsDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.timestamp >= cutoff) {
          events.push(ev);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return events;
}

/**
 * Aggregate retrieval counts by channel over time.
 * Returns { [channel]: { total, byDay: { YYYY-MM-DD: count } } }
 */
export function computeRetrievalTimeline(events, _entries) {
  const timeline = {};

  for (const ev of events) {
    if (ev.type !== "kb_match" || ev.matchCount === undefined) continue;

    const channel = ev.channel || "chat";
    const day = ev.timestamp.split("T")[0];

    if (!timeline[channel]) {
      timeline[channel] = { total: 0, byDay: {} };
    }
    timeline[channel].total += 1;
    timeline[channel].byDay[day] = (timeline[channel].byDay[day] || 0) + 1;
  }

  return timeline;
}

/**
 * Compute miss analysis: questions that matched zero KB entries.
 * Returns { totalMisses, missesByChannel: { [channel]: count }, recentMisses: [{timestamp, channel, question}] }
 */
export function computeMissAnalysis(events) {
  const misses = events.filter((ev) => ev.type === "kb_miss");
  const totalMisses = misses.length;
  const missesByChannel = {};
  const recentMisses = [];

  for (const miss of misses) {
    const channel = miss.channel || "chat";
    missesByChannel[channel] = (missesByChannel[channel] || 0) + 1;
    if (miss.question) {
      recentMisses.push({
        timestamp: miss.timestamp,
        channel,
        question: miss.question.slice(0, 200), // truncate for storage
      });
    }
  }

  // Sort recent by timestamp descending, limit to 20
  recentMisses.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  recentMisses.splice(20);

  return { totalMisses, missesByChannel, recentMisses };
}

/**
 * Compute per-channel coverage.
 * Returns { [channel]: { total: count, hasML: count, hasWA: count, health: {...} } }
 */
export function computeCoverageByChannel(entries) {
  const coverage = {
    chat: { total: 0, hasOverride: 0, health: {} },
    ml: { total: 0, hasOverride: 0, health: {} },
    wa: { total: 0, hasOverride: 0, health: {} },
  };

  for (const entry of entries) {
    if (entry.archived || entry.status === "pending") continue;

    // chat: all entries
    coverage.chat.total += 1;
    coverage.chat.hasOverride += entry.goodAnswer ? 1 : 0;

    // ml: goodAnswerML override presence
    if ((entry.goodAnswer || "").length > 350) {
      coverage.ml.total += 1;
      coverage.ml.hasOverride += entry.goodAnswerML ? 1 : 0;
    }

    // wa: goodAnswerWA override presence
    if ((entry.goodAnswer || "").length > 800) {
      coverage.wa.total += 1;
      coverage.wa.hasOverride += entry.goodAnswerWA ? 1 : 0;
    }
  }

  // Compute health per channel
  const health = getHealthEntries();
  for (const channel of ["chat", "ml", "wa"]) {
    const stale = health.stale.length || 0;
    const zeroRet = health.zeroRetrieval.length || 0;
    const mlG = health.mlGap.length || 0;
    const waG = health.waGap.length || 0;
    coverage[channel].health = {
      stale,
      zeroRetrieval: zeroRet,
      mlGap: mlG,
      waGap: waG,
    };
  }

  return coverage;
}

/**
 * Identify top-retrieved and never-retrieved entries.
 * Returns { top: [{question, retrievalCount}], never: [{question}] }
 */
export function computeTopAndNever(entries, limit = 5) {
  const active = entries.filter((e) => !e.archived && (e.status == null || e.status === "active"));

  const sorted = active
    .filter((e) => (e.retrievalCount ?? 0) > 0)
    .sort((a, b) => (b.retrievalCount ?? 0) - (a.retrievalCount ?? 0))
    .slice(0, limit)
    .map((e) => ({
      question: e.question.slice(0, 100),
      retrievalCount: e.retrievalCount ?? 0,
    }));

  const never = active
    .filter((e) => (e.retrievalCount ?? 0) === 0)
    .slice(0, limit)
    .map((e) => ({
      question: e.question.slice(0, 100),
    }));

  return { top: sorted, never };
}

/**
 * Compute trends: daily stats over the window.
 * Returns { byDay: { YYYY-MM-DD: { events, retrievals, misses } } }
 */
export function computeTrends(events, _entries, daysBack = 30) {
  const byDay = {};
  const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString();

  for (const ev of events) {
    if (ev.timestamp < cutoff) continue;
    const day = ev.timestamp.split("T")[0];
    if (!byDay[day]) {
      byDay[day] = { events: 0, retrievals: 0, misses: 0 };
    }
    byDay[day].events += 1;
    if (ev.type === "kb_match") byDay[day].retrievals += 1;
    if (ev.type === "kb_miss") byDay[day].misses += 1;
  }

  return { byDay };
}

/**
 * Main orchestration: compute all KB analytics with caching.
 * @param {number} daysBack - window size in days (default 30, max 365)
 * @param {string[]} include - which sections to compute ('kb', 'knowledge_events', etc.)
 * @returns {object} { kb: {...}, knowledgeEnv: {...}, computedAt }
 */
export async function buildKbAnalytics({ daysBack = 30, include = ["kb"] } = {}) {
  const kb = loadTrainingKB();
  const key = _cacheKey(daysBack, include, kb.updatedAt);

  // Return cached result if valid
  const cached = _getCachedResult(key);
  if (cached) return cached;

  // Normalize window
  const window = Math.max(1, Math.min(daysBack || 30, 365));

  // Core KB section (always computed)
  const kbStats = getTrainingStats();
  const healthEntries = getHealthEntries();
  const result = {
    kb: {
      version: kb.version || "1.1.0",
      summary: {
        total: kbStats.total,
        pending: kbStats.pending,
        score: kbStats.health.score,
      },
      health: kbStats.health,
      byCategory: kbStats.byCategory,
      bySource: kbStats.bySource,
      coverageByChannel: computeCoverageByChannel(kb.entries),
      topAndNever: computeTopAndNever(kb.entries),
      healthEntries: {
        stale: healthEntries.stale.map((e) => ({ question: e.question.slice(0, 100) })),
        zeroRetrieval: healthEntries.zeroRetrieval.map((e) => ({ question: e.question.slice(0, 100) })),
        mlGap: healthEntries.mlGap.map((e) => ({ question: e.question.slice(0, 100) })),
        waGap: healthEntries.waGap.map((e) => ({ question: e.question.slice(0, 100) })),
      },
    },
    computedAt: new Date().toISOString(),
  };

  // Optional: knowledge_events section (session-based analytics)
  if (include && (include.includes("knowledge_events") || include.includes("all"))) {
    const events = readSessionEventsInWindow(window);
    const retrieval = computeRetrievalTimeline(events, kb.entries);
    const missAnalysis = computeMissAnalysis(events);
    const trends = computeTrends(events, kb.entries, window);

    result.knowledgeEnv = {
      window: { daysBack: window },
      retrieval,
      missAnalysis,
      trends,
      parsedInWindow: events.length,
    };

    // Lazy-load buildAiEnvironmentTrends if available
    try {
      const { buildAiEnvironmentTrends } = await import("./aiEnvironmentTrends.js");
      const aiTrends = buildAiEnvironmentTrends({
        filePath: path.join(repoRoot, "data/ai-environment-log.jsonl"),
        daysWindow: window,
      });
      if (aiTrends) {
        result.knowledgeEnv.aiEnvironment = aiTrends;
      }
    } catch {
      // aiEnvironmentTrends not available or disabled
    }
  }

  // Cache the result
  _setCachedResult(key, result);
  return result;
}
