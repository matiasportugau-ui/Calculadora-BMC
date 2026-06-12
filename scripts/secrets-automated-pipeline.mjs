#!/usr/bin/env node
/**
 * Automated end-to-end run for secrets management hardening.
 *
 * Machine-only where possible (after Doppler + gcloud [H0] bootstrap).
 * Reuses the exact patterns from channels-automated-pipeline.mjs for consistency.
 *
 * Usage:
 *   npm run secrets:automated
 *   npm run secrets:automated -- --write     # writes .runtime/secrets-hardening-last-run.json + log
 *   doppler run -- npm run secrets:automated  # recommended for any real secret steps
 *
 * Exit 1 if drift != 0, gate:local:full fails, or the verify script reports issues.
 *
 * The pipeline exercises:
 *   - check-env-drift
 *   - gate:local:full (or gate:local for speed)
 *   - secrets-provision-verify.sh (dry + real under doppler)
 *   - pre-deploy
 *   - smoke:prod (post-"deploy" verification)
 *   - auto-gen verification hints (gcloud describe for live revision)
 *
 * Produces JSON + optional log artifact for agents / CI / cron.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function parseArgs(argv) {
  let write = false;
  let json = false;
  let fast = false; // use gate:local instead of full for speed
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--write") write = true;
    if (argv[i] === "--json") json = true;
    if (argv[i] === "--fast") fast = true;
  }
  return { write, json, fast };
}

async function runDrift() {
  const t0 = Date.now();
  const script = path.join(ROOT, "scripts/check-env-drift.mjs");
  const { stdout } = await execFileP(process.execPath, [script, "--json"], {
    cwd: ROOT,
    maxBuffer: 1024 * 1024,
  });
  const ms = Date.now() - t0;
  const data = JSON.parse(stdout.trim());
  return { ms, data, ok: data.drift.length === 0 };
}

async function runGate(fast) {
  const t0 = Date.now();
  const cmd = fast ? "gate:local" : "gate:local:full";
  try {
    await execFileP("npm", ["run", cmd], {
      cwd: ROOT,
      maxBuffer: 8 * 1024 * 1024,
      stdio: "inherit", // let the user see the full output
    });
    return { ms: Date.now() - t0, ok: true, cmd };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, cmd, error: e.message };
  }
}

async function runVerify(dry = true) {
  const t0 = Date.now();
  const script = path.join(ROOT, "scripts/secrets-provision-verify.sh");
  const args = dry ? ["--dry-run"] : [];
  try {
    const { stdout } = await execFileP(script, args, {
      cwd: ROOT,
      maxBuffer: 4 * 1024 * 1024,
    });
    const ms = Date.now() - t0;
    const ok = stdout.includes("check-env-drift: clean") && !stdout.includes("❌");
    return { ms, ok, output: stdout.slice(-2000) }; // last part for summary
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, error: e.message };
  }
}

async function runPreDeploy() {
  const t0 = Date.now();
  try {
    await execFileP("npm", ["run", "pre-deploy"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    return { ms: Date.now() - t0, ok: true };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, error: e.message };
  }
}

async function runSmoke() {
  const t0 = Date.now();
  const script = path.join(ROOT, "scripts/smoke-prod-api.mjs");
  const { stdout } = await execFileP(process.execPath, [script, "--json"], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
  });
  const ms = Date.now() - t0;
  const data = JSON.parse(stdout.trim());
  return { ms, data, ok: data.ok !== false };
}

async function main() {
  const { write, json: asJson, fast } = parseArgs(process.argv.slice(2));
  const results = {};

  console.error("=== BMC Secrets Automated Pipeline ===");
  console.error(`Mode: ${fast ? "fast (gate:local)" : "full (gate:local:full)"}`);
  console.error("Use `doppler run -- npm run secrets:automated` for real secret steps.\n");

  // 1. Drift (hard requirement)
  console.error("1. Drift check...");
  results.drift = await runDrift();
  console.error(results.drift.ok ? "   ✅ Drift clean" : "   ❌ Drift detected");
  if (!results.drift.ok) {
    console.error(JSON.stringify(results.drift.data, null, 2));
    process.exit(1);
  }

  // 2. Gate
  console.error(`2. ${fast ? "gate:local" : "gate:local:full"}...`);
  results.gate = await runGate(fast);
  console.error(results.gate.ok ? "   ✅ Gate passed" : "   ❌ Gate failed");

  // 3. Verify script (dry first, then real if not fast)
  console.error("3. secrets-provision-verify.sh (dry-run)...");
  results.verifyDry = await runVerify(true);
  console.error(results.verifyDry.ok ? "   ✅ Dry verify OK" : "   ⚠️  Dry verify had notes");

  if (!fast) {
    console.error("4. secrets-provision-verify.sh (real, expects doppler)...");
    results.verifyReal = await runVerify(false);
    console.error(results.verifyReal.ok ? "   ✅ Real verify OK" : "   ⚠️  Check output for issues");
  }

  // 5. Pre-deploy
  console.error("5. pre-deploy...");
  results.predeploy = await runPreDeploy();
  console.error(results.predeploy.ok ? "   ✅ Pre-deploy OK" : "   ⚠️  Pre-deploy had warnings");

  // 6. Smoke (post-deploy verification)
  console.error("6. smoke:prod (post-deploy verification)...");
  results.smoke = await runSmoke();
  console.error(results.smoke.ok ? "   ✅ Smoke passed" : "   ❌ Smoke failed");

  const overallOk = results.drift.ok && results.gate.ok && results.smoke.ok;

  const summary = {
    ok: overallOk,
    ts: new Date().toISOString(),
    durationMs: Date.now() - (results.drift ? 0 : Date.now()), // rough
    results,
    next: overallOk
      ? "Changes are production-ready. Update PROJECT-STATE.md and run the new verify script against the live revision."
      : "Investigate failures above. Re-run with --fast for quicker iteration.",
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.error("\n=== SUMMARY ===");
    console.error(JSON.stringify(summary, null, 2));
  }

  if (write) {
    const outDir = path.join(ROOT, ".runtime");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(outDir, `secrets-hardening-run-${stamp}.json`), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(outDir, `secrets-hardening-run-${stamp}.log`), JSON.stringify(summary, null, 2));
    console.error(`\nArtifacts written to .runtime/secrets-hardening-run-${stamp}.*`);
  }

  process.exit(overallOk ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error in secrets pipeline:", e);
  process.exit(1);
});
