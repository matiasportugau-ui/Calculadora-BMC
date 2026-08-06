#!/usr/bin/env node
/**
 * Publish IAlfred recovery viz data.json to Hub Finanzas API.
 *
 * Usage:
 *   BMC_API_BASE=https://… BMC_TOKEN=… node scripts/publish-recovery-snapshot.mjs
 *   node scripts/publish-recovery-snapshot.mjs --file ~/.ialfred/ops/plan-recuperacion/viz/data.json
 *
 * Env:
 *   BMC_API_BASE   — API host (default VITE_API_BASE or http://127.0.0.1:3001)
 *   BMC_TOKEN      — Bearer access token (admin+)
 *   RECOVERY_SNAPSHOT_PATH — override default data.json path
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const fileArg = fileIdx >= 0 ? args[fileIdx + 1] : null;

const defaultPath = path.join(
  os.homedir(),
  ".ialfred/ops/plan-recuperacion/viz/data.json",
);
const snapshotPath =
  fileArg ||
  process.env.RECOVERY_SNAPSHOT_PATH ||
  defaultPath;

const apiBase = (
  process.env.BMC_API_BASE ||
  process.env.VITE_API_BASE ||
  "http://127.0.0.1:3001"
).replace(/\/+$/, "");

const token = process.env.BMC_TOKEN || process.env.ACCESS_TOKEN || "";

if (!fs.existsSync(snapshotPath)) {
  console.error(`Missing snapshot file: ${snapshotPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(snapshotPath, "utf8");
let snapshot;
try {
  snapshot = JSON.parse(raw);
} catch (e) {
  console.error("Invalid JSON:", e.message);
  process.exit(1);
}

if (!snapshot?.kpi || typeof snapshot.kpi !== "object") {
  console.error("Snapshot must include kpi object (same shape as viz/data.json)");
  process.exit(1);
}

const url = `${apiBase}/api/banco/recovery-snapshot`;
console.log(`PUT ${url}`);
console.log(`file ${snapshotPath}`);
console.log(`as_of ${snapshot.as_of} pipeline_usd ${snapshot.kpi?.pipeline_usd}`);

const res = await fetch(url, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ snapshot }),
});

const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error("FAIL", res.status, body);
  process.exit(1);
}
console.log("OK", { id: body.id, as_of: body.as_of, created_at: body.created_at });
