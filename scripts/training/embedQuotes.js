#!/usr/bin/env node
/**
 * scripts/training/embedQuotes.js — Pipeline batch de embeddings para RAG v1.
 *
 * Lee data/training/normalized-quotes.jsonl, genera embeddings por lead
 * y los upserta en la tabla quote_embeddings de Postgres.
 *
 * Uso:
 *   node scripts/training/embedQuotes.js
 *   node scripts/training/embedQuotes.js --limit 50
 *   node scripts/training/embedQuotes.js --limit 100 --dry-run
 *   node scripts/training/embedQuotes.js --reembed-all
 *
 * Flags:
 *   --limit N        Procesar solo los primeros N leads del JSONL.
 *   --dry-run        Leer y procesar pero NO escribir en Postgres.
 *   --reembed-all    Ignorar content_hash — re-embeder todos los leads aunque existan.
 *
 * Idempotencia:
 *   Para cada lead: si lead_id ya existe en quote_embeddings con el mismo
 *   content_hash → skip (no hay cambios). Solo re-embede si el hash cambió
 *   (texto actualizado) o si se pasa --reembed-all.
 *
 * Errores por doc:
 *   Los errores de embedding o DB de un lead individual se loggean y se
 *   continúa con el siguiente. El batch no falla por un solo doc malo.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { sanitizeQuoteMetadata } from "../../server/lib/quoteMetadata.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

// Importar después de cargar dotenv para que config.js lea las vars
const { embedText, hashText, activeProvider } = await import(
  path.join(repoRoot, "server/lib/embeddings.js")
);
const { config } = await import(path.join(repoRoot, "server/config.js"));

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const dryRun = args.includes("--dry-run");
const reembedAll = args.includes("--reembed-all");
const jsonlPath = path.join(repoRoot, "data/training/normalized-quotes.jsonl");

// ─── Construcción del texto para embedding ────────────────────────────────────

/**
 * Construye el texto legible que se envía al modelo de embeddings.
 * Formato: "Cliente {nombre}, fecha {fecha}, panel {familia} {espesor}mm, área {area}m², total ${total}"
 *
 * Reglas:
 *  - Omite campos null en lugar de escribir "null". Ej: si no hay área, no se escribe.
 *  - Si el lead tiene muy pocos campos (solo fecha y nombre), igual genera un texto
 *    válido — aunque el embedding resultante tendrá poca utilidad semántica.
 *  - Mínimo viable: si solo hay lead_id y no hay campos de texto, retorna null
 *    y el lead se omite del batch.
 *
 * @param {object} lead
 * @returns {string|null}
 */
