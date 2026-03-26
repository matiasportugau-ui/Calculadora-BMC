#!/usr/bin/env node
/**
 * Lee snapshot IMAP (repo hermano) y envía mensajes elegibles a POST /api/crm/ingest-email.
 *
 * Requisitos: API corriendo (local o Cloud Run) con keys de IA + Sheets para ingest completo.
 *
 * Uso:
 *   npm run email:ingest-snapshot -- --dry-run
 *   npm run start:api   # otra terminal
 *   npm run email:ingest-snapshot -- --limit 3
 *
 * Variables:
 *   BMC_API_BASE (default http://localhost:3001)
 *   BMC_EMAIL_SNAPSHOT_PATH — ruta absoluta a snapshot-latest.json
 *
 * Dedupe: .email-ingest/processed-ids.json (gitignored)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  messageToIngestBody,
  selectMessagesForIngest,
  stableMessageKey,
} from "../server/lib/emailSnapshotIngest.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: 25,
    category: "ventas",
    allCategories: false,
    file: null,
    since: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--all-categories") out.allCategories = true;
    else if (a === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a === "--file" && argv[i + 1]) out.file = argv[++i];
    else if (a === "--since" && argv[i + 1]) out.since = new Date(argv[++i]);
    else if (a === "--category" && argv[i + 1]) out.category = argv[++i];
  }
  return out;
}

function resolveSnapshotPath(fileOpt) {
  if (fileOpt) return path.resolve(fileOpt);
  if (process.env.BMC_EMAIL_SNAPSHOT_PATH) return path.resolve(process.env.BMC_EMAIL_SNAPSHOT_PATH);
  const sibling = path.join(path.dirname(ROOT), "conexion-cuentas-email-agentes-bmc", "data", "snapshot-latest.json");
  return sibling;
}

const PROCESSED_FILE = path.join(ROOT, ".email-ingest", "processed-ids.json");

function loadProcessed() {
  try {
    const raw = fs.readFileSync(PROCESSED_FILE, "utf8");
    const j = JSON.parse(raw);
    return new Set(Array.isArray(j.ids) ? j.ids : []);
  } catch {
    return new Set();
  }
}

function saveProcessed(set) {
  fs.mkdirSync(path.dirname(PROCESSED_FILE), { recursive: true });
  fs.writeFileSync(
    PROCESSED_FILE,
    JSON.stringify({ ids: [...set], updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

async function postIngest(base, body) {
  const url = `${base.replace(/\/$/, "")}/api/crm/ingest-email`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapPath = resolveSnapshotPath(args.file);
  if (!fs.existsSync(snapPath)) {
    console.error(`No se encontró el snapshot: ${snapPath}`);
    console.error("Definí BMC_EMAIL_SNAPSHOT_PATH o --file /ruta/snapshot-latest.json");
    process.exit(1);
  }

  const base = process.env.BMC_API_BASE || "http://localhost:3001";
  const raw = fs.readFileSync(snapPath, "utf8");
  const snapshot = JSON.parse(raw);

  const processed = loadProcessed();
  const cat = args.allCategories ? null : args.category;
  const selected = selectMessagesForIngest(snapshot, {
    category: cat,
    limit: args.limit,
    since: args.since && !Number.isNaN(args.since.getTime()) ? args.since : null,
    processed,
  });

  console.log("");
  console.log(`Snapshot: ${snapPath}`);
  console.log(`API:      ${base}`);
  console.log(`Filtro:   ${cat == null ? "todas las categorías (texto mínimo)" : `category=${cat}`}`);
  console.log(`Selección: ${selected.length} mensaje(s) (limit ${args.limit})`);
  console.log("");

  let ok = 0;
  let fail = 0;

  for (const msg of selected) {
    const body = messageToIngestBody(msg);
    const key = stableMessageKey(msg);
    if (args.dryRun) {
      console.log(`[dry-run] ${key.slice(0, 60)}…`);
      console.log(`  asunto: ${(body.asunto || "").slice(0, 80)}`);
      ok++;
      continue;
    }

    const r = await postIngest(base, body);
    if (r.status === 200 && r.data?.ok) {
      console.log(`✓ ${key.slice(0, 50)}…  crmRow=${r.data.crmRow ?? "?"}`);
      if (key) processed.add(key);
      ok++;
    } else {
      console.error(`✗ ${key.slice(0, 50)}…  HTTP ${r.status}`, r.data?.error || r.data);
      fail++;
    }
  }

  if (!args.dryRun && ok > 0) saveProcessed(processed);

  console.log("");
  console.log(`Listo: ${ok} ok, ${fail} fallos. Dedupe en .email-ingest/processed-ids.json`);
  console.log("");
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
