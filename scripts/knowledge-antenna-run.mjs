#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  appendJsonl,
  asDateOnly,
  clamp01,
  defaultImpactMap,
  defaultReferencesCatalog,
  defaultRegistry,
  ensureKnowledgePaths,
  fetchJson,
  fetchText,
  hashId,
  loadReferencesCatalog,
  loadRegistry,
  nowIso,
  parseRssItems,
  paths,
  stripHtml,
  writeJson,
} from "./knowledge-antenna-lib.mjs";
import { runRanking } from "./knowledge-antenna-rank.mjs";
import { runImpactMapping } from "./knowledge-antenna-impact.mjs";

function parseArg(name, fallback) {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.split("=")[1];
}

const DEFAULT_MAX_PER_SOURCE = 8;
const DEFAULT_MIN_EVENT_SCORE = 0.45;

function projectFitScore(event) {
  const text = `${event.title || ""} ${event.summary || ""}`.toLowerCase();
  const buckets = [
    ["openai", "anthropic", "model", "llm", "agent", "api"],
    ["vercel", "cloud run", "deploy", "build", "runtime"],
    ["react", "vite", "frontend", "component", "ux"],
    ["supabase", "postgres", "database", "migration"],
    ["mcp", "automation", "workflow", "orchestrator"],
  ];
  const bucketHits = buckets.reduce((hits, bucket) => {
    return hits + (bucket.some((keyword) => text.includes(keyword)) ? 1 : 0);
  }, 0);
  return clamp01(bucketHits / buckets.length);
}

function freshnessScore(publishedAt) {
  const ts = new Date(publishedAt || 0).getTime();
  if (!Number.isFinite(ts)) return 0.45;
  const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
  if (ageHours <= 24) return 1;
  if (ageHours <= 72) return 0.8;
  if (ageHours <= 168) return 0.6;
  if (ageHours <= 336) return 0.4;
  return 0.25;
}

function scoreEvent(source, event) {
  const authority = Number(source.authorityScore || 0.6);
  const fit = projectFitScore(event);
  const fresh = freshnessScore(event.publishedAt);
  return Number(clamp01((authority * 0.35) + (fit * 0.4) + (fresh * 0.25)).toFixed(4));
}

function normalizeEvent(source, rawEvent) {
  const title = String(rawEvent.title || "").trim();
  const url = String(rawEvent.url || rawEvent.link || "").trim();
  const summary = stripHtml(rawEvent.summary || rawEvent.description || "");
  const publishedAt = rawEvent.publishedAt || rawEvent.pubDate || nowIso();
  const id = `evt_${hashId(source.id, url || title, publishedAt)}`;
  return {
    id,
    sourceId: source.id,
    sourceName: source.name,
    title,
    url,
    summary,
    publishedAt,
    capturedAt: nowIso(),
    tags: source.tags || [],
  };
}

async function fetchFromRss(source, maxPerSource) {
  const xml = await fetchText(source.url);
  const items = parseRssItems(xml);
  return items.slice(0, maxPerSource).map((item) => ({
    title: item.title,
    url: item.link,
    summary: item.description,
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : nowIso(),
  }));
}

async function fetchFromGithubReleases(source, maxPerSource) {
  const releases = await fetchJson(source.apiUrl || source.url);
  return releases.slice(0, maxPerSource).map((release) => ({
    title: release.name || release.tag_name || "Release",
    url: release.html_url,
    summary: release.body || "",
    publishedAt: release.published_at || release.created_at || nowIso(),
  }));
}

async function fetchSourceEvents(source, maxPerSource) {
  if (source.type === "rss") return fetchFromRss(source, maxPerSource);
  if (source.type === "github_releases") return fetchFromGithubReleases(source, maxPerSource);
  return [];
}

function reportFilePath() {
  return path.join(paths.reportsDir, `KNOWLEDGE-REPORT-${asDateOnly()}.md`);
}

