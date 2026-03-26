#!/usr/bin/env node
/**
 * Exporta el corpus COMPLETO de preguntas Mercado Libre vía API local
 * (paginación GET /ml/questions). Incluye texto del comprador y respuesta
 * publicada cuando existe.
 *
 * Uso:
 *   npm run ml:corpus-export
 *   npm run ml:corpus-export -- --out ./mi-corpus.json
 *   BMC_API_BASE=http://127.0.0.1:3001 npm run ml:corpus-export
 *
 * Requiere: API en marcha + OAuth ML válido.
 *
 * Aviso: el JSON puede contener datos personales / mensajes de terceros.
 * No subir a repositorios públicos sin revisión.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_BASE = process.env.BMC_API_BASE || "http://127.0.0.1:3001";

function parseArgs(argv) {
  const out = { base: DEFAULT_BASE, out: null, minimal: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--out") out.out = argv[++i] ?? null;
    else if (argv[i] === "--base") out.base = argv[++i] ?? DEFAULT_BASE;
    else if (argv[i] === "--minimal") out.minimal = true;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage: node scripts/ml-export-full-corpus.mjs [--out PATH] [--base URL] [--minimal]`);
      process.exit(0);
    }
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

async function fetchAllQuestions(base) {
  const limit = 50;
  let offset = 0;
  const all = [];
  let total = null;
  for (let i = 0; i < 300; i++) {
    const u = new URL("/ml/questions", base.replace(/\/$/, ""));
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const j = await fetchJson(u.toString());
    const qs = j.questions || [];
    if (total == null && j.total != null) total = j.total;
    all.push(...qs);
    if (qs.length < limit) break;
    offset += limit;
    if (total != null && all.length >= total) break;
  }
  return { questions: all, totalReported: total };
}

function mapRecord(q, minimal) {
  if (minimal) {
    return {
      id: q.id,
      item_id: q.item_id,
      status: q.status,
      date_created: q.date_created,
      buyer_text: (q.text || "").trim().slice(0, 500),
      has_answer: Boolean(q.answer?.text),
      answer_preview: (q.answer?.text || "").trim().slice(0, 300),
    };
  }
  return {
    id: q.id,
    item_id: q.item_id,
    seller_id: q.seller_id,
    status: q.status,
    date_created: q.date_created,
    tags: q.tags,
    text: (q.text || "").trim(),
    answer: q.answer
      ? {
          text: (q.answer.text || "").trim(),
          status: q.answer.status,
          date_created: q.answer.date_created,
        }
      : null,
    from: q.from,
    hold: q.hold,
    deleted_from_listing: q.deleted_from_listing,
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  const base = opts.base.replace(/\/$/, "");

  console.error(`ML corpus export — API: ${base}`);

  const { questions, totalReported } = await fetchAllQuestions(base);

  const payload = {
    meta: {
      exported_at: new Date().toISOString(),
      api_base: base,
      total_reported: totalReported,
      fetched_count: questions.length,
      minimal: opts.minimal,
    },
    questions: questions.map((q) => mapRecord(q, opts.minimal)),
  };

  const defaultDir = path.join(REPO_ROOT, "docs/team/panelsim/reports/ml-corpus/exports");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const defaultPath = path.join(
    defaultDir,
    opts.minimal ? `ML-CORPUS-MINIMAL-${stamp}.json` : `ML-CORPUS-FULL-${stamp}.json`
  );

  const outPath = opts.out ? path.resolve(process.cwd(), opts.out) : defaultPath;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.error(`Wrote ${payload.questions.length} records → ${outPath}`);
  console.log(outPath);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
