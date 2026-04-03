#!/usr/bin/env node
import {
  asDateOnly,
  defaultImpactMap,
  loadImpactMap,
  nowIso,
  paths,
  readJsonl,
  writeJson,
} from "./knowledge-antenna-lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMPACT_RULES = [
  {
    id: "llm-platforms",
    keywords: ["openai", "anthropic", "model", "api", "reasoning", "gpt", "claude"],
    targets: [
      "server/gptActions.js",
      "server/index.js",
      "docs/openapi-email-gpt.yaml",
      "scripts/capabilities-snapshot.mjs",
    ],
    recommendation: "Review prompt/actions contracts and capability manifests.",
  },
  {
    id: "deployment-stack",
    keywords: ["vercel", "cloud run", "deploy", "edge", "runtime", "build"],
    targets: [
      "scripts/deploy-vercel.sh",
      "scripts/deploy-cloud-run.sh",
      "scripts/smoke-prod-api.mjs",
      "vercel.json",
      "Dockerfile.bmc-dashboard",
    ],
    recommendation: "Validate deploy pipeline and production smoke checks.",
  },
  {
    id: "data-and-storage",
    keywords: ["supabase", "postgres", "database", "migration", "storage", "query"],
    targets: [
      "scripts/run-transportista-migrations.mjs",
      "server/routes/transportista.js",
      "server/routes/bmcDashboard.js",
    ],
    recommendation: "Assess schema/runtime compatibility and migration impact.",
  },
  {
    id: "frontend-stack",
    keywords: ["react", "vite", "ux", "performance", "accessibility", "component"],
    targets: [
      "src/components",
      "src/utils",
      "vite.config.js",
      "eslint.config.js",
    ],
    recommendation: "Prioritize UI/runtime changes with highest UX or perf leverage.",
  },
  {
    id: "workflow-automation",
    keywords: ["agent", "automation", "workflow", "mcp", "tooling", "orchestration"],
    targets: [
      "scripts/project-compass.mjs",
      "scripts/channels-automated-pipeline.mjs",
      "docs/team/PROJECT-STATE.md",
      "docs/team/SESSION-WORKSPACE-CRM.md",
    ],
    recommendation: "Map new automation capabilities into team runbooks and scripts.",
  },
];

function scoreRuleMatch(text, rule) {
  const normalized = text.toLowerCase();
  const hitCount = rule.keywords.reduce((count, keyword) => {
    return count + (normalized.includes(keyword) ? 1 : 0);
  }, 0);
  if (hitCount === 0) return 0;
  return Math.min(1, hitCount / Math.max(3, rule.keywords.length / 2));
}

function classifyPriority(score, eventScore) {
  const weighted = (score * 0.7) + (eventScore * 0.3);
  if (weighted >= 0.75) return "high";
  if (weighted >= 0.5) return "medium";
  return "low";
}

export async function runImpactMapping({ days = 14, silent = false } = {}) {
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(now.getDate() - days);
  const thresholdMs = threshold.getTime();

  const allEvents = await readJsonl(paths.eventsLog, { limit: 4000 });
  const recentEvents = allEvents.filter((event) => {
    const ts = new Date(event.capturedAt || event.publishedAt || 0).getTime();
    return Number.isFinite(ts) && ts >= thresholdMs;
  });

  const mappings = [];
  for (const event of recentEvents) {
    const text = `${event.title || ""} ${event.summary || ""}`.toLowerCase();
    for (const rule of IMPACT_RULES) {
      const matchScore = scoreRuleMatch(text, rule);
      if (matchScore <= 0) continue;
      const eventScore = Number(event.eventScore || 0);
      mappings.push({
        id: `impact_${event.id}_${rule.id}`,
        eventId: event.id,
        domain: rule.id,
        priority: classifyPriority(matchScore, eventScore),
        confidence: Number(matchScore.toFixed(4)),
        targets: rule.targets,
        recommendation: rule.recommendation,
        createdAt: nowIso(),
      });
    }
  }

  const previous = await loadImpactMap().catch(() => defaultImpactMap());
  const impactMap = {
    ...previous,
    schemaVersion: "1.0.0",
    updatedAt: nowIso(),
    generatedForDate: asDateOnly(),
    mappings,
  };
  await writeJson(paths.impactMap, impactMap);

  const summary = mappings.reduce((acc, mapping) => {
    acc[mapping.priority] = (acc[mapping.priority] || 0) + 1;
    return acc;
  }, {});

  const payload = {
    ok: true,
    generatedAt: impactMap.updatedAt,
    daysAnalyzed: days,
    mappings: mappings.length,
    summary,
  };
  if (!silent) {
    console.log(JSON.stringify(payload, null, 2));
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const daysArg = Number(process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] || "14");
  runImpactMapping({ days: Number.isFinite(daysArg) ? daysArg : 14 }).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