function sourceIdFromHost(hostname) {
  return `candidate_${String(hostname || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function buildReportMarkdown({ summary, rankedTop, impactSummary, acceptedEvents, noActionEvents }) {
  const generatedAt = nowIso();
  const topLines = rankedTop.length
    ? rankedTop.map((source, idx) => `${idx + 1}. ${source.name} (${source.rankScore}) [${source.status}]`).join("\n")
    : "- No ranked sources yet.";

  const acceptedBlock = acceptedEvents.length
    ? acceptedEvents
        .slice(0, 20)
        .map((event) => `- [${event.title}](${event.url}) — score ${event.eventScore}, source ${event.sourceName}`)
        .join("\n")
    : "- No accepted events in this run.";

  const noActionBlock = noActionEvents.length
    ? noActionEvents.slice(0, 10).map((event) => `- ${event.title} (${event.sourceName})`).join("\n")
    : "- None.";

  return `# Knowledge Antenna Report — ${asDateOnly()}

Generated at: ${generatedAt}

## Executive Summary

- Sources scanned: ${summary.sourcesScanned}
- Raw events fetched: ${summary.rawEvents}
- New references saved: ${summary.newReferences}
- Accepted events: ${summary.acceptedEvents}
- No-action events: ${summary.noActionEvents}
- New source candidates discovered: ${summary.newSourceCandidates}

## Source Ranking (Top)

${topLines}

## Tactical Recommendations (This Week)

- Validate high-priority impact mappings in \`docs/team/knowledge/impact-map.json\`.
- Route deployment-related updates into \`scripts/deploy-vercel.sh\` and \`scripts/deploy-cloud-run.sh\` checks.
- Review LLM provider updates for action/API compatibility in \`server/gptActions.js\`.
- Sync major findings into \`docs/team/PROJECT-STATE.md\` only when they become concrete implementation tasks.

## Accepted Events

${acceptedBlock}

## Impact Mapping Summary

\`\`\`json
${JSON.stringify(impactSummary, null, 2)}
\`\`\`

## No-Action Items (Noise Control)

${noActionBlock}
`;
}

