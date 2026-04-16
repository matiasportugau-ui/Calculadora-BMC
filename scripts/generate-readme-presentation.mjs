#!/usr/bin/env node
/**
 * Genera README.md desde docs/readme/README.template.md y actualiza
 * public/presentation-data.json para la presentación Matrix (Vite public/).
 *
 * Uso:
 *   node scripts/generate-readme-presentation.mjs
 *   node scripts/generate-readme-presentation.mjs --check     # falla si README difiere
 *   node scripts/generate-readme-presentation.mjs --skip-tests
 *   node scripts/generate-readme-presentation.mjs --readme-only
 *   node scripts/generate-readme-presentation.mjs --presentation-only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "docs/readme/README.template.md");
const README_OUT = path.join(ROOT, "README.md");
const PRESENTATION_JSON = path.join(ROOT, "public/presentation-data.json");

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    skipTests: argv.includes("--skip-tests"),
    readmeOnly: argv.includes("--readme-only"),
    presentationOnly: argv.includes("--presentation-only"),
  };
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function majorFromRange(ver) {
  if (!ver || typeof ver !== "string") return "?";
  const m = ver.replace(/^[\^~]/, "").match(/^(\d+)/);
  return m ? m[1] : "?";
}

function execGit(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function runTestFile(relPath) {
  const r = spawnSync(process.execPath, [path.join(ROOT, relPath)], {
    encoding: "utf8",
    cwd: ROOT,
    env: process.env,
  });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  return { code: r.status ?? 1, out };
}

function parseValidationSummary(out) {
  const m = out.match(/RESULTADOS:\s*(\d+)\s+passed,\s*(\d+)\s+failed,\s*(\d+)\s+total/i);
  if (!m) return { passed: null, failed: null, total: null };
  return { passed: Number(m[1]), failed: Number(m[2]), total: Number(m[3]) };
}

function parseRoofSummary(out) {
  const m = out.match(/roofVisualQuoteConsistency:\s*(\d+)\s+ok/i);
  if (!m) return { ok: null };
  return { ok: Number(m[1]) };
}

function buildBadges(pkg) {
  const react = majorFromRange(pkg.dependencies?.react);
  const vite = majorFromRange(pkg.devDependencies?.vite);
  const express = majorFromRange(pkg.dependencies?.express);
  const nodeMajor = pkg.engines?.node ? String(pkg.engines.node).replace(/[^0-9].*$/, "") || "20" : "20";
  return [
    `[![CI](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml/badge.svg)](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/workflows/ci.yml)`,
    `![React](https://img.shields.io/badge/React-${react}-61DAFB?logo=react&logoColor=white)`,
    `![Vite](https://img.shields.io/badge/Vite-${vite}-646CFF?logo=vite&logoColor=white)`,
    `![Express](https://img.shields.io/badge/Express-${express}-000000?logo=express&logoColor=white)`,
    `![Node](https://img.shields.io/badge/Node-${nodeMajor}-339933?logo=node.js&logoColor=white)`,
    `![License](https://img.shields.io/badge/license-UNLICENSED-red)`,
  ].join("\n");
}

function readCalculatorVersion() {
  const p = path.join(ROOT, "src/data/calculatorDataVersion.js");
  const s = fs.readFileSync(p, "utf8");
  const hash = (s.match(/CALCULATOR_DATA_VERSION\s*=\s*"([^"]+)"/) || [])[1] || "";
  const d = (s.match(/CALCULATOR_DATA_VERSION_DATE\s*=\s*"([^"]+)"/) || [])[1] || "";
  return { hash, date: d };
}

function replaceAll(template, map) {
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v ?? "");
  }
  if (out.includes("{{")) {
    const left = [...out.matchAll(/\{\{([^}]+)\}\}/g)].map((x) => x[1]);
    if (left.length) {
      console.warn("[readme:generate] Placeholders sin reemplazar:", [...new Set(left)].join(", "));
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(TEMPLATE)) {
    console.error("[readme:generate] Falta template:", TEMPLATE);
    process.exit(1);
  }

  const pkg = readJsonSafe(path.join(ROOT, "package.json"));
  const pkgVersion = pkg.version || "0.0.0";
  const badges = buildBadges(pkg);

  const gitShort = execGit("rev-parse --short HEAD");
  const gitBranch = execGit("rev-parse --abbrev-ref HEAD");
  const generatedAt = new Date().toISOString();

  const calc = readCalculatorVersion();

  let validation = { passed: null, failed: null, total: null };
  let roof = { ok: null };
  let testNote = "";

  if (!args.skipTests) {
    const v = runTestFile("tests/validation.js");
    validation = parseValidationSummary(v.out);
    if (v.code !== 0) {
      console.error("[readme:generate] tests/validation.js falló — usa --skip-tests para omitir.");
      process.exit(1);
    }
    const r = runTestFile("tests/roofVisualQuoteConsistency.js");
    roof = parseRoofSummary(r.out);
    if (r.code !== 0) {
      console.error("[readme:generate] tests/roofVisualQuoteConsistency.js falló.");
      process.exit(1);
    }
    const totalChecks =
      (validation.passed != null ? validation.passed : 0) + (roof.ok != null ? roof.ok : 0);
    testNote = `Suite offline: \`validation.js\` **${validation.passed ?? "?"}** passed + \`roofVisualQuoteConsistency.js\` **${roof.ok ?? "?"}** ok → **${totalChecks}** checks`;
  } else {
    testNote = "Tests omitidos (\`--skip-tests\`) — ejecutá \`npm test\` antes de commitear.";
  }

  const testCell = testNote;

  const utcDate = generatedAt.slice(0, 10);
  const autoMetadata = [
    `<!-- AUTO-GENERATED-BLOCK: scripts/generate-readme-presentation.mjs -->`,
    ``,
    `## Estado del repo (auto)`,
    ``,
    `| Campo | Valor |`,
    `|-------|-------|`,
    `| **Fecha generación (UTC)** | \`${utcDate}\` · timestamp ISO en \`public/presentation-data.json\` |`,
    `| **package.json** | \`${pkgVersion}\` |`,
    `| **Git** | \`${gitShort || "n/a"}\` · \`${gitBranch || "n/a"}\` |`,
    `| **CALCULATOR_DATA_VERSION** | \`${calc.hash || "n/a"}\` |`,
    `| **Tests** | ${validation.passed != null ? `\`${validation.passed}\` passed (\`validation.js\`) + \`${roof.ok ?? "?"}\` ok (\`roofVisualQuoteConsistency.js\`)` : "omitidos"} |`,
    `| **Presentación Matrix** | [Local :5173](http://localhost:5173/matrix-presentation.html) · [Vercel](https://calculadora-bmc.vercel.app/matrix-presentation.html) |`,
    ``,
    `**Regenerar:** \`npm run readme:sync\` · solo README/JSON: \`npm run readme:generate\` · comprobar: \`npm run readme:check\`.`,
    ``,
  ].join("\n");

  const presentation = {
    schema: "bmc-presentation-data@1",
    generatedAt,
    packageVersion: pkgVersion,
    name: pkg.name,
    description: pkg.description,
    git: { short: gitShort || null, branch: gitBranch || null },
    calculatorData: calc,
    tests: {
      validationPassed: validation.passed,
      roofVisualOk: roof.ok,
      skipped: args.skipTests,
    },
    stack: {
      react: majorFromRange(pkg.dependencies?.react),
      vite: majorFromRange(pkg.devDependencies?.vite),
      express: majorFromRange(pkg.dependencies?.express),
    },
    links: {
      matrixLocal: "http://localhost:5173/matrix-presentation.html",
      matrixProd: "https://calculadora-bmc.vercel.app/matrix-presentation.html",
      vercelApp: "https://calculadora-bmc.vercel.app",
      repo: "https://github.com/matiasportugau-ui/Calculadora-BMC",
    },
    matrixLines: [
      "PANELIN CALCULADORA BMC — METALOG SAS",
      "WAKE UP — THE MATRIZ HAS YOU — UPDATE README: npm run readme:sync",
      "THERE IS NO SPOON — ONLY p() AND Math.ceil()",
      "FOLLOW THE WHITE RABBIT — docs/team/PROJECT-STATE.md",
      "LOADING SHEETS — REALITY IS A CONFIG OBJECT",
      "KANSAS IS GOING BYE-BYE — SHIP TO VERCEL + CLOUD RUN",
    ],
  };

  let readmeOut = "";
  if (!args.presentationOnly) {
    const template = fs.readFileSync(TEMPLATE, "utf8");
    readmeOut = replaceAll(template, {
      PKG_VERSION: pkgVersion,
      BADGES: badges,
      AUTO_METADATA: autoMetadata,
      TEST_CELL: testCell,
    });

    if (args.check) {
      const current = fs.existsSync(README_OUT) ? fs.readFileSync(README_OUT, "utf8") : "";
      if (current !== readmeOut) {
        console.error("[readme:check] README.md no coincide con el template generado. Ejecutá: npm run readme:generate");
        process.exit(1);
      }
      console.log("[readme:check] OK");
      process.exit(0);
    }

    fs.writeFileSync(README_OUT, readmeOut, "utf8");
    console.log("[readme:generate] Escrito", path.relative(ROOT, README_OUT));
  }

  if (!args.readmeOnly) {
    fs.mkdirSync(path.dirname(PRESENTATION_JSON), { recursive: true });
    fs.writeFileSync(PRESENTATION_JSON, JSON.stringify(presentation, null, 2), "utf8");
    console.log("[readme:generate] Escrito", path.relative(ROOT, PRESENTATION_JSON));
  }

  process.exit(0);
}

main();
