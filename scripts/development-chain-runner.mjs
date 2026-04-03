#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { asDateOnly, nowIso, paths, readJsonOrDefault, writeJson } from "./knowledge-antenna-lib.mjs";

const CHAIN_JSON = path.join(paths.knowledgeDir, "development-chain-status.json");
const CHAIN_MD = path.join(paths.knowledgeDir, "DEVELOPMENT-CHAIN-STATUS.md");

function parseArgs() {
  return {
    full: process.argv.includes("--full"),
  };
}

function durationMs(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

function runShell(command) {
  return new Promise((resolve) => {
    const startedAt = nowIso();
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}` },
    });
    child.on("close", (code) => {
      const endedAt = nowIso();
      resolve({
        command,
        startedAt,
        endedAt,
        durationMs: durationMs(startedAt, endedAt),
        ok: code === 0,
        exitCode: code ?? 1,
      });
    });
  });
}

function buildSteps({ full }) {
  const steps = [
    {
      id: "knowledge_run",
      title: "Knowledge Intake + Direction",
      description: "Refresh knowledge, impact map, DB and tracker.",
      command: "npm run knowledge:run",
    },
    {
      id: "project_compass",
      title: "Project Compass Snapshot",
      description: "Update current program and follow-up status.",
      command: "npm run project:compass",
    },
    {
      id: "quality_gate",
      title: "Quality Gate",
      description: full ? "Run lint + test + build." : "Run lint + test.",
      command: full ? "npm run gate:local:full" : "npm run gate:local",
    },
  ];
  return steps;
}

function pickTopAction(tracker) {
  const items = Array.isArray(tracker?.items) ? tracker.items : [];
  const inProgress = items.find((item) => item.status === "in_progress");
  if (inProgress) return inProgress;
  return items.find((item) => item.status === "todo") || null;
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return "0s";
  return `${Math.round(ms / 1000)}s`;
}

function toMarkdown(status, topAction) {
  const stepLines = status.steps
    .map((step, idx) => {
      const symbol = step.ok ? "OK" : "FAIL";
      return `${idx + 1}. [${symbol}] **${step.title}**  \n   - command: \`${step.command}\`  \n   - duration: ${formatMs(step.durationMs)}  \n   - exitCode: ${step.exitCode}`;
    })
    .join("\n");

  const topActionBlock = topAction
    ? `- title: ${topAction.title}
- target: \`${topAction.target}\`
- owner: ${topAction.owner || "-"}
- dueDate: ${topAction.dueDate || "-"}
- nextStep: ${topAction.nextStep || "-"}`
    : "- No pending action found in direction tracker.";

  return `# Development Chain Status — ${status.generatedForDate}

Generated at: ${status.generatedAt}

## Chain Summary

- Mode: ${status.mode}
- Overall: ${status.ok ? "OK" : "FAILED"}
- Total steps: ${status.summary.totalSteps}
- Passed: ${status.summary.passed}
- Failed: ${status.summary.failed}
- Total duration: ${formatMs(status.summary.totalDurationMs)}

## Step-by-Step

${stepLines}

## Next Development Action

${topActionBlock}
`;
}

export async function runDevelopmentChain({ full = false } = {}) {
  const startedAt = nowIso();
  const steps = buildSteps({ full });
  const executed = [];
  let failed = false;

  for (const step of steps) {
    if (failed) {
      executed.push({
        ...step,
        ok: false,
        exitCode: null,
        skipped: true,
        durationMs: 0,
        startedAt: null,
        endedAt: null,
      });
      continue;
    }

    const result = await runShell(step.command);
    executed.push({
      ...step,
      ...result,
      skipped: false,
    });
    if (!result.ok) failed = true;
  }

  const endedAt = nowIso();
  const tracker = await readJsonOrDefault(path.join(paths.knowledgeDir, "development-direction-tracker.json"), { items: [] });
  const topAction = pickTopAction(tracker);
  const summary = {
    totalSteps: executed.length,
    passed: executed.filter((s) => s.ok && !s.skipped).length,
    failed: executed.filter((s) => !s.ok && !s.skipped).length,
    totalDurationMs: durationMs(startedAt, endedAt),
  };

  const status = {
    schemaVersion: "1.0.0",
    generatedAt: endedAt,
    generatedForDate: asDateOnly(),
    mode: full ? "full" : "standard",
    ok: !failed,
    startedAt,
    endedAt,
    summary,
    steps: executed,
    topAction: topAction || null,
  };

  await writeJson(CHAIN_JSON, status);
  await fs.writeFile(CHAIN_MD, `${toMarkdown(status, topAction)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: status.ok,
    mode: status.mode,
    chainJson: path.relative(paths.repoRoot, CHAIN_JSON),
    chainReport: path.relative(paths.repoRoot, CHAIN_MD),
    summary,
  }, null, 2));

  if (!status.ok) {
    process.exitCode = 1;
  }
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs();
  runDevelopmentChain(args).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
