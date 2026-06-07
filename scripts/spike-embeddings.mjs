#!/usr/bin/env node
/**
 * Throwaway embedding eval for BMC RAG (Track B → knowledgeLoader.js upgrade).
 *
 * Compares retrieval quality on the existing training KB across three methods:
 *   A. token-overlap          — current dedup heuristic (server/lib/trainingKB.js)
 *   B. nomic-embed-text:v1.5  — 768-d, ~140 MB, asymmetric query/doc prefixes
 *   C. bge-m3:567m            — 1024-d, ~600 MB, multilingual symmetric
 *
 * Build: 26 entries from data/training-kb.json. For each entry the corpus
 * "document" is `question + "\n" + goodAnswer`. Queries are the original
 * question + 2 Haiku-generated paraphrases per entry → 78 queries against a
 * 26-doc corpus. Target = the source entry. Metric = recall@1/5/10.
 *
 * Side effects (all under /tmp/panelin-rag/, no production touched):
 *   - spike-paraphrases.json     — Haiku output cache (skip re-paying on rerun)
 *   - spike-embeddings-cache.json — Ollama embedding cache (skip re-embedding)
 *   - spike-results.md           — final report (overwritten each run)
 *
 * Cost: ~USD 0.05 in Haiku tokens on the first run; $0 on subsequent reruns.
 *
 * Prereqs:
 *   - Ollama running:  ollama serve   (default :11434)
 *   - Models pulled:   ollama pull nomic-embed-text:v1.5 && ollama pull bge-m3:567m
 *   - .env has ANTHROPIC_API_KEY
 */

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const KB_PATH = path.resolve('data/training-kb.json');
const OUT_DIR = '/tmp/panelin-rag';
const PARA_CACHE = `${OUT_DIR}/spike-paraphrases.json`;
const EMB_CACHE = `${OUT_DIR}/spike-embeddings-cache.json`;
const REPORT = `${OUT_DIR}/spike-results.md`;

const OLLAMA = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const PARAPHRASES_PER_ENTRY = 2;
const TOP_K = 10;

// ---------- helpers ----------

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((t) => t.length >= 3);

const tokenOverlapScore = (queryText, docText) => {
  const qTokens = tokenize(queryText);
  if (!qTokens.length) return 0;
  const lcDoc = String(docText || '').toLowerCase();
  let s = 0;
  for (const t of qTokens) if (lcDoc.includes(t)) s++;
  return s / qTokens.length; // normalized so ties break by query length
};

const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
};

const recallAtK = (rankedIds, targetId, k) =>
  rankedIds.slice(0, k).includes(targetId) ? 1 : 0;

async function loadCache(file) {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Anthropic paraphrase ----------

async function paraphrase(anthropic, question) {
  const msg = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    system:
      'Sos un cliente uruguayo escribiendo a una empresa de paneles aislantes. Devolvés SOLO JSON válido, sin texto extra ni markdown.',
    messages: [
      {
        role: 'user',
        content:
          `Esta es la pregunta original de un cliente:\n"${question}"\n\n` +
          `Generá ${PARAPHRASES_PER_ENTRY} paráfrasis naturales en español rioplatense ` +
          `que otros clientes podrían escribir preguntando lo mismo. Variá vocabulario y estructura.\n\n` +
          `Respondé SOLO con JSON: {"paraphrases": ["...", "..."]}`,
      },
    ],
  });
  const text = msg.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`No JSON in response: ${text.slice(0, 120)}`);
  const parsed = JSON.parse(m[0]);
  if (!Array.isArray(parsed.paraphrases)) {
    throw new Error('Missing paraphrases array');
  }
  return parsed.paraphrases.slice(0, PARAPHRASES_PER_ENTRY);
}

// ---------- Ollama embed ----------

async function embedOllama(model, prompt) {
  const res = await fetch(`${OLLAMA}/api/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
  });
  if (!res.ok) {
    throw new Error(`ollama ${model} → ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.embedding)) {
    throw new Error(`ollama ${model} returned no embedding`);
  }
  return data.embedding;
}

const nomicPrefix = (text, kind) =>
  (kind === 'query' ? 'search_query: ' : 'search_document: ') + text;

