/**
 * Verifies PreToolUse deny script blocks known-destructive patterns (exit 2).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(ROOT, ".claude/hooks/pre-tool-use.sh");

function run(input) {
  return spawnSync("bash", [script], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_TOOL_INPUT: input },
  });
}

const deny = run("git push --force origin main");
assert.equal(deny.status, 2, `expected deny exit 2, got ${deny.status}: ${deny.stderr}`);

const allow = run("npm run gate:local");
assert.equal(allow.status, 0, `expected allow exit 0, got ${allow.status}: ${allow.stderr}`);

const drop = run("psql -c 'DROP TABLE users'");
assert.equal(drop.status, 2, "DROP TABLE should deny");

console.log("hooks-deny.test.js: ok");
