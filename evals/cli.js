#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCase, listCases } from "./lib/loadCase.js";
import { runQuote } from "./lib/runQuote.js";
import { compareRun } from "./lib/compareGolden.js";
import { buildCaseReport, buildRunReport, writeReports } from "./lib/report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(__dirname, "runs");

function parseArgs(argv) {
  const args = { ids: [], all: false };
  for (const a of argv) {
    if (a === "--all") args.all = true;
    else if (!a.startsWith("--")) args.ids.push(a);
  }
  return args;
}

function tsFolderName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let ids = args.ids;
  if (args.all || ids.length === 0) {
    ids = listCases();
    if (!ids.length) {
      console.error("No hay fixtures en evals/fixtures/");
      process.exit(1);
    }
    if (!args.all && args.ids.length === 0) {
      console.error(`Uso: node evals/cli.js <case-id> [<case-id>...] | --all`);
      console.error(`Fixtures disponibles: ${ids.join(", ")}`);
      process.exit(1);
    }
  }

  const runDir = path.join(RUNS_DIR, tsFolderName());
  const caseReports = [];

  for (const id of ids) {
    console.log(`▶ ${id}`);
    let caseData;
    try {
      caseData = loadCase(id);
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      continue;
    }
    let runResult;
    try {
      runResult = runQuote(caseData);
    } catch (err) {
      console.error(`  ✗ motor falló: ${err.message}`);
      continue;
    }
    const comparison = compareRun(runResult, caseData);
    const caseReportMd = buildCaseReport(caseData, runResult, comparison);
    const { reportPath } = writeReports({ runDir, caseData, runResult, comparison, caseReportMd });
    console.log(`  ✓ ${path.relative(process.cwd(), reportPath)}`);
    caseReports.push({ caseData, runResult, comparison });
  }

  if (caseReports.length) {
    const runReportMd = buildRunReport(caseReports);
    fs.writeFileSync(path.join(runDir, "run-report.md"), runReportMd, "utf8");
    console.log(`\nRun report: ${path.relative(process.cwd(), path.join(runDir, "run-report.md"))}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