async function ensureSchemaFiles() {
  await ensureKnowledgePaths();
  const registry = await loadRegistry();
  const refs = await loadReferencesCatalog();
  const impact = await (async () => {
    try {
      const content = await fs.readFile(paths.impactMap, "utf8");
      return JSON.parse(content);
    } catch {
      return defaultImpactMap();
    }
  })();
  await writeJson(paths.sourcesRegistry, registry.schemaVersion ? registry : defaultRegistry());
  await writeJson(paths.referencesCatalog, refs.schemaVersion ? refs : defaultReferencesCatalog());
  await writeJson(paths.impactMap, impact.schemaVersion ? impact : defaultImpactMap());
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const maxPerSource = Number(parseArg("max-per-source", String(DEFAULT_MAX_PER_SOURCE)));
  const minEventScore = Number(parseArg("min-score", String(DEFAULT_MIN_EVENT_SCORE)));

  await ensureSchemaFiles();
  const registry = await loadRegistry();
  const refsCatalog = await loadReferencesCatalog();
  const existingRefIds = new Set((refsCatalog.references || []).map((ref) => ref.id));
  const existingRefUrls = new Set((refsCatalog.references || []).map((ref) => ref.url));

  const activeSources = (registry.sources || []).filter((source) => source.status === "active");
  const existingSourceIds = new Set((registry.sources || []).map((source) => source.id));
  const existingCandidateIds = new Set((registry.sourceCandidates || []).map((source) => source.id));
  const newEventsForLog = [];
  const newReferences = [];
  const acceptedEvents = [];
  const noActionEvents = [];

  let rawEventsCount = 0;
  for (const source of activeSources) {
    source.lastCheckedAt = nowIso();
    source.updatedAt = nowIso();
    try {
      const fetched = await fetchSourceEvents(source, Number.isFinite(maxPerSource) ? maxPerSource : DEFAULT_MAX_PER_SOURCE);
      rawEventsCount += fetched.length;
      for (const rawEvent of fetched) {
        const event = normalizeEvent(source, rawEvent);
        event.eventScore = scoreEvent(source, event);
        event.decision = event.eventScore >= minEventScore ? "accepted" : "no-action";

        const referenceId = `ref_${hashId(event.url || event.title, event.sourceId)}`;
        if (existingRefIds.has(referenceId) || existingRefUrls.has(event.url)) {
          continue;
        }

        existingRefIds.add(referenceId);
        existingRefUrls.add(event.url);

        const reference = {
          id: referenceId,
          sourceId: event.sourceId,
          title: event.title,
          url: event.url,
          summary: event.summary,
          publishedAt: event.publishedAt,
          firstSeenAt: event.capturedAt,
          lastSeenAt: event.capturedAt,
          tags: event.tags || [],
          status: "active",
          rankHint: source.trustTier || "tier-2",
          eventIds: [event.id],
        };
        newReferences.push(reference);
        newEventsForLog.push(event);

        if (event.decision === "accepted") {
          acceptedEvents.push(event);
        } else {
          noActionEvents.push(event);
        }
      }
    } catch (error) {
      newEventsForLog.push({
        id: `evt_${hashId(source.id, nowIso(), "fetch-error")}`,
        sourceId: source.id,
        sourceName: source.name,
        title: `Fetch error for ${source.name}`,
        url: source.url,
        summary: error instanceof Error ? error.message : String(error),
        publishedAt: nowIso(),
        capturedAt: nowIso(),
        eventScore: 0,
        decision: "no-action",
        tags: ["fetch-error"],
      });
    }
  }

  for (const event of acceptedEvents) {
    try {
      const parsedUrl = new URL(event.url);
      const host = parsedUrl.hostname.replace(/^www\./, "");
      const candidateId = sourceIdFromHost(host);
      if (existingSourceIds.has(candidateId) || existingCandidateIds.has(candidateId)) {
        continue;
      }
      const candidate = {
        id: candidateId,
        name: host,
        type: "candidate",
        category: "discovered",
        status: "candidate",
        url: `${parsedUrl.protocol}//${host}`,
        authorityScore: Number(Math.max(0.45, Math.min(0.8, event.eventScore || 0.5)).toFixed(2)),
        projectFitWeight: Number(Math.max(0.45, Math.min(0.85, projectFitScore(event))).toFixed(2)),
        tags: ["auto-discovered", "needs-review"],
        discoveredFromEventId: event.id,
        discoveredAt: nowIso(),
      };
      registry.sourceCandidates = [...(registry.sourceCandidates || []), candidate];
      existingCandidateIds.add(candidateId);
    } catch {
      // Ignore malformed URLs.
    }
  }

  if (!dryRun) {
    refsCatalog.references = [...(refsCatalog.references || []), ...newReferences];
    refsCatalog.updatedAt = nowIso();
    await writeJson(paths.referencesCatalog, refsCatalog);
    await appendJsonl(paths.eventsLog, newEventsForLog);
    registry.updatedAt = nowIso();
    await writeJson(paths.sourcesRegistry, registry);
  }

  const rankResult = await runRanking({ silent: true });
  const impactResult = await runImpactMapping({ days: 14, silent: true });

  const summary = {
    runDate: asDateOnly(),
    dryRun,
    sourcesScanned: activeSources.length,
    rawEvents: rawEventsCount,
    newReferences: newReferences.length,
    acceptedEvents: acceptedEvents.length,
    noActionEvents: noActionEvents.length,
    newSourceCandidates: (registry.sourceCandidates || []).filter((c) => c.discoveredAt && c.discoveredAt.startsWith(asDateOnly())).length,
    minEventScore,
  };

  const report = buildReportMarkdown({
    summary,
    rankedTop: rankResult.top || [],
    impactSummary: impactResult,
    acceptedEvents,
    noActionEvents,
  });

  if (!dryRun) {
    await fs.writeFile(reportFilePath(), report, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        summary,
        reportFile: dryRun ? "(dry-run)" : path.relative(paths.repoRoot, reportFilePath()),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
