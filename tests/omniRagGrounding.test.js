// tests/omniRagGrounding.test.js — standalone (no DB/server) unit test for the
// Phase 1 RAG-grounding citation metadata + the embedding-availability guard.
// Run: `node tests/omniRagGrounding.test.js`.
import assert from "node:assert/strict";
import { buildSuggestionMetadata } from "../server/lib/omni/orchestrator/aiWorker.js";
import { formatOmniContextBlock } from "../server/lib/omni/knowledge/kbBridge.js";
import { isSemanticEmbeddingAvailable } from "../server/lib/embeddings.js";
import { sanitizeQuoteMetadata } from "../server/lib/quoteMetadata.js";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const result = { provider: "claude", model: "claude-opus-4-7" };
const prompt = { version: 3 };

check("metadata records RAG citations when grounded", () => {
  const retrieval = {
    rag_cases: [
      { lead_id: "abc123", similarity: 0.91 },
      { lead_id: "def456", similarity: 0.82 },
    ],
    recent_snippets: ["hola", "necesito techo"],
  };
  const meta = buildSuggestionMetadata(result, prompt, retrieval);
  assert.equal(meta.provider, "claude");
  assert.equal(meta.model, "claude-opus-4-7");
  assert.equal(meta.prompt_version, 3);
  assert.deepEqual(meta.grounding.rag_case_ids, ["abc123", "def456"]);
  assert.equal(meta.grounding.rag_count, 2);
  assert.equal(meta.grounding.snippet_count, 2);
  assert.equal(meta.grounding.grounded, true);
});

check("metadata is dormant-shape when RAG off (empty cases)", () => {
  const meta = buildSuggestionMetadata(result, prompt, { rag_cases: [], recent_snippets: [] });
  assert.deepEqual(meta.grounding, {
    rag_case_ids: [],
    rag_count: 0,
    snippet_count: 0,
    grounded: false,
  });
});

check("metadata tolerates missing retrieval / null result + prompt", () => {
  const meta = buildSuggestionMetadata({}, null, undefined);
  assert.equal(meta.provider, null);
  assert.equal(meta.model, null);
  assert.equal(meta.prompt_version, null);
  assert.equal(meta.grounding.rag_count, 0);
  assert.equal(meta.grounding.grounded, false);
  assert.deepEqual(meta.grounding.rag_case_ids, []);
});

check("rag_case_ids drops cases without a lead_id (defensive)", () => {
  const meta = buildSuggestionMetadata(result, prompt, {
    rag_cases: [{ lead_id: "x1" }, { similarity: 0.5 }],
    recent_snippets: [],
  });
  assert.deepEqual(meta.grounding.rag_case_ids, ["x1"]);
  // count/grounded stay consistent with the cited ids (not the raw case count)
  assert.equal(meta.grounding.rag_count, 1);
  assert.equal(meta.grounding.grounded, true);
});

check("formatOmniContextBlock renders snippets + sanitized cases (no PII)", () => {
  const block = formatOmniContextBlock({
    recent_snippets: ["mensaje uno", "mensaje dos"],
    rag_cases: [
      {
        similarity: 0.9,
        metadata: {
          cliente_nombre: "Juan García",
          telefono: "+59899123456",
          panel_familia: "ISODEC_EPS",
          total_con_iva_usd: 12400,
        },
      },
    ],
  });
  assert.ok(block.includes("Recent thread:"));
  assert.ok(block.includes("Similar past quotes:"));
  assert.ok(block.includes("ISODEC_EPS")); // whitelisted quote fact kept
  assert.ok(!block.includes("Juan")); // customer name stripped
  assert.ok(!block.includes("59899")); // phone stripped
});

check("formatOmniContextBlock empty when no context", () => {
  assert.equal(formatOmniContextBlock({ recent_snippets: [], rag_cases: [] }), "");
});

check("isSemanticEmbeddingAvailable returns a boolean (RAG stub guard)", () => {
  // The kbBridge guard skips RAG retrieval when this is false, so RAG never
  // grounds on non-semantic stub vectors. Value depends on env key presence.
  assert.equal(typeof isSemanticEmbeddingAvailable(), "boolean");
});

check("sanitizeQuoteMetadata drops PII, keeps quote facts", () => {
  const lead = {
    fecha: "2026-03-15",
    cliente_nombre: "Juan García",
    telefono: "+59899123456",
    email: "juan@example.com",
    ubicacion: "Maldonado",
    vendedor: "María",
    panel_familia: "ISODEC_EPS",
    panel_espesor: 100,
    area_m2: 320,
    total_con_iva_usd: 12400,
  };
  const clean = sanitizeQuoteMetadata(lead);
  // PII removed
  for (const k of ["cliente_nombre", "telefono", "email", "ubicacion", "vendedor"]) {
    assert.equal(k in clean, false, `${k} must be stripped`);
  }
  // facts kept
  assert.equal(clean.fecha, "2026-03-15");
  assert.equal(clean.panel_familia, "ISODEC_EPS");
  assert.equal(clean.area_m2, 320);
  assert.equal(clean.total_con_iva_usd, 12400);
  // defensive
  assert.deepEqual(sanitizeQuoteMetadata(null), {});
  assert.deepEqual(sanitizeQuoteMetadata(undefined), {});
});

console.log(`\nomniRagGrounding: ${passed} passed`);
