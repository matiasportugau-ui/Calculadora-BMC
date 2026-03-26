#!/usr/bin/env node
/**
 * Lee el programa maestro JSON y muestra fase actual, progreso aproximado y próximas tareas.
 * Uso: npm run program:status
 *      node scripts/program-status.mjs --json
 *      PROGRAM_JSON=path/to/other.json node scripts/program-status.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = path.join(
  __dirname,
  "../docs/team/orientation/programs/bmc-panelin-master.json"
);

export function loadProgram() {
  const p = process.env.PROGRAM_JSON || DEFAULT_JSON;
  const raw = fs.readFileSync(path.resolve(p), "utf8");
  return JSON.parse(raw);
}

function collectTasks(program) {
  const all = [];
  for (const stream of program.streams || []) {
    for (const t of stream.tasks || []) {
      all.push({
        ...t,
        streamId: stream.id,
        streamName: stream.name,
      });
    }
  }
  return all;
}

function buildNextTasks(tasks, limit = 7) {
  return tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const order = { doing: 0, todo: 1, blocked: 2 };
      const ao = order[a.status] ?? 3;
      const bo = order[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      return (a.estHours || 99) - (b.estHours || 99);
    })
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      streamId: t.streamId,
      streamName: t.streamName,
      estHours: t.estHours ?? null,
      dependsOn: t.dependsOn || [],
    }));
}

function sumEstHours(taskList, predicate) {
  return taskList.filter(predicate).reduce((s, t) => s + (Number(t.estHours) > 0 ? Number(t.estHours) : 0), 0);
}

/** Snapshot for --json / project:compass / agents */
export function buildProgramSnapshot(program) {
  const tasks = collectTasks(program);
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const totalHours = sumEstHours(tasks, () => true);
  const doneHours = sumEstHours(tasks, (t) => t.status === "done");
  const pctWeighted = totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : pct;
  const phases = [...(program.phases || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const current = phases.find((p) => p.id === program.currentPhaseId);
  return {
    ok: true,
    programId: program.programId,
    title: program.title,
    updatedAt: program.updatedAt,
    currentPhaseId: program.currentPhaseId,
    currentPhase: current
      ? {
          id: current.id,
          name: current.name,
          status: current.status,
          summary: current.summary,
          exitCriteria: current.exitCriteria || [],
        }
      : null,
    phases: phases.map((ph) => ({
      id: ph.id,
      name: ph.name,
      status: ph.status,
      order: ph.order,
    })),
    progress: {
      done,
      total,
      pct,
      doneHours,
      totalHours,
      pctWeighted,
    },
    nextTasks: buildNextTasks(tasks, 7),
    convergencePoints: program.convergencePoints || [],
  };
}

function main() {
  const jsonMode = process.argv.includes("--json");
  const program = loadProgram();
  const tasks = collectTasks(program);
  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const totalHours = sumEstHours(tasks, () => true);
  const doneHours = sumEstHours(tasks, (t) => t.status === "done");
  const pctW = totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : pct;

  if (jsonMode) {
    const snap = buildProgramSnapshot(program);
    console.log(JSON.stringify(snap, null, 2));
    return;
  }

  const phases = [...(program.phases || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  const current = phases.find((p) => p.id === program.currentPhaseId);

  console.log("");
  console.log("═".repeat(64));
  console.log(`  ${program.title}`);
  console.log(`  Actualizado: ${program.updatedAt || "-"} · Horizonte ~${program.horizonWeeks || "?"} sem`);
  console.log("═".repeat(64));
  console.log("");

  console.log("ALTURA (fases)");
  for (const ph of phases) {
    const mark =
      ph.id === program.currentPhaseId
        ? ">>>"
        : "   ";
    const st = (ph.status || "").toUpperCase();
    const w = ph.estWeeks || "?";
    console.log(`${mark} ${ph.id}  [${st}]  ${ph.name}  (~${w} sem)`);
  }
  if (current) {
    console.log("");
    console.log(`Fase actual: ${current.name}`);
    if (current.summary) console.log(`  ${current.summary}`);
    if (current.exitCriteria?.length) {
      console.log("  Criterios de salida:");
      for (const c of current.exitCriteria) console.log(`    - ${c}`);
    }
  }

  console.log("");
  console.log("PROGRESO (tareas en todos los streams)");
  console.log(`  ${done} / ${total} hechas  →  ~${pct}% por cantidad de tareas`);
  console.log(
    `  ${doneHours}h / ${totalHours}h estimadas  →  ~${pctW}% por esfuerzo (estHours)`,
  );
  console.log("");

  for (const stream of program.streams || []) {
    const ts = stream.tasks || [];
    const d = ts.filter((t) => t.status === "done").length;
    console.log(`Stream · ${stream.name}  (${d}/${ts.length})`);
    for (const t of ts) {
      const st = (t.status || "todo").padEnd(7, " ");
      const h = t.estHours != null ? `~${t.estHours}h` : "";
      console.log(`  [${st}] ${t.title} ${h}`);
    }
    console.log("");
  }

  const next = tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const order = { doing: 0, todo: 1, blocked: 2 };
      const ao = order[a.status] ?? 3;
      const bo = order[b.status] ?? 3;
      if (ao !== bo) return ao - bo;
      return (a.estHours || 99) - (b.estHours || 99);
    })
    .slice(0, 7);

  console.log("PRÓXIMOS PASOS SUGERIDOS (prioridad simple: doing → menor estHours)");
  let i = 1;
  for (const t of next) {
    const dep = t.dependsOn?.length ? `  deps: ${t.dependsOn.join(", ")}` : "";
    console.log(`  ${i}. [${t.streamName}] ${t.title}${dep}`);
    i++;
  }

  if (program.convergencePoints?.length) {
    console.log("");
    console.log("PUNTOS DE CONVERGENCIA");
    for (const cp of program.convergencePoints) {
      console.log(`  · ${cp.name}`);
      if (cp.refs?.length) console.log(`      ${cp.refs.join(" | ")}`);
    }
  }

  console.log("");
  console.log("═".repeat(64));
  console.log("Editá el JSON para actualizar: docs/team/orientation/programs/bmc-panelin-master.json");
  console.log("");
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (invokedDirectly) main();