// ---------- main ----------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const kb = JSON.parse(await fs.readFile(KB_PATH, 'utf8'));
  const entries = (kb.entries ?? []).filter(
    (e) => !e.archived && (e.status == null || e.status === 'active') && e.question && e.goodAnswer,
  );
  console.log(`Loaded ${entries.length} active KB entries from ${KB_PATH}`);

  // 1. Build/load paraphrases
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing in .env');
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const paraCache = await loadCache(PARA_CACHE);

  for (const e of entries) {
    if (paraCache[e.id]?.length === PARAPHRASES_PER_ENTRY) continue;
    process.stdout.write(`  paraphrasing ${e.id.slice(0, 8)}…`);
    paraCache[e.id] = await paraphrase(anthropic, e.question);
    await saveCache(PARA_CACHE, paraCache);
    process.stdout.write(` ok\n`);
  }

  // 2. Build queries (78 = 26 originals + 52 paraphrases)
  const queries = [];
  for (const e of entries) {
    queries.push({ targetId: e.id, kind: 'original', text: e.question });
    for (const p of paraCache[e.id]) {
      queries.push({ targetId: e.id, kind: 'paraphrase', text: p });
    }
  }
  console.log(`Built ${queries.length} queries against ${entries.length}-doc corpus`);

  // 3. Build/load embeddings
  const embCache = await loadCache(EMB_CACHE);
  const embKey = (model, kind, text) => `${model}::${kind}::${text}`;

  async function getEmb(model, kind, text) {
    const key = embKey(model, kind, text);
    if (embCache[key]) return embCache[key];
    const prompt = model === 'nomic-embed-text:v1.5' ? nomicPrefix(text, kind) : text;
    const emb = await embedOllama(model, prompt);
    embCache[key] = emb;
    return emb;
  }

  const MODELS = ['nomic-embed-text:v1.5', 'bge-m3:567m'];

  for (const model of MODELS) {
    process.stdout.write(`  embedding corpus with ${model}…`);
    for (const e of entries) {
      await getEmb(model, 'doc', `${e.question}\n${e.goodAnswer}`);
    }
    process.stdout.write(` ok\n`);
    process.stdout.write(`  embedding queries with ${model}…`);
    for (const q of queries) {
      await getEmb(model, 'query', q.text);
    }
    process.stdout.write(` ok\n`);
    await saveCache(EMB_CACHE, embCache);
  }

  // 4. Score & rank for all 3 methods
  const methods = {
    'token-overlap': (q) =>
      entries.map((e) => ({
        id: e.id,
        score: tokenOverlapScore(q.text, `${e.question}\n${e.goodAnswer}`),
      })),
  };
  for (const model of MODELS) {
    methods[model] = (q) => {
      const qVec = embCache[embKey(model, 'query', q.text)];
      return entries.map((e) => ({
        id: e.id,
        score: cosine(qVec, embCache[embKey(model, 'doc', `${e.question}\n${e.goodAnswer}`)]),
      }));
    };
  }

  const stats = {};
  for (const [name, scorer] of Object.entries(methods)) {
    let r1 = 0, r5 = 0, r10 = 0;
    for (const q of queries) {
      const ranked = scorer(q)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.id);
      r1 += recallAtK(ranked, q.targetId, 1);
      r5 += recallAtK(ranked, q.targetId, 5);
      r10 += recallAtK(ranked, q.targetId, 10);
    }
    const n = queries.length;
    stats[name] = {
      'recall@1': (r1 / n).toFixed(3),
      'recall@5': (r5 / n).toFixed(3),
      'recall@10': (r10 / n).toFixed(3),
    };
  }

  // 5. Write report
  const lines = [];
  const paraphraseQueryCount = queries.filter((q) => q.kind === 'paraphrase').length;
  lines.push(`# Embedding Spike — Results (${new Date().toISOString().slice(0, 10)})`);
  lines.push('');
  lines.push(`Corpus: ${entries.length} active entries from \`data/training-kb.json\`.`);
  lines.push(`Queries: ${queries.length} (${entries.length} original questions + ${paraphraseQueryCount} Haiku paraphrases).`);
  lines.push('Score: 1.0 means the source entry was returned at that rank or better.');
  lines.push('');
  lines.push('| method | recall@1 | recall@5 | recall@10 |');
  lines.push('|---|---|---|---|');
  for (const [name, s] of Object.entries(stats)) {
    lines.push(`| ${name} | ${s['recall@1']} | ${s['recall@5']} | ${s['recall@10']} |`);
  }
  lines.push('');
  lines.push('## Reading the table');
  lines.push('');
  lines.push('- **recall@1** is the load-bearing metric for top-1 prompt injection (knowledgeLoader concat replacement).');
  lines.push('- **recall@5** is the relevant metric if we plan to inject the 5 best chunks into the system prompt.');
  lines.push(`- Random baseline ≈ ${(1 / entries.length).toFixed(3)} for recall@1, ${(5 / entries.length).toFixed(3)} for recall@5, ${(10 / entries.length).toFixed(3)} for recall@10.`);
  lines.push('');
  lines.push('## Decision rule (proposed)');
  lines.push('');
  lines.push('- If `bge-m3` beats `nomic-embed-text:v1.5` by ≥ 5 points on recall@5 → use `bge-m3` (store: `vector(1024)`).');
  lines.push('- Otherwise → use `nomic-embed-text:v1.5` (store: `vector(768)`, smaller cold-start, lower RAM in dev).');
  lines.push('- If both lose to token-overlap on recall@5 → reconsider the corpus shape (maybe questions are too short).');

  await fs.writeFile(REPORT, lines.join('\n') + '\n', 'utf8');
  console.log(`\nReport → ${REPORT}`);
  console.log('\n' + lines.slice(6, 13).join('\n'));
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
