#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Version drift reconciler — prod vs git vs local.
// ═══════════════════════════════════════════════════════════════════════════
//
// Answers the question the existing reconcilers do NOT: is the version deployed
// to prod the same as local git HEAD and the local generated data version?
//   - prod  → GET /version (gitSha + calculatorDataVersion) on the deployed API
//   - git   → `git rev-parse HEAD` (local working copy)
//   - local → CALCULATOR_DATA_VERSION (src/data/calculatorDataVersion.js)
//
// Read-only: only does a GET and reads local git/state. Never writes prod/infra.
//
// Usage:
//   npm run version:reconcile
//   node scripts/reconcile-version.mjs --base https://...   # override prod base
//   node scripts/reconcile-version.mjs --json               # JSON to stdout
//   node scripts/reconcile-version.mjs --strict             # exit 1 unless aligned
//
// Writes a best-effort report to .runtime/version-reconcile-<date>.json.
// Note: prod being BEHIND local git HEAD is normal during active dev (local
// branch ahead of the deployed revision); --strict is meant for post-deploy CI
// on main, where prod and HEAD should match.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { CALCULATOR_DATA_VERSION } from "../src/data/calculatorDataVersion.js";

const DEFAULT_BASE = "https://panelin-calc-q74zutv7dq-uc.a.run.app";
const TIMEOUT_MS = 15_000;

function parseArgs(argv) {
  let base = process.env.BMC_API_BASE || process.env.SMOKE_BASE_URL || DEFAULT_BASE;
  let json = false;
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) base = argv[++i];
    else if (argv[i] === "--json") json = true;
    else if (argv[i] === "--strict") strict = true;
  }
  return { base: base.replace(/\/+$/, ""), json, strict };
}

function localGitHead() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/** Tolerant SHA compare: handles short-vs-full forms (e.g. 10-char vs 40-char). */
function shaEquals(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [lo, hi] = a.length <= b.length ? [a, b] : [b, a];
  return lo.length >= 7 && hi.startsWith(lo);
}

function shortSha(sha) {
  return typeof sha === "string" && sha.length >= 7 ? sha.slice(0, 10) : sha;
}

async function fetchProdVersion(base) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/version`, { signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON response (e.g. HTML 404) */
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const { base, json, strict } = parseArgs(process.argv.slice(2));
  const localSha = localGitHead();
  const localDataVersion = CALCULATOR_DATA_VERSION || null;

  let reachable = false;
  let error = null;
  let prodBody = null;
  try {
    const prod = await fetchProdVersion(base);
    reachable = prod.status === 200 && prod.body && typeof prod.body === "object";
    prodBody = prod.body;
    if (!reachable) {
      error = `prod /version HTTP ${prod?.status ?? "?"} (¿endpoint aún no desplegado en esta revisión?)`;
    }
  } catch (e) {
    error = e?.name === "AbortError" ? `timeout tras ${TIMEOUT_MS}ms` : e?.message || String(e);
  }

  const prodSha = reachable ? prodBody.gitSha ?? null : null;
  const prodDataVersion = reachable ? prodBody.calculatorDataVersion ?? null : null;

  const gitShaMatch =
    reachable && prodSha != null && localSha != null ? shaEquals(prodSha, localSha) : null;
  const dataVersionMatch =
    reachable && prodDataVersion != null && localDataVersion != null
      ? prodDataVersion === localDataVersion
      : null;

  const drift = gitShaMatch === false || dataVersionMatch === false;
  const unknown = gitShaMatch === null || dataVersionMatch === null;
  const aligned = !error && gitShaMatch === true && dataVersionMatch === true;

  const report = {
    ok: !error,
    generatedAt: new Date().toISOString(),
    base,
    reachable,
    error,
    local: {
      gitSha: localSha,
      gitShaShort: shortSha(localSha),
      calculatorDataVersion: localDataVersion,
    },
    prod: {
      gitSha: prodSha,
      gitShaShort: shortSha(prodSha),
      calculatorDataVersion: prodDataVersion,
      version: reachable ? prodBody.version ?? null : null,
      deployedAt: reachable ? prodBody.deployedAt ?? null : null,
    },
    compare: { gitShaMatch, dataVersionMatch, drift, unknown, aligned },
  };

  // Best-effort report file (mirrors other reconcilers writing to .runtime/).
  try {
    mkdirSync(".runtime", { recursive: true });
    const date = report.generatedAt.slice(0, 10);
    writeFileSync(`.runtime/version-reconcile-${date}.json`, JSON.stringify(report, null, 2));
  } catch {
    /* non-fatal */
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const yn = (v) => (v === null ? "❔ desconocido" : v ? "✅ igual" : "⚠️ DRIFT");
    console.log("\n═══ Version reconcile — prod vs git vs local ═══");
    console.log(`  base:             ${base}`);
    if (error) console.log(`  ⚠️  prod:         ${error}`);
    console.log(`  git SHA  local:   ${shortSha(localSha) ?? "—"}`);
    console.log(`  git SHA  prod:    ${shortSha(prodSha) ?? "—"}   → ${yn(gitShaMatch)}`);
    console.log(`  dataVer  local:   ${localDataVersion ?? "—"}`);
    console.log(`  dataVer  prod:    ${prodDataVersion ?? "—"}   → ${yn(dataVersionMatch)}`);
    console.log(
      `  veredicto:        ${aligned ? "✅ alineado" : drift ? "⚠️ DRIFT (prod ≠ local)" : "❔ no concluyente"}`,
    );
    console.log("");
  }

  if (strict && !aligned) process.exit(1);
}

main().catch((e) => {
  console.error("reconcile-version failed:", e?.message || e);
  process.exit(1);
});
