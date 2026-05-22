#!/usr/bin/env node
/**
 * Evals CLI — harness de alineación del motor + agentes contra cotizaciones
 * reales de la planilla Enviados.
 *
 * Subcomandos:
 *   discover                      Imprime headers + 4 filas de muestra de Enviados
 *                                 (para confirmar/ajustar evals/lib/enviadosSchema.js).
 *   ingest --rows N-M             Lee filas N..M de Enviados, las convierte a
 *                                 fixtures en evals/fixtures/. Skipea las ya existentes
 *                                 a menos que pases --force.
 *   ingest --from-date YYYY-MM-DD --to-date YYYY-MM-DD
 *                                 Misma idea pero filtrando por fecha.
 *   run <case-id> [<case-id>...]  Corre uno o varios casos por id (motor in-process).
 *   run --all                     Corre todos los fixtures presentes.
 *   batch --rows N-M [--resume]   Ingesta + corrida + reporte global de un rango.
 *                                 --resume: salta filas que ya tienen reporte exitoso.
 *
 * Outputs:
 *   evals/fixtures/<case-id>.json     ← fixture
 *   evals/runs/<timestamp>/           ← un dir por corrida con
 *      <case-id>.report.md
 *      <case-id>.generated.json
 *      run-report.md
 *      progress.json                  ← estado por caso (resumable)
 *      findings-candidates.json       ← findings sugeridos por KB-channel
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCase, listCases } from "./lib/loadCase.js";
import { runQuote } from "./lib/runQuote.js";
import { compareRun } from "./lib/compareGolden.js";
import { buildCaseReport, buildRunReport, writeReports } from "./lib/report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(__dirname, "runs");
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

function tsFolderName() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function parseRowRange(spec) {
  const m = String(spec || "").match(/^(\d+)-(\d+)$/);
  if (!m) throw new Error(`Rango inválido: "${spec}". Usar formato N-M (ej. 14-25)`);
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (to < from) throw new Error(`Rango inválido: from=${from} > to=${to}`);
  return { from, to };
}

function fixturePath(caseId) {
  return path.join(FIXTURES_DIR, `${caseId}.json`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// ── Subcomando: discover ───────────────────────────────────────────────

async function cmdDiscover() {
  const { discoverFromAny } = await import("./lib/enviadosFetcher.js");
  const { headers, sampleRows, sheetId, mode } = await discoverFromAny();
  console.log(`Sheet: ${sheetId} (mode: ${mode})`);
  console.log("\nHEADERS detectados:");
  for (const h of headers) {
    const mapStr = h.mapped ? ` → ${h.mapped}` : "  (no mapeado)";
    console.log(`  ${h.col.padEnd(3)} ${String(h.value || "—").slice(0, 60).padEnd(60)} ${mapStr}`);
  }
  console.log(`\nMUESTRA (${sampleRows.length} filas):`);
  for (const r of sampleRows) {
    console.log(
      `  fila ${r._rowNumber}: ${r.cliente || "—"} | ${r.fecha || "—"} | ${(r.consulta || "—").slice(0, 80)}`,
    );
  }
  console.log("\nSi el mapeo no coincide, ajustar SCHEMA en evals/lib/enviadosSchema.js.");
}

// ── Subcomando: ingest ─────────────────────────────────────────────────

async function cmdIngest(flags) {
  const { fetchRows } = await import("./lib/enviadosFetcher.js");
  const { rowToFixture } = await import("./lib/rowToFixture.js");
  let parsePdfGolden = null;
  if (flags["parse-pdfs"]) {
    parsePdfGolden = (await import("./lib/parsePdfGolden.js")).parsePdfGolden;
  }
  ensureDir(FIXTURES_DIR);

  let rows;
  let sheetId;
  if (flags.rows) {
    const { from, to } = parseRowRange(flags.rows);
    console.log(`▶ Leyendo filas ${from}..${to} de Enviados...`);
    const result = await fetchRows({ mode: "range", from, to });
    rows = result.rows;
    sheetId = result.sheetId;
  } else if (flags["from-date"] || flags["to-date"]) {
    console.log(`▶ Leyendo por fechas ${flags["from-date"] || "*"} .. ${flags["to-date"] || "*"} ...`);
    const result = await fetchRows({
      mode: "date-range",
      fromDate: flags["from-date"],
      toDate: flags["to-date"],
    });
    rows = result.rows;
    sheetId = result.sheetId;
  } else {
    console.error("Uso: ingest --rows N-M  |  ingest --from-date YYYY-MM-DD --to-date YYYY-MM-DD");
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  let pdfsParsed = 0;
  let pdfsFailed = 0;
  const created_ids = [];
  for (const row of rows) {
    if (!row.cliente && !row.consulta) {
      continue;
    }
    let pdfGolden = null;
    if (parsePdfGolden && row.link_pdf) {
      process.stdout.write(`  · parsing PDF ${row.link_pdf.slice(0, 60)}... `);
      pdfGolden = await parsePdfGolden(row.link_pdf);
      if (pdfGolden.status === "parsed") {
        pdfsParsed++;
        console.log(`OK (sin IVA: ${pdfGolden.total_sin_iva_usd ?? "?"}, con IVA: ${pdfGolden.total_con_iva_usd ?? "?"})`);
      } else {
        pdfsFailed++;
        console.log(`${pdfGolden.status}`);
      }
    }
    const fixture = rowToFixture(row, { sheetId, pdfGolden });
    const file = fixturePath(fixture.case_id);
    if (fs.existsSync(file) && !flags.force) {
      skipped++;
      console.log(`  · ${fixture.case_id} ya existe (--force para sobrescribir)`);
      continue;
    }
    writeJson(file, fixture);
    created++;
    created_ids.push(fixture.case_id);
    console.log(`  ✓ ${fixture.case_id} ← fila ${row._rowNumber}`);
  }
  console.log(`\nIngesta: ${created} creados, ${skipped} skipeados.`);
  if (parsePdfGolden) {
    console.log(`PDFs: ${pdfsParsed} parseados, ${pdfsFailed} fallaron.`);
  }
  return created_ids;
}

// ── Subcomando: run ────────────────────────────────────────────────────

async function runCases(ids, runDir) {
  ensureDir(runDir);
  const caseReports = [];
  for (const id of ids) {
    process.stdout.write(`▶ ${id} ... `);
    let caseData;
    try {
      caseData = loadCase(id);
    } catch (err) {
      console.error(`SKIP (${err.message})`);
      continue;
    }
    let runResult;
    try {
      runResult = runQuote(caseData);
    } catch (err) {
      console.error(`MOTOR FALLÓ (${err.message})`);
      continue;
    }
    const comparison = compareRun(runResult, caseData);
    const caseReportMd = buildCaseReport(caseData, runResult, comparison);
    writeReports({ runDir, caseData, runResult, comparison, caseReportMd });
    const status = inferStatus(runResult, comparison);
    console.log(status);
    caseReports.push({ caseData, runResult, comparison, status });
  }
  if (caseReports.length) {
    const runReportMd = buildRunReport(caseReports);
    fs.writeFileSync(path.join(runDir, "run-report.md"), runReportMd, "utf8");
    writeJson(path.join(runDir, "progress.json"), {
      ts: new Date().toISOString(),
      cases: caseReports.map((r) => ({ case_id: r.caseData.case_id, status: r.status })),
    });
    writeJson(path.join(runDir, "findings-candidates.json"), extractFindings(caseReports));
  }
  return caseReports;
}

function inferStatus(runResult, comparison) {
  if (runResult.opciones_resultados?.some((op) => op.result.error)) return "engine_error";
  const cmps = comparison?.perOpcion || [];
  if (cmps.length === 0) return "no_comparison";
  if (cmps.every((c) => c.status === "no_golden")) return "no_golden";
  if (cmps.every((c) => c.status === "match")) return "match";
  return "diff";
}

function extractFindings(caseReports) {
  const findings = [];
  for (const r of caseReports) {
    const id = r.caseData.case_id;
    if (r.caseData.nlu_baseline?.missing?.length) {
      findings.push({
        case_id: id,
        stage: "nlu",
        type: "nlu-miss",
        detail: `Campos faltantes en NLU heurística: ${r.caseData.nlu_baseline.missing.join(", ")}`,
        suggested_channel: "kb-or-prompt",
      });
    }
    for (const op of r.runResult.opciones_resultados || []) {
      if (op.input?.gaps_de_input?.length) {
        for (const g of op.input.gaps_de_input) {
          findings.push({
            case_id: id,
            stage: "assumptions",
            type: "assumption-missing",
            detail: g,
            suggested_channel: "kb-prompt-ask",
          });
        }
      }
      for (const w of op.result?.warnings || []) {
        findings.push({
          case_id: id,
          stage: "engine",
          type: "engine-warning",
          detail: w,
          suggested_channel: "review",
        });
      }
    }
  }
  return findings;
}

async function cmdRun(flags) {
  let ids = flags._;
  if (flags.all || ids.length === 0) {
    ids = listCases();
    if (!ids.length) {
      console.error("No hay fixtures en evals/fixtures/");
      process.exit(1);
    }
    if (!flags.all && flags._.length === 0) {
      console.error("Uso: run <case-id> [<case-id>...] | run --all");
      console.error(`Fixtures disponibles: ${ids.join(", ")}`);
      process.exit(1);
    }
  }
  const runDir = path.join(RUNS_DIR, tsFolderName());
  const caseReports = await runCases(ids, runDir);
  console.log(`\nRun report: ${path.relative(process.cwd(), path.join(runDir, "run-report.md"))}`);
  return caseReports;
}

// ── Subcomando: batch ──────────────────────────────────────────────────

async function cmdBatch(flags) {
  if (!flags.rows && !flags["from-date"]) {
    console.error("Uso: batch --rows N-M [--resume] | batch --from-date YYYY-MM-DD --to-date YYYY-MM-DD");
    process.exit(1);
  }
  const ingestFlags = { ...flags };
  if (flags.resume) ingestFlags.force = false;
  const created_ids = await cmdIngest(ingestFlags);

  let ids = created_ids;
  if (flags.resume) {
    const allCases = listCases();
    ids = allCases.filter((id) => {
      if (created_ids.includes(id)) return true;
      return !hasSuccessfulRun(id);
    });
  }
  if (!ids.length) {
    console.log("No hay casos para correr. Usá --force para re-ingestar o ajustá --rows.");
    return;
  }
  console.log(`\n▶ Corriendo ${ids.length} casos...\n`);
  const runDir = path.join(RUNS_DIR, tsFolderName());
  await runCases(ids, runDir);
  console.log(`\nRun report: ${path.relative(process.cwd(), path.join(runDir, "run-report.md"))}`);
}

function hasSuccessfulRun(caseId) {
  if (!fs.existsSync(RUNS_DIR)) return false;
  const subdirs = fs.readdirSync(RUNS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of subdirs) {
    const prog = readJsonIfExists(path.join(RUNS_DIR, d.name, "progress.json"));
    if (!prog) continue;
    const found = (prog.cases || []).find((c) => c.case_id === caseId);
    if (found && ["match", "diff", "no_golden"].includes(found.status)) return true;
  }
  return false;
}

// ── Entry point ────────────────────────────────────────────────────────

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const flags = parseFlags(rest);
  try {
    if (cmd === "discover") {
      await cmdDiscover();
    } else if (cmd === "ingest") {
      await cmdIngest(flags);
    } else if (cmd === "batch") {
      await cmdBatch(flags);
    } else if (cmd === "run" || !cmd) {
      await cmdRun(flags);
    } else if (cmd === "--help" || cmd === "-h") {
      const help = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
      console.log(help.split("\n").slice(2, 30).join("\n"));
    } else {
      flags._ = [cmd, ...flags._];
      await cmdRun(flags);
    }
  } catch (err) {
    console.error("Error:", err?.message || err);
    if (process.env.EVALS_DEBUG) console.error(err);
    process.exit(1);
  }
}

main();
