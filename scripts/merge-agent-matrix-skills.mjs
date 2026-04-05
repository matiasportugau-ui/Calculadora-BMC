#!/usr/bin/env node
/**
 * Regenerates the "Skills developed in full" section inside
 * docs/team/AGENT-PRESENTATION-MATRIX.txt (between BMC_MATRIX_SKILLS_FULL_* markers).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkillMatrixDevelopedInFullBlock } from "./generate-skill-matrix-block.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const matrixPath = path.join(repoRoot, "docs", "team", "AGENT-PRESENTATION-MATRIX.txt");

const re =
  /([\s\S]*)(:: BMC_MATRIX_SKILLS_FULL_BEGIN ::[^\n]*\n)[\s\S]*?(\n  :: BMC_MATRIX_SKILLS_FULL_END ::\n)([\s\S]*)/;

const text = fs.readFileSync(matrixPath, "utf8");
const m = text.match(re);
if (!m) {
  console.error("merge-agent-matrix-skills: markers not found in AGENT-PRESENTATION-MATRIX.txt");
  process.exit(1);
}

const body = buildSkillMatrixDevelopedInFullBlock();
const out = m[1] + m[2] + body + m[3] + m[4];
fs.writeFileSync(matrixPath, out, "utf8");
console.log("updated", path.relative(repoRoot, matrixPath));
