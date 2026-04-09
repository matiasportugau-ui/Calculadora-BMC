#!/usr/bin/env node
/**
 * Genera borrador de playbook (Markdown) desde export reciente o DB.
 * Requiere OPENAI_API_KEY o ANTHROPIC_API_KEY (usa OpenAI si ambos).
 * Uso: npm run omni:playbook -- [--limit-threads=50]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function loadSample(pool, maxThreads) {
  const { rows: threads } = await pool.query(
    `select id, channel, external_thread_id from omni_threads order by id desc limit $1`,
    [maxThreads],
  );
  const lines = [];
  for (const th of threads) {
    const { rows: msgs } = await pool.query(
      `select direction, body_text, received_at from omni_messages where thread_id = $1 order by id asc limit 200`,
      [th.id],
    );
    const chunk = msgs.map((m) => `${m.direction}: ${m.body_text || ""}`).join("\n");
    lines.push(`### Hilo ${th.channel} ${th.external_thread_id}\n${chunk}\n`);
  }
  return lines.join("\n---\n");
}

async function main() {
  let maxThreads = 50;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--limit-threads=")) maxThreads = Number(a.slice("--limit-threads=".length)) || 50;
  }

  const databaseUrl = process.env.OMNI_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("OMNI_DATABASE_URL or DATABASE_URL required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const sample = await loadSample(pool, maxThreads);
  await pool.end();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    const out = path.join(root, "docs", "team", "reports", `OMNI-PLAYBOOK-DRAFT-${Date.now()}.md`);
    await fs.promises.mkdir(path.dirname(out), { recursive: true });
    const body = `# Borrador playbook (sin IA)\n\nPegá OPENAI_API_KEY para generar pautas automáticas.\n\n## Muestra bruta\n\n${sample.slice(0, 120000)}`;
    await fs.promises.writeFile(out, body, "utf8");
    console.log("wrote (no AI)", out);
    return;
  }

  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: openaiKey });
  const prompt = `Sos consultor comercial B2B (construcción / paneles Uruguay). A partir de estos hilos reales, producí:
1) Patrones de consulta (tipos).
2) Pautas de respuesta (tono, límites, cuándo escalar a humano).
3) Frases modelo breves.
4) Lista de "no hacer".

Texto fuente:\n\n${sample.slice(0, 100000)}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2500,
  });
  const text = resp.choices?.[0]?.message?.content?.trim() || "";

  const outDir = path.join(root, "docs", "team", "reports");
  await fs.promises.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `OMNI-PLAYBOOK-DRAFT-${Date.now()}.md`);
  await fs.promises.writeFile(out, `# Borrador playbook (IA)\n\n${text}\n`, "utf8");
  console.log("wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
