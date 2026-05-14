#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// scripts/build-artifact.mjs
//
// Builds the Calculadora BMC as a single-file HTML artifact suitable for use
// inside claude.ai's Artifact runtime. Output: artifact/calculadora-bmc.html
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const VITE_CONFIG = path.join(repoRoot, "artifact/vite.artifact.config.js");
const BUILD_DIR = path.join(repoRoot, "artifact-build");
const BUILT_HTML = path.join(BUILD_DIR, "index.html");
const OUTPUT = path.join(repoRoot, "artifact/calculadora-bmc.html");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, BMC_DISK_PRECHECK_SKIP: "1" },
      ...opts,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function gitCommit() {
  return new Promise((resolve) => {
    const child = spawn("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    child.stdout.on("data", (b) => { out += b.toString(); });
    child.on("exit", () => resolve(out.trim() || "unknown"));
    child.on("error", () => resolve("unknown"));
  });
}

async function main() {
  console.log("[build-artifact] Cleaning previous build directory…");
  await fs.rm(BUILD_DIR, { recursive: true, force: true });

  console.log("[build-artifact] Running Vite build (single-file)…");
  const viteBin = path.join(repoRoot, "node_modules/.bin/vite");
  await run(viteBin, ["build", "--config", VITE_CONFIG]);

  const stat = await fs.stat(BUILT_HTML).catch(() => null);
  if (!stat) {
    throw new Error(`Expected build output not found at ${BUILT_HTML}`);
  }

  const html = await fs.readFile(BUILT_HTML, "utf8");
  const sha = await gitCommit();
  const now = new Date().toISOString();
  const banner = `<!--
  Calculadora BMC — Claude Artifact build
  Source repo:  https://github.com/matiasportugau-ui/Calculadora-BMC
  Commit:       ${sha}
  Generated:    ${now}
  Regenerate:   npm run build:artifact
-->\n`;

  const withBanner = html.startsWith("<!doctype") || html.startsWith("<!DOCTYPE")
    ? html.replace(/^(<!doctype html>\s*|<!DOCTYPE html>\s*)/i, (m) => `${m}${banner}`)
    : banner + html;

  await fs.writeFile(OUTPUT, withBanner, "utf8");

  const bytes = (await fs.stat(OUTPUT)).size;
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  console.log(`[build-artifact] Wrote ${OUTPUT} (${mb} MB, commit ${sha})`);

  console.log("[build-artifact] Cleaning intermediate build directory…");
  await fs.rm(BUILD_DIR, { recursive: true, force: true });
}

main().catch((err) => {
  console.error("[build-artifact] FAILED:", err.message);
  process.exit(1);
});
