#!/usr/bin/env node
/**
 * Critical agent eval entrypoint.
 * Prefer promptfoo when installed + configured; always run offline catalog goldens.
 * Does not fail the whole monorepo if promptfoo is absent — reports SKIP.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
}

console.log("eval:agent — catalog goldens (required offline)");
const cat = run("npm", ["run", "test:catalog-goldens"]);
if (cat.status !== 0) {
  console.error(cat.stdout || cat.stderr);
  process.exit(cat.status || 1);
}
console.log(cat.stdout);

const pfConfig = path.join(ROOT, "evals/promptfoo/presup-orchestrator.yaml");
const hasPromptfooBin = run("npx", ["--no-install", "promptfoo", "--version"]).status === 0
  || run("which", ["promptfoo"]).status === 0;

if (fs.existsSync(pfConfig) && process.env.EVAL_PROMPTFOO === "1") {
  console.log("eval:agent — promptfoo presup-orchestrator (EVAL_PROMPTFOO=1)");
  const pf = run("npx", ["--yes", "promptfoo", "eval", "-c", "evals/promptfoo/presup-orchestrator.yaml"], {
    env: process.env,
  });
  console.log(pf.stdout || "");
  if (pf.status !== 0) {
    console.error(pf.stderr || "");
    process.exit(pf.status || 1);
  }
} else {
  console.log(
    "eval:agent — promptfoo SKIP (set EVAL_PROMPTFOO=1 and provide provider keys to run llm-rubric suites)",
  );
  console.log(`config present: ${fs.existsSync(pfConfig)}; has_bin_hint: ${hasPromptfooBin}`);
}

console.log("eval:agent — ok");
process.exit(0);
