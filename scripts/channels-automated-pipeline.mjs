#!/usr/bin/env node
/**
 * Capa 100% máquina: en paralelo — smoke prod + follow-ups locales;
 * luego snapshot del programa maestro (JSON) y “human gates” derivados (cm-0/1/2).
 *
 * No abre navegador, no envía WhatsApp, no hace OAuth. Sirve para CI, agentes y cron.
 *
 * Uso:
 *   npm run channels:automated
 *   npm run channels:automated -- --write   # escribe .channels/last-pipeline.json
 *
 * Exit 1 si el smoke falla (misma lógica que smoke-prod-api.mjs --json), incl. GET MATRIZ CSV.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgramSnapshot, loadProgram } from "./program-status.mjs";
import { loadStore, listDueItems, sortByFollowUp } from "../server/lib/followUpStore.js";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const CHANNEL_TASK_IDS = ["cm-0", "cm-1", "cm-2"];

async function runSmokeJson() {
  const t0 = Date.now();
  const script = path.join(ROOT, "scripts/smoke-prod-api.mjs");
  const { stdout } = await execFileP(process.execPath, [script, "--json"], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  const ms = Date.now() - t0;
  const data = JSON.parse(stdout.trim());
  return { ms, data };
}

function runFollowupsJson() {
  const t0 = Date.now();
  const st = loadStore();
  const open = st.items.filter((i) => i.status === "open");
  const due = sortByFollowUp(listDueItems(open));
  const ms = Date.now() - t0;
  return {
    ms,
    data: {
      ok: true,
      count: due.length,
      items: due.slice(0, 15).map((i) => ({
        id: i.id,
        title: i.title,
        nextFollowUpAt: i.nextFollowUpAt || null,
        tags: i.tags || [],
      })),
    },
  };
}

function collectChannelTasks(program) {
  const out = [];
  for (const s of program.streams || []) {
    for (const t of s.tasks || []) {
      if (CHANNEL_TASK_IDS.includes(t.id)) {
        out.push({
          id: t.id,
          title: t.title,
          status: t.status || "todo",
          streamName: s.name,
        });
      }
    }
  }
  const order = { "cm-0": 1, "cm-1": 2, "cm-2": 3 };
  return out.sort((a, b) => (order[a.id] || 99) - (order[b.id] || 99));
}

/** Primera tarea de canal no cerrada en orden WA → ML → Correo. */
function firstBlockingChannelTask(tasks) {
  for (const t of tasks) {
    if (t.status !== "done" && t.status !== "cancelled") return t;
  }
  return null;
}

function humanGateHints(firstBlock) {
  if (!firstBlock) {
    return {
      phase: "none",
      messageEs:
        "Tareas cm-0 / cm-1 / cm-2 cerradas en el JSON maestro; revisar manualmente si el negocio coincide.",
    };
  }
  const map = {
    "cm-0": {
      phase: "whatsapp",
      messageEs:
        "Intervención humana: Meta (webhook/token), teléfono de prueba, fila en planilla. Ver docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md Fase 1 y WHATSAPP-META-E2E.md si está en el repo.",
    },
    "cm-1": {
      phase: "mercadolibre",
      messageEs:
        "Intervención: OAuth ML en navegador, tokens en prod; npm run ml:verify. Ver docs/ML-OAUTH-SETUP.md.",
    },
    "cm-2": {
      phase: "correo",
      messageEs:
        "Intervención: sync IMAP (panelsim:email-ready), luego npm run email:ingest-snapshot -- --dry-run.",
    },
  };
  return map[firstBlock.id] || { phase: "unknown", messageEs: "Revisar tarea en programa maestro." };
}

async function main() {
  const argv = process.argv.slice(2);
  const write = argv.includes("--write");

  let smokeR;
  let fuR;
  try {
    [smokeR, fuR] = await Promise.all([runSmokeJson(), Promise.resolve(runFollowupsJson())]);
  } catch (e) {
    const err = {
      ok: false,
      generatedAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : String(e),
    };
    console.log(JSON.stringify(err, null, 2));
    process.exit(1);
    return;
  }

  const program = loadProgram();
  const tProg0 = Date.now();
  const progSnap = buildProgramSnapshot(program);
  const programMs = Date.now() - tProg0;

  const channelTasks = collectChannelTasks(program);
  const firstBlock = firstBlockingChannelTask(channelTasks);

  const out = {
    ok: smokeR.data?.ok === true,
    generatedAt: new Date().toISOString(),
    parallel: {
      smokeMs: smokeR.ms,
      followupsMs: fuR.ms,
      programMs,
      note: "smoke y follow-ups corrieron en paralelo; programa leído después (disco).",
    },
    smoke: smokeR.data,
    followups: fuR.data,
    program: progSnap,
    channelTasks,
    humanGate: {
      firstBlockingTask: firstBlock,
      hint: humanGateHints(firstBlock),
    },
    docs: {
      procedure: "docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md",
    },
  };

  if (write) {
    const dir = path.join(ROOT, ".channels");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "last-pipeline.json"), JSON.stringify(out, null, 2), "utf8");
  }

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }, null, 2));
  process.exit(1);
});
