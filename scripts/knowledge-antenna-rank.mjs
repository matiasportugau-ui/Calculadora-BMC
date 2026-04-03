#!/usr/bin/env node
import {
  clamp01,
  loadRegistry,
  nowIso,
  pickTier,
  readJsonl,
  writeJson,
  paths,
} from "./knowledge-antenna-lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function freshnessScore(lastCheckedAt) {
  if (!lastCheckedAt) return 0.4;
  const then = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(then)) return 0.4;
  const ageHours = Math.max(0, (Date.now() - then) / (1000 * 60 * 60));
  if (ageHours <= 12) return 1;
  if (ageHours <= 24) return 0.9;
  if (ageHours <= 48) return 0.75;
  if (ageHours <= 168) return 0.55;
  return 0.35;
}

function signalScore(stats = {}) {
  const seen = Number(stats.eventsSeen || 0);
  const accepted = Number(stats.acceptedEvents || 0);
  const avgEventScore = Number(stats.avgEventScore || 0);
  if (!seen) return 0.5;
  const acceptance = seen > 0 ? accepted / seen : 0;
  return clamp01((acceptance * 0.6) + (avgEventScore * 0.4));
}

function computeScore(source, policy) {
  const authority = clamp01(Number(source.authorityScore || 0));
  const freshness = freshnessScore(source.lastCheckedAt);
  const signal = signalScore(source.stats);
  const projectFit = clamp01(Number(source.projectFitWeight || 0));

  return clamp01(
    (authority * policy.authorityWeight) +
      (freshness * policy.freshnessWeight) +
      (signal * policy.signalWeight) +
      (projectFit * policy.projectFitWeight)
  );
}

export async function runRanking({ silent = false } = {}) {
  const registry = await loadRegistry();
  const policy = registry.rankingPolicy || {
    authorityWeight: 0.35,
    freshnessWeight: 0.2,
    signalWeight: 0.25,
    projectFitWeight: 0.2,
    promoteThreshold: 0.75,
    demoteThreshold: 0.35,
  };

  const allEvents = await readJsonl(paths.eventsLog, { limit: 3000 });
  const eventsBySource = new Map();
  for (const event of allEvents) {
    const sourceId = event.sourceId;
    if (!sourceId) continue;
    if (!eventsBySource.has(sourceId)) eventsBySource.set(sourceId, []);
    eventsBySource.get(sourceId).push(event);
  }

  for (const source of registry.sources || []) {
    const sourceEvents = eventsBySource.get(source.id) || [];
    const eventsSeen = sourceEvents.length;
    const acceptedEvents = sourceEvents.filter((event) => Number(event.eventScore || 0) >= 0.5).length;
    const avgEventScore = eventsSeen
      ? sourceEvents.reduce((sum, event) => sum + Number(event.eventScore || 0), 0) / eventsSeen
      : 0;

    source.stats = {
      eventsSeen,
      acceptedEvents,
      rejectedEvents: Math.max(0, eventsSeen - acceptedEvents),
      avgEventScore: Number(avgEventScore.toFixed(4)),
    };

    const rankScore = computeScore(source, policy);
    source.rankScore = Number(rankScore.toFixed(4));
    source.trustTier = pickTier(rankScore);
    source.updatedAt = nowIso();

    if (source.status === "candidate" && rankScore >= policy.promoteThreshold) {
      source.status = "active";
      source.promotionNote = `Auto-promoted by rank engine (${source.rankScore}).`;
    }

    if (source.status === "active" && rankScore <= policy.demoteThreshold) {
      source.status = "watchlist";
      source.promotionNote = `Flagged by rank engine (${source.rankScore}) for manual review.`;
    }
  }

  registry.updatedAt = nowIso();
  await writeJson(paths.sourcesRegistry, registry);

  const top = [...(registry.sources || [])]
    .sort((a, b) => Number(b.rankScore || 0) - Number(a.rankScore || 0))
    .slice(0, 8)
    .map((source) => ({
      id: source.id,
      name: source.name,
      status: source.status,
      rankScore: source.rankScore,
      trustTier: source.trustTier,
    }));

  if (!silent) {
    console.log(JSON.stringify({ ok: true, rankedAt: nowIso(), top }, null, 2));
  }
  return { ok: true, rankedAt: nowIso(), top };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runRanking().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
