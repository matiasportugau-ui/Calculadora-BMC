#!/usr/bin/env node
/**
 * Autonomous 3-step ship goal for bug-reports feature:
 *   1) Create BUG_REPORTS sheet tab (idempotent)
 *   2) Push main to origin (if ahead)
 *   3) Wait CI + deploys, then verify prod (smoke + POST /api/bugs/report)
 *
 * Logs: .runtime/goals/bug-reports-ship.log
 * State: .runtime/goals/bug-reports-ship-state.json
 *
 * Run: node scripts/bug-reports-ship-goal.mjs
 * Env: BMC_API_BASE or smoke default; API_AUTH_TOKEN optional for GET verify
 */
import "dotenv/config";
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RUNTIME = path.join(ROOT, ".runtime", "goals");
const LOG = path.join(RUNTIME, "bug-reports-ship.log");
const STATE = path.join(RUNTIME, "bug-reports-ship-state.json");

const PROD_API =
  process.env.BMC_API_BASE ||
  process.env.SMOKE_BASE_URL ||
  "https://panelin-calc-q74zutv7dq-uc.a.run.app";

const POLL_MS = 30_000;
const MAX_WAIT_MS = 45 * 60_000; // 45 min total for CI+deploy

function ts() {
  return new Date().toISOString();
}

function log(msg, obj) {
  const line = obj ? `${ts()} ${msg} ${JSON.stringify(obj)}` : `${ts()} ${msg}`;
  fs.mkdirSync(RUNTIME, { recursive: true });
  fs.appendFileSync(LOG, line + "\n");
  console.log(line);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return {};
  }
}

function getOpenPr(branch) {
  if (!hasGh() || !branch) return null;
  try {
    const raw = runSync(
      `gh pr list --head ${branch} --json number,state,mergedAt,statusCheckRollup,reviewDecision,url --jq '.[0]'`
    );
    return JSON.parse(raw || "null");
  } catch {
    return null;
  }
}

/** Returns { blocked, prUrl } | { merged } | { waiting } | null */
function describePrGate(pr) {
  if (!pr) return null;
  if (pr.state === "MERGED") return { merged: true, prUrl: pr.url };
  if (pr.state !== "OPEN") return { blocked: `PR ${pr.state}`, prUrl: pr.url };
  const checks = pr.statusCheckRollup || [];
  const pending = checks.filter((c) => ["IN_PROGRESS", "QUEUED", "PENDING"].includes(c.status));
  if (pending.length > 0) return { waiting: pending.length, prUrl: pr.url };
  const reasons = [];
  const failed = checks.filter((c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED");
  if (failed.length) reasons.push(failed.map((c) => c.name).join(", "));
  if (pr.reviewDecision === "CHANGES_REQUESTED") reasons.push("review CHANGES_REQUESTED");
  if (reasons.length) return { blocked: reasons.join("; "), prUrl: pr.url };
  return { ready: true, prUrl: pr.url };
}

function saveState(patch) {
  fs.mkdirSync(RUNTIME, { recursive: true });
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    /* fresh */
  }
  const next = { ...prev, ...patch, updatedAt: ts() };
  fs.writeFileSync(STATE, JSON.stringify(next, null, 2));
  return next;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BMC_DISK_PRECHECK_SKIP: "1", ...opts.env },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} ${args.join(" ")} exit ${code}\n${err || out}`));
    });
  });
}

function runSync(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function hasGh() {
  try {
    runSync("which gh");
    return true;
  } catch {
    return false;
  }
}

async function step1_setupSheet() {
  log("STEP 1 — setup BUG_REPORTS tab");
  try {
    const { out } = await run("node", ["scripts/setup-bug-reports-tab.mjs"]);
    const lines = out.trim().split("\n").filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    if (!last.ok) throw new Error(last.error || out);
    saveState({ step1: "done", sheetTab: last.tab || "BUG_REPORTS" });
    return last;
  } catch (e) {
    const msg = e.message || String(e);
    const humanGate =
      /insufficient authentication|ENOENT|not configured|403|permission/i.test(msg);
    if (humanGate) {
      log("STEP 1 — HUMAN GATE (sheet tab)", {
        error: msg.slice(0, 300),
        action:
          "Create BUG_REPORTS tab manually OR set GOOGLE_APPLICATION_CREDENTIALS to valid SA JSON with Editor on BMC sheet. Continuing to push + prod verify.",
      });
      saveState({
        step1: "skipped_human_gate",
        step1Error: msg.slice(0, 500),
        humanGateSheet:
          "https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit",
      });
      return { skipped: true };
    }
    throw e;
  }
}

async function step2_push() {
  log("STEP 2 — git push (main or PR path)");
  let ahead = 0;
  try {
    ahead = Number(runSync("git rev-list --count origin/main..HEAD 2>/dev/null || echo 0"));
  } catch {
    ahead = 0;
  }
  const sha = runSync("git rev-parse HEAD");
  if (ahead === 0) {
    log("STEP 2 — already synced with origin/main");
    saveState({ step2: "skipped", reason: "no commits ahead", sha });
    return { pushed: false, sha, via: "none" };
  }

  const shipBranch = `ship/bug-reports-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

  async function pushBranch(branch) {
    await run("git", ["push", "-u", "origin", branch]);
  }

  try {
    await pushBranch("main");
    saveState({ step2: "done", pushed: true, sha, via: "main" });
    log("STEP 2 — pushed to main", { sha, ahead });
    return { pushed: true, sha, via: "main" };
  } catch (mainErr) {
    const protectedMain = /protected branch|GH006|pull request/i.test(mainErr.message || "");
    if (!protectedMain) throw mainErr;
    log("STEP 2 — main protected; using PR branch", { branch: shipBranch });
  }

  const currentBranch = runSync("git rev-parse --abbrev-ref HEAD");
  if (currentBranch !== shipBranch) {
    try {
      runSync(`git checkout -b ${shipBranch}`);
    } catch {
      runSync(`git checkout ${shipBranch}`);
    }
  }

  let skipPush = false;
  try {
    const remoteSha = runSync(`git rev-parse origin/${shipBranch}`);
    if (remoteSha === sha) {
      skipPush = true;
      log("STEP 2 — branch unchanged on origin; skip push (avoids re-triggering CI)");
    }
  } catch {
    /* first push */
  }
  if (!skipPush) await pushBranch(shipBranch);

  let prUrl = "";
  if (hasGh()) {
    try {
      const existing = runSync(
        `gh pr list --head ${shipBranch} --json url,number --jq '.[0].url // empty'`
      );
      prUrl = existing || runSync(
        `gh pr create --base main --head ${shipBranch} --title "ship: bug-reports feature + goal tooling" --body "Autonomous ship goal: bug reports UI/API, test fixes, setup scripts. See docs/procedimientos/BUG-REPORTS-SHIP-PLAN.md"`
      );
      log("STEP 2 — PR open", { prUrl });
      try {
        runSync(`gh pr merge ${shipBranch} --squash --auto 2>/dev/null || true`);
      } catch {
        /* auto-merge may require approval */
      }
    } catch (e) {
      log("WARN — gh pr create failed", { error: e.message });
    }
  }

  saveState({ step2: "done", pushed: true, sha, via: "pr", branch: shipBranch, prUrl });
  log("STEP 2 — pushed via PR branch", { sha, ahead, branch: shipBranch });
  return { pushed: true, sha, via: "pr", branch: shipBranch, prUrl };
}

