#!/usr/bin/env node
/**
 * Fetch a Wolfboard replay JSON from a public URL (e.g. column M Admin sheet).
 *
 *   node scripts/fetch-wolfboard-replay.mjs 'https://storage.googleapis.com/.../quotes/....json'
 *   node scripts/fetch-wolfboard-replay.mjs --url '...' --out .runtime/replay.json
 *
 * Exit 0 if JSON parses and minimal schema matches buildWolfboardQuoteReplaySnapshot.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {unknown} o */
export function validateWolfboardReplaySnapshot(o) {
  const errs = [];
  if (o == null || typeof o !== "object" || Array.isArray(o)) {
    errs.push("root must be a plain object");
    return errs;
  }
  const obj = /** @type {Record<string, unknown>} */ (o);
  if (obj.schemaVersion !== 1) errs.push(`schemaVersion must be 1 (got ${JSON.stringify(obj.schemaVersion)})`);
  if (obj.kind !== "wolfboard-quote-batch") errs.push(`kind must be "wolfboard-quote-batch" (got ${JSON.stringify(obj.kind)})`);
  if (typeof obj.generatedAt !== "string" || !obj.generatedAt) errs.push("generatedAt must be a non-empty string");
  if (obj.adminRow != null && typeof obj.adminRow !== "number") errs.push("adminRow must be number or null");
  if (typeof obj.cliente !== "string") errs.push("cliente must be string");
  if (typeof obj.consulta !== "string") errs.push("consulta must be string");
  if (typeof obj.listaPrecios !== "string") errs.push("listaPrecios must be string");
  if (!Array.isArray(obj.usedDefaults)) errs.push("usedDefaults must be array");
  if ("extracted" in obj && obj.extracted != null && typeof obj.extracted !== "object") errs.push("extracted must be object or null");
  if ("calcRaw" in obj && obj.calcRaw != null && typeof obj.calcRaw !== "object") errs.push("calcRaw must be object or null");
  return errs;
}

async function main() {
  const argv = process.argv.slice(2);
  let url = "";
  let outPath = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" && argv[i + 1]) { url = String(argv[++i]).trim(); continue; }
    if (a === "--out" && argv[i + 1]) { outPath = String(argv[++i]).trim(); continue; }
    if (!a.startsWith("-") && !url) { url = a.trim(); }
  }
  if (!url) {
    console.error("Usage: node scripts/fetch-wolfboard-replay.mjs <replaySnapshotUrl> [--out path.json]");
    process.exit(2);
  }
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
  }
  const errs = validateWolfboardReplaySnapshot(data);
  if (errs.length) {
    console.error("Schema validation failed:");
    errs.forEach((e) => console.error(" -", e));
    process.exit(1);
  }
  const pretty = JSON.stringify(data, null, 2);
  if (outPath) {
    const abs = resolve(process.cwd(), outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, pretty, "utf8");
    console.log(`Wrote ${abs}`);
  } else {
    console.log(pretty);
  }
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
