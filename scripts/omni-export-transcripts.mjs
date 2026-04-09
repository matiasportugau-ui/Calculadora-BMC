#!/usr/bin/env node
/**
 * Exporta conversaciones omnicanal desde Postgres a JSONL + Markdown.
 * Uso: DATABASE_URL=... npm run omni:export -- [--out-dir=./.omni-export] [--limit=5000]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function parseArgs() {
  const out = { outDir: path.join(root, ".omni-export"), limit: 5000 };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--out-dir=")) out.outDir = a.slice("--out-dir=".length);
    if (a.startsWith("--limit=")) out.limit = Number(a.slice("--limit=".length)) || 5000;
  }
  return out;
}

async function main() {
  const { outDir, limit } = parseArgs();
  const databaseUrl = process.env.OMNI_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("OMNI_DATABASE_URL or DATABASE_URL required");
    process.exit(1);
  }

  await fs.promises.mkdir(outDir, { recursive: true });
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonlPath = path.join(outDir, `omni-transcripts-${stamp}.jsonl`);
  const mdPath = path.join(outDir, `omni-transcripts-${stamp}.md`);

  const { rows: threads } = await pool.query(
    `select id, channel, external_thread_id, contact_name, mode, created_at
     from omni_threads
     order by id desc
     limit $1`,
    [limit],
  );

  const mdParts = [`# Omnicanal export ${stamp}\n`];
  const jsonl = fs.createWriteStream(jsonlPath, { flags: "w" });

  for (const th of threads) {
    const { rows: msgs } = await pool.query(
      `select id, direction, body_text, received_at, consulta_tipo,
              (select string_agg(trim(oa.extracted_text), ' | ')
               from omni_attachments oa
               where oa.message_id = omni_messages.id and oa.extracted_text is not null) as attachment_text
       from omni_messages
       where thread_id = $1
       order by id asc`,
      [th.id],
    );
    const record = { thread: th, messages: msgs };
    jsonl.write(`${JSON.stringify(record)}\n`);

    mdParts.push(`\n## ${th.channel} — ${th.external_thread_id} (${th.contact_name || "sin nombre"})\n`);
    for (const m of msgs) {
      const t = m.received_at ? new Date(m.received_at).toISOString() : "";
      const at = m.attachment_text ? ` [adj: ${m.attachment_text}]` : "";
      mdParts.push(`- ${t} **${m.direction}** ${m.body_text || ""}${at}\n`);
    }
  }

  jsonl.end();
  await new Promise((resolve, reject) => {
    jsonl.on("finish", resolve);
    jsonl.on("error", reject);
  });

  await fs.promises.writeFile(mdPath, mdParts.join(""), "utf8");
  await pool.end();
  console.log("wrote", jsonlPath);
  console.log("wrote", mdPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