function buildTextForEmbedding(lead) {
  const parts = [];

  if (lead.cliente_nombre) {
    parts.push(`Cliente ${lead.cliente_nombre}`);
  }
  if (lead.fecha) {
    parts.push(`fecha ${lead.fecha}`);
  }
  if (lead.panel_familia || lead.panel_espesor) {
    const panelParts = ["panel"];
    if (lead.panel_familia) panelParts.push(lead.panel_familia.replace(/_/g, " "));
    if (lead.panel_espesor) panelParts.push(`${lead.panel_espesor}mm`);
    parts.push(panelParts.join(" "));
  }
  if (lead.scenario) {
    parts.push(`escenario ${lead.scenario.replace(/_/g, " ")}`);
  }
  if (lead.area_m2 != null) {
    parts.push(`área ${lead.area_m2} m2`);
  }
  if (lead.largo_m != null && lead.ancho_m != null) {
    parts.push(`dimensiones ${lead.largo_m}m x ${lead.ancho_m}m`);
  }
  if (lead.total_sin_iva_usd != null) {
    parts.push(`subtotal USD ${lead.total_sin_iva_usd}`);
  }
  if (lead.total_con_iva_usd != null) {
    parts.push(`total USD ${lead.total_con_iva_usd}`);
  }
  if (lead.lista_precios) {
    parts.push(`lista ${lead.lista_precios}`);
  }
  if (lead.ubicacion) {
    parts.push(`ubicación ${lead.ubicacion}`);
  }
  if (lead.vendedor) {
    parts.push(`vendedor ${lead.vendedor}`);
  }

  // Mínimo 2 campos con contenido para que valga la pena embeder
  if (parts.length < 2) return null;

  return parts.join(", ") + ".";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== embedQuotes v1 ===");
  console.log(`Provider: ${activeProvider()}`);
  console.log(`JSONL: ${jsonlPath}`);
  console.log(`Limit: ${limit === Infinity ? "sin límite" : limit}`);
  console.log(`Dry-run: ${dryRun}`);
  console.log(`Reembed-all: ${reembedAll}`);
  console.log("─".repeat(50));

  if (!fs.existsSync(jsonlPath)) {
    console.error(`Error: no existe el archivo ${jsonlPath}`);
    console.error("Correr primero: node scripts/training/ingestDropboxQuotes.js");
    process.exit(1);
  }

  if (!config.databaseUrl && !dryRun) {
    console.error("Error: DATABASE_URL no configurado. Usar --dry-run para probar sin DB.");
    process.exit(1);
  }

  let pool = null;
  if (!dryRun && config.databaseUrl) {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    // Verificar conexión rápida
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("Conexión Postgres OK");
    } catch (err) {
      console.error("Error conectando a Postgres:", err.message);
      process.exit(1);
    }
  }

  // Leer hashes existentes de la DB para detección de cambios
  const existingHashes = new Map(); // lead_id → content_hash
  if (pool && !reembedAll) {
    try {
      const res = await pool.query("SELECT lead_id, content_hash FROM quote_embeddings");
      for (const row of res.rows) {
        existingHashes.set(row.lead_id, row.content_hash);
      }
      console.log(`Hashes existentes en DB: ${existingHashes.size}`);
    } catch (err) {
      console.warn("Advertencia: no se pudieron leer hashes existentes:", err.message);
      console.warn("¿Corriste la migración 0001? Ver migrations/README.md");
    }
  }

  // Leer y procesar el JSONL
  const rl = readline.createInterface({
    input: fs.createReadStream(jsonlPath),
    crlfDelay: Infinity,
  });

  const stats = {
    total: 0,
    skipped_no_text: 0,
    skipped_hash_match: 0,
    embedded: 0,
    upserted: 0,
    errors: 0,
  };

  const BATCH_LOG_INTERVAL = 100;

  for await (const line of rl) {
    if (stats.total >= limit) break;

    const trimmed = line.trim();
    if (!trimmed) continue;

    stats.total++;

    // Parse lead
    let lead;
    try {
      lead = JSON.parse(trimmed);
    } catch {
      console.warn(`[${stats.total}] JSON inválido, omitiendo línea`);
      stats.errors++;
      continue;
    }

    if (!lead.lead_id) {
      stats.errors++;
      continue;
    }

    // Construir texto para embedding
    const textForEmbedding = buildTextForEmbedding(lead);
    if (!textForEmbedding) {
      stats.skipped_no_text++;
      continue;
    }

    const contentHash = hashText(textForEmbedding);

    // Skip si el hash no cambió (idempotencia)
    if (!reembedAll && existingHashes.get(lead.lead_id) === contentHash) {
      stats.skipped_hash_match++;
      continue;
    }

    // Generar embedding
    let embedding;
    try {
      embedding = await embedText(textForEmbedding, contentHash);
      stats.embedded++;
    } catch (err) {
      console.warn(`[${stats.total}] Error embebiendo ${lead.lead_id}: ${err.message}`);
      stats.errors++;
      continue;
    }

    // Upsert en Postgres
    if (!dryRun && pool) {
      const embeddingLiteral = `[${embedding.join(",")}]`;
      try {
        await pool.query(
          `INSERT INTO quote_embeddings
             (lead_id, content_hash, embedding, text_for_embedding, metadata, provider, updated_at)
           VALUES ($1, $2, $3::vector, $4, $5::jsonb, $6, NOW())
           ON CONFLICT (lead_id) DO UPDATE SET
             content_hash       = EXCLUDED.content_hash,
             embedding          = EXCLUDED.embedding,
             text_for_embedding = EXCLUDED.text_for_embedding,
             metadata           = EXCLUDED.metadata,
             provider           = EXCLUDED.provider,
             updated_at         = NOW()`,
          [
            lead.lead_id,
            contentHash,
            embeddingLiteral,
            textForEmbedding,
            // Store only non-PII quote facts — this metadata is later injected
            // into LLM prompts via RAG retrieval. See server/lib/quoteMetadata.js.
            JSON.stringify(sanitizeQuoteMetadata(lead)),
            // Tag the provider so the RAG pre-check can refuse stub vectors (0002).
            activeProvider(),
          ],
        );
        stats.upserted++;
      } catch (err) {
        console.warn(`[${stats.total}] Error upsertando ${lead.lead_id}: ${err.message}`);
        stats.errors++;
      }
    } else if (dryRun) {
      // En dry-run, simular upsert
      stats.upserted++;
      if (stats.upserted <= 3) {
        // Mostrar sample de los primeros 3 para verificación visual
        console.log(`  [DRY] ${lead.lead_id} → "${textForEmbedding.slice(0, 80)}..."`);
      }
    }

    // Progreso cada 100 docs
    if (stats.total % BATCH_LOG_INTERVAL === 0) {
      console.log(
        `[${stats.total}] embedded=${stats.embedded} upserted=${stats.upserted} ` +
        `skip_hash=${stats.skipped_hash_match} skip_notext=${stats.skipped_no_text} errors=${stats.errors}`,
      );
    }
  }

  // Cerrar pool
  if (pool) await pool.end();

  // Reporte final
  console.log("─".repeat(50));
  console.log("=== Resultado ===");
  console.log(`  Procesados:       ${stats.total}`);
  console.log(`  Sin texto:        ${stats.skipped_no_text}`);
  console.log(`  Hash sin cambio:  ${stats.skipped_hash_match}`);
  console.log(`  Embeddings nuevos: ${stats.embedded}`);
  console.log(`  Upserts DB:       ${stats.upserted}${dryRun ? " (dry-run, no escritos)" : ""}`);
  console.log(`  Errores:          ${stats.errors}`);

  if (dryRun) {
    console.log("\nDry-run completo. Para escribir en DB: quitar --dry-run.");
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
