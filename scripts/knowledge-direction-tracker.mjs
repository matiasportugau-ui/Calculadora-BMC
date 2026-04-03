#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asDateOnly, nowIso, paths, readJsonOrDefault, writeJson } from "./knowledge-antenna-lib.mjs";

const TRACKER_JSON = path.join(paths.knowledgeDir, "development-direction-tracker.json");
const TRACKER_MD = path.join(paths.knowledgeDir, "DEVELOPMENT-DIRECTION-TRACKER.md");

function toTrackerId(action) {
  const raw = `${action.target || "global"}|${action.title || "action"}`.toLowerCase();
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function normalizePriority(priority) {
  if (priority === "high" || priority === "medium" || priority === "low") return priority;
  return "medium";
}

function scoreFromPriority(priority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function pickExisting(existingIndex, id) {
  return existingIndex.get(id) || null;
}

function buildMarkdown(tracker) {
  const stats = tracker.summary;
  const items = tracker.items;
  const high = items.filter((i) => i.priority === "high");
  const medium = items.filter((i) => i.priority === "medium");
  const low = items.filter((i) => i.priority === "low");

  const renderItems = (rows) => {
    if (!rows.length) return "- None";
    return rows
      .map((item, idx) => {
        return `${idx + 1}. [${item.status}] **${item.title}**
   - target: \`${item.target}\`
   - owner: ${item.owner || "-"}
   - due: ${item.dueDate || "-"}
   - reason: ${item.reason}
   - recommendation: ${item.recommendation}
   - next: ${item.nextStep || "-"}
   - evidence: ${item.evidence || "-"}`;
      })
      .join("\n");
  };

  return `# Development Direction Tracker — ${tracker.generatedForDate}

Generated at: ${tracker.generatedAt}

## How To Use

- Update only: \`status\`, \`owner\`, \`dueDate\`, \`nextStep\`, \`evidence\`, \`notes\` in \`development-direction-tracker.json\`.
- Re-run \`npm run knowledge:direction\` (or \`knowledge:run\`) to refresh priorities without losing manual tracking fields.
- Status values: \`todo\`, \`in_progress\`, \`blocked\`, \`done\`.

## Summary

- Total items: ${stats.total}
- High: ${stats.high}
- Medium: ${stats.medium}
- Low: ${stats.low}
- Done: ${stats.done}
- In progress: ${stats.inProgress}
- Blocked: ${stats.blocked}

## High Priority

${renderItems(high)}

## Medium Priority

${renderItems(medium)}

## Low Priority

${renderItems(low)}
`;
}

export async function runKnowledgeDirectionTracker({ maxItems = 12, silent = false } = {}) {
  const db = await readJsonOrDefault(path.join(paths.knowledgeDir, "knowledge-db.json"), null);
  if (!db || !db.improvementEvaluation) {
    throw new Error("knowledge-db.json not found or invalid. Run `npm run knowledge:db` first.");
  }

  const existing = await readJsonOrDefault(TRACKER_JSON, { items: [] });
  const existingIndex = new Map((existing.items || []).map((item) => [item.id, item]));

  const actions = (db.improvementEvaluation.executiveActions || []).slice(0, maxItems);
  const items = actions.map((action) => {
    const id = toTrackerId(action);
    const prev = pickExisting(existingIndex, id);
    return {
      id,
      title: action.title,
      priority: normalizePriority(action.priority),
      score: scoreFromPriority(normalizePriority(action.priority)),
      reason: action.reason || "",
      recommendation: action.recommendation || "",
      target: action.target || "(cross-cutting)",
      existsInRepo: Boolean(action.existsInRepo),
      status: prev?.status || "todo",
      owner: prev?.owner || "",
      dueDate: prev?.dueDate || "",
      nextStep: prev?.nextStep || "",
      evidence: prev?.evidence || "",
      notes: prev?.notes || "",
      updatedAt: nowIso(),
    };
  });

  const summary = {
    total: items.length,
    high: items.filter((i) => i.priority === "high").length,
    medium: items.filter((i) => i.priority === "medium").length,
    low: items.filter((i) => i.priority === "low").length,
    done: items.filter((i) => i.status === "done").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    blocked: items.filter((i) => i.status === "blocked").length,
  };

  const tracker = {
    schemaVersion: "1.0.0",
    generatedAt: nowIso(),
    generatedForDate: asDateOnly(),
    source: "docs/team/knowledge/knowledge-db.json",
    summary,
    items,
  };

  await writeJson(TRACKER_JSON, tracker);
  await fs.writeFile(TRACKER_MD, `${buildMarkdown(tracker)}\n`, "utf8");

  const payload = {
    ok: true,
    generatedAt: tracker.generatedAt,
    trackerJson: path.relative(paths.repoRoot, TRACKER_JSON),
    trackerReport: path.relative(paths.repoRoot, TRACKER_MD),
    summary,
  };
  if (!silent) {
    console.log(JSON.stringify(payload, null, 2));
  }
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const maxArg = Number(process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] || "12");
  runKnowledgeDirectionTracker({ maxItems: Number.isFinite(maxArg) ? maxArg : 12 }).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
