/**
 * server/lib/rag.js — Retriever para RAG v1 sobre quote_embeddings.
 *
 * Flujo: embed(query) → consulta pgvector → filtra por threshold → devuelve metadata leads.
 *
 * Semántica de distancia/similitud:
 *   pgvector `<=>` devuelve DISTANCIA coseno [0, 2] donde 0 = vectores idénticos.
 *   threshold=0.7 en esta API significa SIMILITUD ≥ 0.7, es decir distancia ≤ 0.3.
 *   La conversión es: similarity = 1 - distance.
 *   Si confundieras y filtraras por distance >= 0.7 estarías devolviendo los PEORES matches.
 *
 * Dependencias: embeddings.js, pg (config.databaseUrl).
 */

import pg from "pg";
import { embedText } from "./embeddings.js";
import { config } from "../config.js";

/** Pool compartido para el módulo. Lazy-init para no conectar si RAG está OFF. */
let _pool = null;

function getPool() {
  if (!_pool) {
    if (!config.databaseUrl) {
      throw new Error("rag: DATABASE_URL no configurado — necesario para query de embeddings");
    }
    _pool = new pg.Pool({ connectionString: config.databaseUrl });
    // Log errores de pool en lugar de silenciarlos
    _pool.on("error", (err) => {
      console.error("[rag] Postgres pool error:", err.message);
    });
  }
  return _pool;
}

/**
 * Recupera los k leads más similares a la query.
 *
 * @param {string} query — texto del usuario (ej. "panel 100mm 4 aguas, 200m²")
 * @param {number} [k=5] — máximo de resultados a devolver
 * @param {number} [threshold=0.70] — similitud mínima (0-1); se convierte a distancia ≤ 1-threshold
 * @returns {Promise<Array<{lead_id: string, similarity: number, metadata: object}>>}
 *   Array vacío si no hay matches, DB está caída o embeddings no configurados.
 */
export async function retrieveSimilarQuotes(query, k = 5, threshold = 0.70) {
  if (!query || typeof query !== "string" || query.trim().length < 3) {
    return [];
  }

  // Convertimos threshold de similitud a distancia máxima:
  //   similarity = 1 - distance  ⟹  distance = 1 - similarity
  // Queremos similarity >= threshold, es decir distance <= (1 - threshold)
  const maxDistance = 1 - threshold;

  let queryEmbedding;
  try {
    queryEmbedding = await embedText(query.trim());
  } catch (err) {
    console.warn("[rag] embedText falló:", err.message);
    return [];
  }

  // Formato pgvector para el parámetro: array SQL '[f1,f2,...,fN]'
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         lead_id,
         metadata,
         (embedding <=> $1::vector) AS distance
       FROM quote_embeddings
       WHERE embedding IS NOT NULL
         AND (embedding <=> $1::vector) <= $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [embeddingLiteral, maxDistance, k],
    );

    return result.rows.map((row) => ({
      lead_id: row.lead_id,
      similarity: parseFloat((1 - parseFloat(row.distance)).toFixed(4)),
      metadata: row.metadata,
    }));
  } catch (err) {
    console.error("[rag] Error en query pgvector:", err.message);
    return [];
  }
}

/**
 * Serializa los leads recuperados en un bloque markdown compacto
 * listo para inyectar al system prompt de Panelin.
 *
 * Formato por lead (1 línea):
 *   - 2024-03-15 | Juan García | ISODEC_EPS 100mm | 320 m² | USD 12.400 | score: 0.87
 *
 * Criterios de diseño:
 *  - Compact: ~100-150 chars/lead, para que 5 leads sean ~750 tokens máximo.
 *  - Legible para el modelo: fecha + cliente + producto + área + precio + score.
 *  - Omite campos null sin ruido adicional.
 *
 * @param {Array<{lead_id: string, similarity: number, metadata: object}>} quotes
 * @returns {string} — bloque markdown o string vacío si no hay quotes
 */
export function formatRetrievedContextForPrompt(quotes) {
  if (!Array.isArray(quotes) || quotes.length === 0) return "";

  const lines = quotes.map(({ similarity, metadata: m }) => {
    const parts = [];

    // Fecha
    const fecha = m.fecha ? m.fecha.slice(0, 10) : null;
    if (fecha) parts.push(fecha);

    // Cliente (truncado a 25 chars para no inflar el prompt)
    const cliente = m.cliente_nombre ? String(m.cliente_nombre).slice(0, 25) : null;
    if (cliente) parts.push(cliente);

    // Panel
    const panelParts = [];
    if (m.panel_familia) panelParts.push(m.panel_familia.replace(/_/g, " "));
    if (m.panel_espesor) panelParts.push(`${m.panel_espesor}mm`);
    if (panelParts.length > 0) parts.push(panelParts.join(" "));

    // Área
    if (m.area_m2 != null) parts.push(`${m.area_m2} m²`);

    // Total con IVA (preferido) o sin IVA
    if (m.total_con_iva_usd != null) {
      parts.push(`USD ${Number(m.total_con_iva_usd).toFixed(0)}`);
    } else if (m.total_sin_iva_usd != null) {
      parts.push(`USD ${Number(m.total_sin_iva_usd).toFixed(0)} s/IVA`);
    }

    // Score de similitud
    parts.push(`score: ${similarity.toFixed(2)}`);

    return `- ${parts.join(" | ")}`;
  });

  return [
    "## Casos similares de la base histórica:",
    ...lines,
  ].join("\n");
}
