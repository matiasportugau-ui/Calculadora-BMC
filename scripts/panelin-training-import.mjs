#!/usr/bin/env node
/**
 * Import training entries into Panelin KB (same store as POST /api/agent/train).
 *
 * Prerrequisitos:
 *   - API en marcha: npm run start:api (local) o URL de Cloud Run
 *   - .env con API_AUTH_TOKEN (mismo valor que el servidor)
 *
 * Uso:
 *   node scripts/panelin-training-import.mjs --file ruta/entries.json
 *   node scripts/panelin-training-import.mjs --file entries.json --dry-run
 *   BMC_API_BASE=https://tu-servicio.run.app node scripts/panelin-training-import.mjs --file entries.json
 *
 * Formato JSON: array de objetos con al menos question + goodAnswer.
 * Opcionales: category (sales|mercadolibre|ml|product|math|conversational), badAnswer, context, permanent
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { config } from "dotenv";

config();

function parseArgs(argv) {
  const out = { file: "", dryRun: false, base: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file" || a === "-f") out.file = argv[++i] || "";
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--base" || a === "-b") out.base = argv[++i] || "";
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function trimBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  if (argv.help) {
    console.log(`panelin-training-import — carga entradas en data/training-kb.json vía API

Opciones:
  --file, -f   JSON con array de entradas (obligatorio salvo --help)
  --dry-run    Solo muestra qué se enviaría
  --base, -b   URL API (default: BMC_API_BASE o http://127.0.0.1:3001)

Variables: API_AUTH_TOKEN (obligatorio), BMC_API_BASE (opcional)

Ejemplo de entrada:
  {"category":"mercadolibre","question":"…","goodAnswer":"…","context":"Canal: Mercado Libre | Q:…","permanent":true}
`);
    process.exit(0);
  }

  const file = argv.file;
  if (!file) {
    console.error("✗ Falta --file <ruta.json>");
    process.exit(1);
  }

  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(abs)) {
    console.error("✗ No existe el archivo:", abs);
    process.exit(1);
  }

  const token = String(process.env.API_AUTH_TOKEN || "").trim();
  if (!token && !argv.dryRun) {
    console.error("✗ Definí API_AUTH_TOKEN en .env (mismo que el servidor)");
    process.exit(1);
  }

  const base = trimBase(
    argv.base || process.env.BMC_API_BASE || process.env.BMC_TRAIN_API_BASE || "http://127.0.0.1:3001",
  );

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    console.error("✗ JSON inválido:", e.message);
    process.exit(1);
  }

  const entries = Array.isArray(raw) ? raw : raw.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("✗ El archivo debe ser un array de entradas o { entries: [...] }");
    process.exit(1);
  }

  console.log(`>>> Base API: ${base}`);
  console.log(`>>> Entradas: ${entries.length}${argv.dryRun ? " (dry-run)" : ""}\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < entries.length; i++) {
    const row = entries[i] || {};
    const body = {
      category: row.category ?? "sales",
      question: String(row.question || "").trim(),
      goodAnswer: String(row.goodAnswer || "").trim(),
      badAnswer: String(row.badAnswer || "").trim(),
      context: String(row.context || "").trim(),
      source: String(row.source || "panelin-training-import"),
      permanent: Boolean(row.permanent),
    };

    if (!body.question || !body.goodAnswer) {
      console.error(`✗ [#${i + 1}] question y goodAnswer son obligatorios — omitido`);
      fail++;
      continue;
    }

    if (argv.dryRun) {
      console.log(`— [#${i + 1}] ${body.category} | Q: ${body.question.slice(0, 60)}…`);
      ok++;
      continue;
    }

    const url = `${base}/api/agent/train`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Api-Key": token,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok || !data.ok) {
      console.error(`✗ [#${i + 1}] ${res.status}`, data.error || data);
      fail++;
      continue;
    }

    console.log(`✓ [#${i + 1}] id=${data.entry?.id || "?"} category=${data.entry?.category}`);
    ok++;
  }

  console.log(`\n>>> Listo: ${ok} ok, ${fail} fallidos`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
