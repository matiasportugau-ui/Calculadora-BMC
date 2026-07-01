#!/usr/bin/env node
/**
 * Chunks + embeds docs/team/knowledge/*.md and docs/team/PROJECT-STATE.md's
 * "Cambios recientes" entries into team_kb_embeddings, for kbAccess.js.
 *
 * Manually triggered (not run on every request/deploy):
 *   DATABASE_URL=postgres://... npm run kb:ingest-team-docs
 *
 * Idempotent: skips re-embedding/writing a chunk whose content_hash is
 * unchanged from what's already stored (same idempotency idea as
 * server/migrations/omni/003_deals_knowledge.sql's omni_message_embeddings).
 * Run kb:migrate first — a missing team_kb_embeddings table is a hard error
 * here (unlike kbAccess.js's read path, which degrades gracefully).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { embedText, hashText } from "../server/lib/embeddings.js";
import { domainForKnowledgeFile } from "../server/lib/kbDomains.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const knowledgeDir = path.join(root, "docs", "team", "knowledge");
const projectStatePath = path.join(root, "docs", "team", "PROJECT-STATE.md");

const MAX_CHUNK_CHARS = 1400;

/** Splits markdown text into paragraph-bounded chunks, merging short paragraphs up to MAX_CHUNK_CHARS. */
function chunkMarkdown(text) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if (current && (current.length + p.length + 2) > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Extracts each dated entry under "## Cambios recientes" as its own chunk. */
function chunkProjectStateChangelog(raw) {
  const marker = "## Cambios recientes";
  const start = raw.indexOf(marker);
  if (start === -1) return [];
  const afterMarker = raw.slice(start + marker.length);
  const nextHeading = afterMarker.search(/\n##\s/);
  const section = nextHeading === -1 ? afterMarker : afterMarker.slice(0, nextHeading);

  const entryStart = /\*\*\d{4}-\d{2}-\d{2}[^*]*\*\*:/g;
  const indices = [];
  let m;
  while ((m = entryStart.exec(section))) indices.push(m.index);

  const entries = [];
  for (let i = 0; i < indices.length; i++) {
    const from = indices[i];
    const to = i + 1 < indices.length ? indices[i + 1] : section.length;
    const entry = section.slice(from, to).trim();
    if (entry) entries.push(entry);
  }
  return entries;
}

async function upsertChunk(client, { sourcePath, chunkIndex, domain, text }) {
  const contentHash = hashText(text);

  const { rows } = await client.query(
    "SELECT content_hash FROM team_kb_embeddings WHERE source_path = $1 AND chunk_index = $2",
    [sourcePath, chunkIndex],
  );
  if (rows.length > 0 && rows[0].content_hash === contentHash) {
    return "skip";
  }

  const embedding = await embedText(text, contentHash);
  const embeddingLiteral = `[${embedding.join(",")}]`;

  await client.query(
    `INSERT INTO team_kb_embeddings (source_path, chunk_index, domain, content_hash, embedding, text, updated_at)
     VALUES ($1, $2, $3, $4, $5::vector, $6, NOW())
     ON CONFLICT (source_path, chunk_index)
     DO UPDATE SET domain = $3, content_hash = $4, embedding = $5::vector, text = $6, updated_at = NOW()`,
    [sourcePath, chunkIndex, domain, contentHash, embeddingLiteral, text],
  );
  return rows.length > 0 ? "updated" : "inserted";
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required — run `npm run kb:migrate` first if the table doesn't exist yet");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const stats = { inserted: 0, updated: 0, skip: 0 };

  try {
    const knowledgeFiles = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));
    for (const file of knowledgeFiles) {
      const sourcePath = path.relative(root, path.join(knowledgeDir, file));
      const raw = fs.readFileSync(path.join(knowledgeDir, file), "utf8");
      const domain = domainForKnowledgeFile(file);
      const chunks = chunkMarkdown(raw);
      for (let i = 0; i < chunks.length; i++) {
        const result = await upsertChunk(client, { sourcePath, chunkIndex: i, domain, text: chunks[i] });
        stats[result]++;
      }
      console.log(`${sourcePath}: ${chunks.length} chunk(s)`);
    }

    const projectStateRaw = fs.readFileSync(projectStatePath, "utf8");
    const entries = chunkProjectStateChangelog(projectStateRaw);
    const sourcePath = path.relative(root, projectStatePath);
    for (let i = 0; i < entries.length; i++) {
      const result = await upsertChunk(client, { sourcePath, chunkIndex: i, domain: "project_state", text: entries[i] });
      stats[result]++;
    }
    console.log(`${sourcePath}: ${entries.length} changelog entr(y/ies)`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`kb ingest done — inserted=${stats.inserted} updated=${stats.updated} skip(unchanged)=${stats.skip}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
