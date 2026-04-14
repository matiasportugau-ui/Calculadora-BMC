#!/usr/bin/env node
/**
 * Expert dev traceability: local snapshot checkpoints (git + package version + workflow hints).
 * Comandos: snapshot | list | restore-hint | workflow
 */
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHECKPOINT_DIR = path.join(REPO_ROOT, ".cursor", "dev-checkpoints");
const PROD_APP = "https://calculadora-bmc.vercel.app";

function runGit(args, { cwd = REPO_ROOT } = {}) {
  try {
    const out = execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    });
    return { ok: true, out: String(out).trim() };
  } catch (e) {
    return { ok: false, out: "", err: e?.message || "git error" };
  }
}

function parseArgs(argv) {
  const cmd = argv[2] || "workflow";
  let message = "";
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--message=")) message = a.slice("--message=".length).trim();
    else if (a === "--message" && argv[i + 1]) {
      message = argv[++i];
    }
  }
  return { cmd, message };
}

async function readPackageVersion() {
  try {
    const raw = await fs.readFile(path.join(REPO_ROOT, "package.json"), "utf8");
    const j = JSON.parse(raw);
    return { version: j.version || "unknown", name: j.name || "unknown" };
  } catch {
    return { version: "unknown", name: "unknown" };
  }
}

async function buildSnapshot({ note }) {
  const pkg = await readPackageVersion();
  const head = runGit("rev-parse HEAD");
  const branch = runGit("rev-parse --abbrev-ref HEAD");
  const porcelain = runGit("status --porcelain");

  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const shortSha = head.ok && head.out ? head.out.slice(0, 7) : null;

  return {
    schema: "bmc.expertCheckpoint.v1",
    id: `cp-${iso}`,
    createdAt: new Date().toISOString(),
    note: note || "",
    package: pkg,
    node: process.version,
    git: {
      sha: head.ok ? head.out : null,
      shortSha,
      branch: branch.ok ? branch.out : null,
      dirty: porcelain.ok ? porcelain.out.length > 0 : null,
      dirtyLineCount: porcelain.ok ? porcelain.out.split("\n").filter(Boolean).length : null,
    },
    workflow: {
      localStack: "npm run dev:full | ./run_full_stack.sh → API :3001, Vite :5173",
      health: "http://localhost:3001/health",
      preDeploy: "npm run pre-deploy",
      gateFull: "npm run gate:local:full",
      smokeProd: "npm run smoke:prod",
      prodApp: PROD_APP,
      developmentChain: "npm run development:chain | npm run development:chain:full",
    },
    restore: {
      gitCheckout: head.ok && branch.ok ? `git checkout ${head.out}` : null,
      gitBranchAt: branch.ok && head.ok ? `${branch.out} @ ${shortSha}` : null,
    },
  };
}

async function cmdSnapshot(message) {
  const snap = await buildSnapshot({ note: message });

  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });

  const filePath = path.join(CHECKPOINT_DIR, `${snap.id}.json`);
  const body = `${JSON.stringify(snap, null, 2)}\n`;
  await fs.writeFile(filePath, body, "utf8");

  console.log(`Checkpoint written: ${path.relative(REPO_ROOT, filePath)}`);
  console.log(`  version=${snap.package.version} sha=${snap.git.shortSha || "?"} branch=${snap.git.branch || "?"} dirty=${snap.git.dirty}`);
}

async function cmdList() {
  if (!existsSync(CHECKPOINT_DIR)) {
    console.log("No checkpoints yet. Run: npm run expert:checkpoint");
    return;
  }
  const names = (await fs.readdir(CHECKPOINT_DIR)).filter((n) => n.endsWith(".json"));
  const metas = [];
  for (const n of names) {
    const fp = path.join(CHECKPOINT_DIR, n);
    try {
      const raw = await fs.readFile(fp, "utf8");
      const j = JSON.parse(raw);
      metas.push({
        file: n,
        createdAt: j.createdAt || "",
        version: j.package?.version,
        shortSha: j.git?.shortSha,
        branch: j.git?.branch,
        note: j.note || "",
      });
    } catch {
      metas.push({ file: n, error: "invalid_json" });
    }
  }
  metas.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  if (!metas.length) {
    console.log("Checkpoint directory empty.");
    return;
  }
  console.log("Checkpoints (newest first):\n");
  for (const m of metas) {
    if (m.error) {
      console.log(`- ${m.file}  [${m.error}]`);
      continue;
    }
    console.log(`- ${m.file}`);
    console.log(`    ${m.createdAt}  v${m.version}  ${m.branch || "?"}@${m.shortSha || "?"}`);
    if (m.note) console.log(`    note: ${m.note}`);
  }
}

async function cmdRestoreHint(idOrFile) {
  if (!idOrFile) {
    console.log("Usage: node scripts/expert-dev-traceability.mjs restore-hint <checkpoint-id-or-filename>");
    return;
  }
  const base = idOrFile.endsWith(".json") ? idOrFile : `${idOrFile}.json`;
  let fp = path.join(CHECKPOINT_DIR, base);
  if (!existsSync(fp)) {
    fp = path.join(CHECKPOINT_DIR, `${idOrFile}`);
  }
  if (!existsSync(fp)) {
    console.error("Checkpoint not found:", idOrFile);
    process.exit(1);
  }
  const raw = await fs.readFile(fp, "utf8");
  const j = JSON.parse(raw);
  console.log("\n=== Restoration hints (manual) ===\n");
  console.log("1. Stash or commit current work if needed: git status");
  console.log(`2. Detached HEAD at recorded commit:\n   ${j.restore?.gitCheckout || "git checkout <sha-from-file>"}`);
  console.log("3. Or create a branch from that commit:\n   git switch -c recover/<name> <sha>");
  console.log("4. Re-run local gate after checkout:\n   npm run gate:local:full");
  console.log("5. Prod verification (no code restore):\n   npm run smoke:prod");
  console.log("\nRecorded:", j.createdAt, j.package?.version, j.git?.branch, j.git?.shortSha);
  console.log("");
}

function cmdWorkflow() {
  console.log(`
=== Calculadora BMC — expert workflow (local → prod) ===

Workspace:     npm run workspace:start
Local stack:   npm run dev:full  or  ./run_full_stack.sh
  API         http://localhost:3001/health
  Vite        http://localhost:5173
Quality:       npm run gate:local  |  npm run gate:local:full
Pre-deploy:    npm run pre-deploy  (API en :3001 o BMC_API_BASE)
Prod app:      ${PROD_APP}
Smoke prod:    npm run smoke:prod
Traceability:  npm run expert:checkpoint -- --message="antes de X"
               npm run expert:checkpoints
Chain (opt):   npm run development:chain  |  npm run development:chain:full

Checkpoints live in: .cursor/dev-checkpoints/ (gitignored)
Doc: docs/team/orientation/EXPERT-DEV-TRACEABILITY.md
`);
}

async function main() {
  const { cmd, message } = parseArgs(process.argv);
  if (cmd === "snapshot" || cmd === "checkpoint") {
    await cmdSnapshot(message);
    return;
  }
  if (cmd === "list" || cmd === "ls") {
    await cmdList();
    return;
  }
  if (cmd === "restore-hint" || cmd === "hint") {
    await cmdRestoreHint(process.argv[3] || "");
    return;
  }
  if (cmd === "workflow" || cmd === "help" || cmd === "--help") {
    cmdWorkflow();
    return;
  }
  console.error("Unknown command:", cmd);
  console.error("Use: snapshot | list | restore-hint <id> | workflow");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