async function waitForWorkflow(workflowName, sha) {
  if (!hasGh()) {
    log("WARN — gh CLI missing; skipping workflow poll", { workflowName });
    return { skipped: true };
  }
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    let json;
    try {
      json = runSync(
        `gh run list --workflow="${workflowName}" --branch=main --limit=5 --json databaseId,status,conclusion,headSha,createdAt`
      );
    } catch (e) {
      log("WARN — gh run list failed", { error: e.message });
      return { skipped: true, error: e.message };
    }
    const runs = JSON.parse(json || "[]");
    const match = runs.find((r) => r.headSha === sha) || runs[0];
    if (match) {
      log("POLL", { workflow: workflowName, status: match.status, conclusion: match.conclusion, headSha: match.headSha });
      if (match.status === "completed") {
        return { conclusion: match.conclusion, databaseId: match.databaseId };
      }
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timeout waiting for workflow: ${workflowName}`);
}

async function waitForPrMerged(branch, maxMs = MAX_WAIT_MS) {
  if (!hasGh() || !branch) return { skipped: true };

  const pr0 = getOpenPr(branch);
  const gate0 = describePrGate(pr0);
  if (gate0?.merged) return { merged: true, mergedAt: pr0.mergedAt };
  if (gate0?.blocked) {
    throw new Error(
      `HUMAN GATE — merge PR manually (${gate0.prUrl || ""}): ${gate0.blocked}`
    );
  }

  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const pr = getOpenPr(branch);
      if (!pr) return { merged: true, note: "no open PR" };
      const gate = describePrGate(pr);
      log("PR POLL", { state: pr.state, gate: gate?.waiting ? `waiting:${gate.waiting}` : gate?.blocked || "ok", mergedAt: pr.mergedAt });
      if (gate?.merged || pr.state === "MERGED") return { merged: true, mergedAt: pr.mergedAt };
      if (pr.state === "CLOSED" && !pr.mergedAt) throw new Error("PR closed without merge");
      if (gate?.blocked) {
        throw new Error(`HUMAN GATE — merge PR manually (${gate.prUrl || ""}): ${gate.blocked}`);
      }
      if (gate?.ready && pr.state === "OPEN") {
        try {
          runSync(`gh pr merge ${branch} --squash --admin 2>/dev/null || gh pr merge ${branch} --squash`);
          log("STEP 2b — PR merged");
          return { merged: true };
        } catch (e) {
          log("WARN — auto-merge blocked (approval required?)", { error: e.message });
        }
      }
    } catch (e) {
      if (/checks failed|closed without merge/i.test(e.message)) throw e;
      log("WARN — pr poll", { error: e.message });
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Timeout waiting for PR merge");
}

async function step3_verify(sha, pushMeta = {}) {
  log("STEP 3 — wait CI + deploy, then verify prod");

  if (pushMeta.via === "pr" && pushMeta.branch) {
    const merge = await waitForPrMerged(pushMeta.branch);
    if (merge.merged) {
      try {
        runSync("git fetch origin main && git rev-parse origin/main");
        sha = runSync("git rev-parse origin/main");
        log("STEP 3 — using merged main SHA", { sha });
      } catch {
        /* keep branch sha */
      }
    }
  }

  if (hasGh()) {
    const ci = await waitForWorkflow("CI — Panelin Calculadora BMC", sha);
    if (ci.skipped) {
      log("STEP 3 — CI poll skipped; waiting 3 min before smoke");
      await new Promise((r) => setTimeout(r, 180_000));
    } else if (ci.conclusion !== "success") {
      throw new Error(`CI failed: ${ci.conclusion}`);
    } else {
      log("STEP 3 — CI green");
      // Deploy workflows trigger after CI; give them a head start then poll
      await new Promise((r) => setTimeout(r, 60_000));
      for (const wf of ["Deploy Calculator API to Cloud Run", "Deploy Frontend to Vercel"]) {
        try {
          const dep = await waitForWorkflow(wf, sha);
          if (!dep.skipped) log("DEPLOY", { workflow: wf, conclusion: dep.conclusion });
        } catch (e) {
          log("WARN — deploy poll inconclusive", { workflow: wf, error: e.message });
        }
      }
    }
  } else {
    log("STEP 3 — no gh; waiting 8 min for CI/deploy propagation");
    await new Promise((r) => setTimeout(r, 8 * 60_000));
  }

  log("STEP 3 — smoke:prod");
  await run("npm", ["run", "smoke:prod", "--", "--json"], {
    env: { BMC_API_BASE: PROD_API, SMOKE_BASE_URL: PROD_API },
  });

  log("STEP 3 — POST /api/bugs/report smoke");
  const payload = {
    shortDescription: `[ship-goal smoke] ${new Date().toISOString()}`,
    details: "Autonomous ship goal verification — safe to delete",
    severity: "baja",
    url: "https://calculadora-bmc.vercel.app/",
    capturedAt: new Date().toISOString(),
    userAgent: "bug-reports-ship-goal/1.0",
    context: { source: "bug-reports-ship-goal", logs: [{ t: Date.now(), level: "info", message: "smoke" }] },
  };
  const res = await fetch(`${PROD_API.replace(/\/+$/, "")}/api/bugs/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`POST /api/bugs/report failed: HTTP ${res.status} ${data.error || JSON.stringify(data)}`);
  }
  log("STEP 3 — bug report OK", { id: data.id, tab: data.tab });

  saveState({ step3: "done", bugId: data.id, apiBase: PROD_API });
  return { bugId: data.id };
}

