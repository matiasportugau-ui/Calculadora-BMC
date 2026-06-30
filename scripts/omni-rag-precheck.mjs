#!/usr/bin/env node
/**
 * Pre-check before enabling RAG grounding for the Omni AI worker.
 *
 * RAG grounding is only useful when (1) the embeddings table is populated,
 * (2) a real semantic embedding provider is configured (NOT the deterministic
 * stub), and (3) retrieval actually returns hits. Flipping RAG_ENABLED without
 * these grounds suggestions on garbage/empty vectors, which is worse than no
 * grounding. This script verifies all three and exits non-zero if any fail.
 *
 * Usage:
 *   DATABASE_URL=postgres://... [OPENAI_API_KEY=...] npm run omni:rag-precheck
 *
 * Exit codes: 0 = pass · 1 = a check failed · 2 = missing DATABASE_URL · 3 = crash
 */
import dotenv from "dotenv";
import pg from "pg";
import { isSemanticEmbeddingAvailable } from "../server/lib/embeddings.js";
import { retrieveSimilarQuotes } from "../server/lib/rag.js";

dotenv.config();

const SAMPLE_QUERY = "cotización panel ISODEC techo 100mm 200 m2";

const ok = (m) => console.log(`✓ ${m}`);
const fail = (m) => console.error(`✗ ${m}`);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail("DATABASE_URL is required");
    process.exit(2);
  }

  let failures = 0;

  // Check 1 — semantic embedding provider (cheap, no DB).
  if (isSemanticEmbeddingAvailable()) {
    ok("semantic embedding provider configured (not stub)");
  } else {
    fail(
      "no usable embedding provider key — embedText() would use NON-SEMANTIC stub " +
        "vectors. Set OPENAI_API_KEY (the embedding provider embedText uses today) before enabling RAG.",
    );
    failures++;
  }

  // Check 2 — quote_embeddings populated AND created with a semantic provider
  // (not the deterministic stub, which would ground RAG on noise).
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(embedding)::int AS embedded,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL AND provider = 'stub')::int AS stub,
              COUNT(*) FILTER (WHERE embedding IS NOT NULL AND provider IS NULL)::int AS untagged
         FROM quote_embeddings`,
    );
    const { total = 0, embedded = 0, stub = 0, untagged = 0 } = r.rows[0] || {};
    if (embedded <= 0) {
      fail(`quote_embeddings has no embedded rows (total=${total}). Run: node scripts/training/embedQuotes.js`);
      failures++;
    } else if (stub > 0) {
      fail(
        `${stub}/${embedded} embedded rows use NON-SEMANTIC stub vectors — re-embed with a ` +
          "real key: node scripts/training/embedQuotes.js --reembed-all",
      );
      failures++;
    } else if (untagged > 0) {
      fail(
        `${untagged}/${embedded} embedded rows have no provider tag (pre-migration 0002) — ` +
          "re-embed to confirm semantic: node scripts/training/embedQuotes.js --reembed-all",
      );
      failures++;
    } else {
      ok(`quote_embeddings populated: ${embedded}/${total} rows, all semantic`);
    }
  } catch (e) {
    if (e.code === "42703") {
      fail("quote_embeddings.provider column missing — apply migrations/0002_quote_embeddings_provider.sql");
    } else {
      fail(
        `quote_embeddings missing/unreadable: ${e.message}. ` +
          "Apply migrations/0001_add_pgvector_and_quote_embeddings.sql first.",
      );
    }
    failures++;
  } finally {
    await pool.end().catch(() => {});
  }

  // Check 3 — sample retrieval (only meaningful once 1+2 pass).
  if (failures === 0) {
    try {
      const hits = await retrieveSimilarQuotes(SAMPLE_QUERY, 5, 0.4);
      if (hits.length > 0) {
        ok(`sample retrieval returned ${hits.length} hit(s) for "${SAMPLE_QUERY}"`);
      } else {
        fail(
          `sample retrieval returned 0 hits for "${SAMPLE_QUERY}" — RAG would add no ` +
            "grounding. Check the backfill and RAG_THRESHOLD.",
        );
        failures++;
      }
    } catch (e) {
      fail(`sample retrieval errored: ${e.message}`);
      failures++;
    }
  } else {
    console.log("• skipping sample-retrieval check until the above are fixed");
  }

  if (failures > 0) {
    console.error(`\nRAG pre-check FAILED (${failures} issue(s)). Do NOT set RAG_ENABLED=1 yet.`);
    process.exit(1);
  }
  console.log("\nRAG pre-check PASSED. Safe to enable RAG_ENABLED=1 (shadow first).");
}

main().catch((e) => {
  console.error("precheck crashed:", e?.message || e);
  process.exit(3);
});
