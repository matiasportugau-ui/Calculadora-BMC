/**
 * Native L3 implementer — draft branch + PR body from EvolutionPacket (IMP-PEA-12).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "fs/promises";
import path from "path";
import { buildImplementGoalPrompt } from "./manualAdapter.js";

const execFileAsync = promisify(execFile);

/**
 * @param {string} repoRoot
 * @param {string[]} args
 */
async function git(repoRoot, args) {
  const { stdout } = await execFileAsync("git", args, { cwd: repoRoot });
  return stdout.trim();
}

/**
 * @param {object} ctx
 */
export async function runNativeImplementer(ctx) {
  const { packet, gap, repoRoot = process.cwd() } = ctx;
  const fp = (gap?.fingerprint || packet?.id || "gap").slice(0, 12);
  const branch = `pea/${fp}`;

  try {
    await git(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return {
      ok: false,
      adapter: "native",
      error: "not_a_git_repo",
      fallback: "use manual adapter",
    };
  }

  const content = buildImplementGoalPrompt(packet, gap);
  const artifactName = `goal-prompt-pea-implement-${fp}.md`;
  const artifactPath = path.join(repoRoot, artifactName);
  await fs.writeFile(artifactPath, content, "utf8");

  let branchCreated = false;
  try {
    const current = await git(repoRoot, ["branch", "--show-current"]);
    if (current !== branch) {
      try {
        await git(repoRoot, ["checkout", branch]);
      } catch {
        await git(repoRoot, ["checkout", "-b", branch]);
        branchCreated = true;
      }
    }
    await git(repoRoot, ["add", artifactName]);
    const status = await git(repoRoot, ["status", "--porcelain"]);
    if (status.includes(artifactName)) {
      await git(repoRoot, ["commit", "-m", `feat(pea): L3 implement artifact for gap ${fp}`]);
    }
  } catch (e) {
    return {
      ok: false,
      adapter: "native",
      error: e.message,
      artifact_path: artifactPath,
    };
  }

  const prBody =
    `## PEA L3 Implement\n\n` +
    `Packet: \`${packet?.id}\`\nGap: \`${gap?.id}\`\nLane: **${packet?.primary_lane}**\n\n` +
    `Artifact: \`${artifactName}\`\n\n` +
    `Run gate:local before merge. Ratchet link required on Accept (M2c).`;

  return {
    ok: true,
    adapter: "native",
    branch,
    branch_created: branchCreated,
    artifact_path: artifactPath,
    pr_draft: {
      title: `pea: implement gap ${fp}`,
      body: prBody,
      head: branch,
      base: "main",
    },
    implement_still_manual: false,
    note: "Push branch and open PR via gh pr create (human gate L5)",
  };
}