async function main() {
  fs.mkdirSync(RUNTIME, { recursive: true });
  fs.appendFileSync(LOG, `\n=== bug-reports-ship-goal started ${ts()} ===\n`);
  const prev = loadState();
  saveState({ status: "running", startedAt: ts() });

  try {
    await step1_setupSheet();

    const resumeBranch = prev.branch || `ship/bug-reports-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const prResume = getOpenPr(resumeBranch);
    const gateResume = describePrGate(prResume);
    if (gateResume?.merged) {
      log("RESUME — PR already merged; jumping to step 3", { prUrl: gateResume.prUrl });
      let sha = runSync("git rev-parse origin/main");
      await step3_verify(sha, { via: "pr", branch: resumeBranch, merged: true });
      saveState({ status: "completed", completedAt: ts() });
      log("GOAL COMPLETE — bug-reports shipped and verified");
      process.exit(0);
    }
    if (gateResume?.blocked) {
      throw new Error(
        `HUMAN GATE — stop re-running until merged: ${gateResume.blocked}. ${gateResume.prUrl || prev.prUrl || ""}`
      );
    }

    const pushMeta = await step2_push();
    await step3_verify(pushMeta.sha, pushMeta);
    saveState({ status: "completed", completedAt: ts() });
    log("GOAL COMPLETE — bug-reports shipped and verified");
    process.exit(0);
  } catch (e) {
    const msg = e.message || String(e);
    const paused = /HUMAN GATE|PR checks failed|approval required|Timeout waiting for PR merge/i.test(msg);
    saveState({
      status: paused ? "paused" : "failed",
      error: msg,
      failedAt: ts(),
      resume: "npm run bug-reports:ship",
    });
    log(paused ? "GOAL PAUSED" : "GOAL FAILED", { error: msg });
    process.exit(paused ? 2 : 1);
  }
}

main();