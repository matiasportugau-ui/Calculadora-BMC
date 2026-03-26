#!/usr/bin/env node
/**
 * Exporta una tanda de preguntas ML para simulación en ciego (mode blind)
 * o con respuestas humanas (mode gold) para comparación.
 *
 * Uso:
 *   node scripts/ml-simulation-batch-export.mjs --offset 0 --size 10 --mode blind
 *   BMC_API_BASE=http://127.0.0.1:3001 node scripts/ml-simulation-batch-export.mjs ...
 *
 * Requiere: API con OAuth ML válido (GET /ml/questions).
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_BASE = process.env.BMC_API_BASE || "http://127.0.0.1:3001";

function parseArgs(argv) {
  const out = {
    offset: 0,
    size: 10,
    mode: "blind",
    out: null,
    base: DEFAULT_BASE,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(`Usage: node scripts/ml-simulation-batch-export.mjs [options]

Options:
  --offset N     Pagination offset (default 0)
  --size N       Page size (default 10)
  --mode blind|gold   blind = only buyer question + ids; gold = include human answer text
  --out PATH     Write JSON to file instead of stdout
  --base URL     API base (default $BMC_API_BASE or http://127.0.0.1:3001)
`);
      process.exit(0);
    }
    if (a === "--offset") out.offset = Number(argv[++i] ?? "0");
    else if (a === "--size") out.size = Number(argv[++i] ?? "10");
    else if (a === "--mode") out.mode = String(argv[++i] ?? "blind");
    else if (a === "--out") out.out = argv[++i] ?? null;
    else if (a === "--base") out.base = argv[++i] ?? DEFAULT_BASE;
  }
  return out;
}

async function fetchPage(base, offset, limit) {
  const u = new URL("/ml/questions", base);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));
  const res = await fetch(u, { signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

function mapBlind(q) {
  return {
    id: q.id,
    item_id: q.item_id ?? null,
    date_created: q.date_created ?? null,
    status: q.status ?? null,
    text: (q.text ?? "").trim(),
  };
}

function mapGold(q) {
  const b = mapBlind(q);
  const ans = q.answer;
  b.human_answer_text = ans?.text ? String(ans.text).trim() : null;
  b.human_answer_status = ans?.status ?? null;
  b.human_answer_date = ans?.date_created ?? null;
  return b;
}

async function main() {
  const opts = parseArgs(process.argv);
  const mode = opts.mode === "gold" ? "gold" : "blind";
  const payload = await fetchPage(opts.base, opts.offset, opts.size);
  const questions = payload.questions ?? [];
  const mapper = mode === "gold" ? mapGold : mapBlind;

  const out = {
    meta: {
      api_base: opts.base,
      offset: opts.offset,
      size_requested: opts.size,
      total_reported: payload.total ?? null,
      mode,
      exported_at: new Date().toISOString(),
    },
    questions: questions.map(mapper),
  };

  const json = JSON.stringify(out, null, 2);
  if (opts.out) {
    const dir = path.dirname(path.resolve(opts.out));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(opts.out, json, "utf8");
    console.error(`Wrote ${opts.out} (${out.questions.length} questions)`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
