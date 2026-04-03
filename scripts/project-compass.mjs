#!/usr/bin/env node
/**
 * Panel único de seguimiento: programa maestro + follow-ups vencidos.
 * Uso: npm run project:compass
 *      npm run project:compass -- --json
 *
 * Fuentes: docs/team/orientation/programs/bmc-panelin-master.json
 *          .followup/store.json (o FOLLOWUP_STORE_PATH)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgramSnapshot, loadProgram } from "./program-status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const followupCli = path.join(__dirname, "followup.mjs");
const programStatusCli = path.join(__dirname, "program-status.mjs");
const knowledgeDir = path.join(__dirname, "..", "docs", "team", "knowledge");

function readKnowledgeAntennaStatus() {
  const refsFile = path.join(knowledgeDir, "references-catalog.json");
  const impactFile = path.join(knowledgeDir, "impact-map.json");
  const reportsDir = path.join(knowledgeDir, "reports");
  try {
    const refs = JSON.parse(fs.readFileSync(refsFile, "utf8"));
    const impact = JSON.parse(fs.readFileSync(impactFile, "utf8"));
    const reportFiles = fs.existsSync(reportsDir)
      ? fs
          .readdirSync(reportsDir)
          .filter((name) => name.startsWith("KNOWLEDGE-REPORT-") && name.endsWith(".md"))
          .sort()
      : [];
    return {
      ok: true,
      references: Array.isArray(refs.references) ? refs.references.length : 0,
      impactMappings: Array.isArray(impact.mappings) ? impact.mappings.length : 0,
      lastKnowledgeReport: reportFiles.length ? reportFiles[reportFiles.length - 1] : null,
      updatedAt: refs.updatedAt || impact.updatedAt || null,
    };
  } catch {
    return {
      ok: false,
      references: 0,
      impactMappings: 0,
      lastKnowledgeReport: null,
      updatedAt: null,
    };
  }
}

function runFollowupDueJson() {
  try {
    const out = execSync(`node "${followupCli}" due --json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), items: [] };
  }
}

function main() {
  const jsonMode = process.argv.includes("--json");

  const program = loadProgram();
  const snap = buildProgramSnapshot(program);
  const follow = runFollowupDueJson();
  const knowledge = readKnowledgeAntennaStatus();

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          program: snap,
          followups: follow,
          knowledgeAntenna: knowledge,
        },
        null,
        2
      )
    );
    return;
  }

  execSync(`node "${programStatusCli}"`, { stdio: "inherit" });

  console.log("");
  console.log("─".repeat(64));
  console.log("FOLLOW-UPS (vencidos / hoy)");
  console.log("─".repeat(64));
  try {
    execSync(`node "${followupCli}" due`, { stdio: "inherit" });
  } catch {
    // followup may print to stderr; still show hint
  }

  console.log("");
  console.log("─".repeat(64));
  console.log("RUTINA MÍNIMA (≈5 min)");
  console.log("─".repeat(64));
  console.log("  1. Elegir 1 tarea de «PRÓXIMOS PASOS» arriba y cerrar o avanzar.");
  console.log("  2. Si hay follow-ups: procesar o posponer (`npm run followup -- snooze <id> --days N`).");
  console.log("  3. Actualizar JSON maestro al cerrar tareas: docs/team/orientation/programs/bmc-panelin-master.json");
  console.log("  4. Resumen breve en docs/team/SESSION-WORKSPACE-CRM.md §2 si hubo avance.");
  console.log("");
  console.log("─".repeat(64));
  console.log("RESEARCH ANTENNA STATUS");
  console.log("─".repeat(64));
  if (!knowledge.ok) {
    console.log("No data yet. Run: npm run knowledge:run");
  } else {
    console.log(`Referencias guardadas: ${knowledge.references}`);
    console.log(`Impact mappings: ${knowledge.impactMappings}`);
    console.log(`Último reporte: ${knowledge.lastKnowledgeReport || "N/A"}`);
    console.log(`Actualizado: ${knowledge.updatedAt || "N/A"}`);
  }
  console.log("");
  console.log("Documento único de cronograma + enlaces: docs/team/PROJECT-SCHEDULE.md");
  console.log("");
}

main();
