#!/usr/bin/env node
/**
 * Optional check after a numbered full team run: MATPROMT file under team/matprompt or team/panelsim/matprompt,
 * or mention in MATPROMT-FULL-RUN-PROMPTS.md
 * Usage: node scripts/verify-full-team-artifacts.mjs --suffix 2026-03-22-run52
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const teamDir = join(repoRoot, "docs", "team");

function argSuffix() {
  const i = process.argv.indexOf("--suffix");
  if (i === -1 || !process.argv[i + 1]) {
    console.error("Usage: node scripts/verify-full-team-artifacts.mjs --suffix YYYY-MM-DD-runN");
    process.exit(2);
  }
  return process.argv[i + 1].trim();
}

const suffix = argSuffix();
const dirs = [
  { path: join(teamDir, "matprompt"), label: "docs/team/matprompt" },
  { path: join(teamDir, "panelsim", "matprompt"), label: "docs/team/panelsim/matprompt" },
];
const bundleFile = join(teamDir, "MATPROMT-FULL-RUN-PROMPTS.md");

let found = false;

for (const { path: dir, label } of dirs) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".md") && name.includes(suffix)) {
      console.log(`OK: ${label}/${name}`);
      found = true;
    }
  }
}

if (existsSync(bundleFile)) {
  const body = readFileSync(bundleFile, "utf8");
  if (body.includes(suffix)) {
    console.log(`OK: docs/team/MATPROMT-FULL-RUN-PROMPTS.md references ${suffix}`);
    found = true;
  }
}

if (!found) {
  console.error(`No MATPROMT artifact found for suffix: ${suffix}`);
  console.error("Looked in docs/team/matprompt/, docs/team/panelsim/matprompt/, and MATPROMT-FULL-RUN-PROMPTS.md");
  process.exit(1);
}

console.log("verify-full-team-artifacts: OK");
