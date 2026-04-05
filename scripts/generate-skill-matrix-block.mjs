#!/usr/bin/env node
/**
 * Reads each skill folder SKILL.md frontmatter and builds the "Skills developed in full"
 * block for docs/team/AGENT-PRESENTATION-MATRIX.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const skillsRoot = path.join(repoRoot, ".cursor", "skills");

const wrap = (text, width) => {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= width) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const block = raw.slice(4, end);
  const lines = block.split("\n");
  /** @type {Record<string, string>} */
  const out = {};
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    const v = buf.join(" ").replace(/\s+/g, " ").trim();
    out[key] = v;
    key = null;
    buf = [];
  };
  for (const line of lines) {
    const m = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (m && !line.startsWith(" ")) {
      flush();
      key = m[1];
      const rest = m[2];
      if (rest === ">" || rest === "|") {
        buf = [];
        continue;
      }
      buf = [rest];
      continue;
    }
    if (key && /^\s+/.test(line)) {
      buf.push(line.trim());
      continue;
    }
    if (key) flush();
  }
  flush();
  return out;
}

const WIDTH = 86;

/** @returns {string[]} skill folder names sorted */
export function listSkillIds() {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Full monospace block (no outer markers). */
export function buildSkillMatrixDevelopedInFullBlock() {
  const dirs = listSkillIds();
  const chunks = [];
  chunks.push("");
  chunks.push("┌──────────────────────────────────────────────────────────────────────────────────────────┐");
  chunks.push("│  S K I L L S   D E V E L O P E D   I N   F U L L   ( 5 1   ×   S K I L L . m d )          │");
  chunks.push("└──────────────────────────────────────────────────────────────────────────────────────────┘");
  chunks.push("");
  chunks.push("  Source: .cursor/skills/<id>/SKILL.md  —  text below = YAML description (folded) + name");
  chunks.push("");

  for (const id of dirs) {
    const p = path.join(skillsRoot, id, "SKILL.md");
    if (!fs.existsSync(p)) continue;
    const raw = fs.readFileSync(p, "utf8");
    const fm = parseFrontmatter(raw);
    const name = fm?.name || id;
    let desc = (fm?.description || "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .trim();
    if (!desc) desc = "(no description field in frontmatter)";
    chunks.push(`  -- ${name} --`);
    for (const line of wrap(desc, WIDTH)) {
      chunks.push(`  ${line}`);
    }
    chunks.push("");
  }

  return chunks.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  process.stdout.write(buildSkillMatrixDevelopedInFullBlock());
}
