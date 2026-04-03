#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  asDateOnly,
  nowIso,
  paths,
  readJsonOrDefault,
  readJsonl,
  writeJson,
} from "./knowledge-antenna-lib.mjs";
import { fileURLToPath } from "node:url";

function priorityWeight(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

async function pathExists(relativePath) {
  const absolute = path.join(paths.repoRoot, relativePath);
  try {
    await fs.access(absolute);
    return true;
  } catch {
    return false;
  }
}

async function buildTargetCoverage(mappings) {
  const byTarget = new Map();
  for (const mapping of mappings) {
    for (const target of safeArray(mapping.targets)) {
      const row = byTarget.get(target) || {
        target,
        existsInRepo: false,
        hits: 0,
        high: 0,
        medium: 0,
        low: 0,
        score: 0,
        domains: new Set(),
        recommendations: new Set(),
      };
      row.hits += 1;
      row.score += priorityWeight(mapping.priority);
      row[mapping.priority] += 1;
      row.domains.add(mapping.domain || "unknown");
      if (mapping.recommendation) row.recommendations.add(mapping.recommendation);
      byTarget.set(target, row);
    }
  }

  const out = [];
  for (const row of byTarget.values()) {
    row.existsInRepo = await pathExists(row.target);
    out.push({
      target: row.target,
      existsInRepo: row.existsInRepo,
      hits: row.hits,
      high: row.high,
      medium: row.medium,
      low: row.low,
      score: row.score,
      domains: [...row.domains].sort(),
      recommendations: [...row.recommendations],
    });
  }
  out.sort((a, b) => b.score - a.score || b.hits - a.hits || a.target.localeCompare(b.target));
  return out;
}

function buildDomainCoverage(mappings) {
  const byDomain = new Map();
  for (const mapping of mappings) {
    const domain = mapping.domain || "unknown";
    const row = byDomain.get(domain) || { domain, total: 0, high: 0, medium: 0, low: 0, score: 0 };
    row.total += 1;
    row[mapping.priority] += 1;
    row.score += priorityWeight(mapping.priority);
    byDomain.set(domain, row);
  }
  return [...byDomain.values()].sort((a, b) => b.score - a.score || b.total - a.total || a.domain.localeCompare(b.domain));
}

function buildExecutiveActions(targetCoverage, domainCoverage) {
  const topTargets = targetCoverage.slice(0, 8);
  const topDomains = domainCoverage.slice(0, 5);
  const actions = [];

  for (const target of topTargets) {
    actions.push({
      title: `Review target: ${target.target}`,
      priority: target.high > 0 ? "high" : target.medium > 0 ? "medium" : "low",
      reason: `${target.hits} impact hits (${target.high}H/${target.medium}M/${target.low}L)`,
      target: target.target,
      existsInRepo: target.existsInRepo,
      recommendation: target.recommendations[0] || "Review compatibility with latest external updates.",
    });
  }

  for (const domain of topDomains) {
    actions.push({
      title: `Domain watch: ${domain.domain}`,
      priority: domain.high > 0 ? "high" : domain.medium > 0 ? "medium" : "low",
      reason: `${domain.total} mappings (${domain.high}H/${domain.medium}M/${domain.low}L)`,
      target: "(cross-cutting)",
      existsInRepo: true,
      recommendation: "Promote top mapping recommendations into sprint backlog and validate contracts.",
    });
  }

  return actions.slice(0, 12);
}

function toMarkdown(snapshot) {
  const actions = snapshot.improvementEvaluation.executiveActions;
  const targetRows = snapshot.improvementEvaluation.targetCoverage.slice(0, 12);
  const domainRows = snapshot.improvementEvaluation.domainCoverage.slice(0, 8);
  return `# Knowledge Improvement Eval — ${snapshot.generatedForDate}

Generated at: ${snapshot.generatedAt}

## Snapshot

- Sources: ${snapshot.stats.sources}
- References: ${snapshot.stats.references}
- Events (last run window): ${snapshot.stats.events}
- Impact mappings: ${snapshot.stats.mappings}

## Executive Actions

${actions.length ? actions.map((a, i) => `${i + 1}. **${a.title}** [${a.priority}] — ${a.reason} · \`${a.target}\``).join("\n") : "- None"}

## Target Coverage (Top)

${targetRows.length ? targetRows.map((r) => `- \`${r.target}\` · score ${r.score} · hits ${r.hits} (${r.high}H/${r.medium}M/${r.low}L) · exists=${r.existsInRepo}`).join("\n") : "- None"}

## Domain Coverage

${domainRows.length ? domainRows.map((r) => `- ${r.domain} · score ${r.score} · total ${r.total} (${r.high}H/${r.medium}M/${r.low}L)`).join("\n") : "- None"}
`;
}

export async function runKnowledgeDbBuild({ days = 14, silent = false } = {}) {
  const [registry, references, impact, events] = await Promise.all([
    readJsonOrDefault(paths.sourcesRegistry, { sources: [] }),
    readJsonOrDefault(paths.referencesCatalog, { references: [] }),
    readJsonOrDefault(paths.impactMap, { mappings: [] }),
    readJsonl(paths.eventsLog, { limit: 8000 }),
  ]);

  const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
  const recentEvents = safeArray(events).filter((e) => {
    const ts = new Date(e.capturedAt || e.publishedAt || 0).getTime();
    return Number.isFinite(ts) && ts >= threshold;
  });
  const mappings = safeArray(impact.mappings);
  const targetCoverage = await buildTargetCoverage(mappings);
  const domainCoverage = buildDomainCoverage(mappings);
  const executiveActions = buildExecutiveActions(targetCoverage, domainCoverage);

  const snapshot = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    generatedForDate: asDateOnly(),
    daysAnalyzed: days,
    stats: {
      sources: safeArray(registry.sources).length,
      references: safeArray(references.references).length,
      events: recentEvents.length,
      mappings: mappings.length,
    },
    improvementEvaluation: {
      executiveActions,
      targetCoverage,
      domainCoverage,
    },
  };

  const dbPath = path.join(paths.knowledgeDir, "knowledge-db.json");
  await writeJson(dbPath, snapshot);

  const mdPath = path.join(paths.reportsDir, `KNOWLEDGE-IMPROVEMENT-EVAL-${asDateOnly()}.md`);
  await fs.writeFile(mdPath, `${toMarkdown(snapshot)}\n`, "utf8");

  const payload = {
    ok: true,
    generatedAt: snapshot.generatedAt,
    dbPath: path.relative(paths.repoRoot, dbPath),
    reportPath: path.relative(paths.repoRoot, mdPath),
    executiveActions: executiveActions.length,
    topTargets: targetCoverage.slice(0, 5).map((t) => t.target),
  };
  if (!silent) {
    console.log(JSON.stringify(payload, null, 2));
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const daysArg = Number(process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] || "14");
  runKnowledgeDbBuild({ days: Number.isFinite(daysArg) ? daysArg : 14 }).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
