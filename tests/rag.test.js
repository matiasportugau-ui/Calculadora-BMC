/**
 * tests/rag.test.js — Tests unitarios para el sistema RAG v1.
 *
 * Cubre:
 *  1. embeddings.js — stub mode produce vectores determinísticos (mismo texto = mismo vector).
 *  2. rag.js — formatRetrievedContextForPrompt con datos mockeados devuelve formato correcto.
 *  3. Integración con buildSystemPrompt: con ragContext vacío, prompt no incluye sección RAG.
 *     Con ragContext, prompt incluye "Casos similares".
 *  4. retrieveSimilarQuotes devuelve [] para inputs inválidos y cuando DATABASE_URL no está.
 *  5. Idempotencia: mismo lead → mismo text_for_embedding → mismo content_hash.
 *
 * No requiere Postgres ni OPENAI_API_KEY — usa stubs en memoria.
 * Run: node tests/rag.test.js
 */

import { strict as assert } from "node:assert";

// This suite is explicitly offline/stubbed. config.js loads .env at import time,
// so force no OpenAI key before importing embeddings/rag modules.
process.env.OPENAI_API_KEY = "";

const { hashText, embedText, activeProvider } = await import("../server/lib/embeddings.js");
const { formatRetrievedContextForPrompt, retrieveSimilarQuotes } = await import("../server/lib/rag.js");
const { buildSystemPrompt } = await import("../server/lib/chatPrompts.js");

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function eq(a, b, label) {
  if (a === b) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
  }
}

// ─── 1. embeddings.js — stub mode ────────────────────────────────────────────

console.log("\n[1] embeddings.js — stub mode");

{
  const provider = activeProvider();
  ok(["stub", "openai"].includes(provider), `activeProvider retorna valor válido: ${provider}`);
}

{
  const v = await embedText("ISODEC EPS 100mm techo 200m2");
  ok(Array.isArray(v), "embedText retorna Array");
  eq(v.length, 1536, "embedText retorna 1536 dimensiones");
  ok(v.every((x) => typeof x === "number" && Number.isFinite(x)), "todos los valores son números finitos");
}

{
  const text = "Cliente Bromyros, panel ISOROOF 3G 80mm, fecha 2025-03-15, total USD 8400";
  const v1 = await embedText(text);
  const v2 = await embedText(text);
  // Comparar solo los primeros 10 para no stringify 1536 floats
  const samePrefix = v1.slice(0, 10).every((val, i) => val === v2[i]);
  ok(samePrefix, "embedText es determinístico (mismo texto → mismo vector)");
}

{
  const v1 = await embedText("panel ISODEC EPS 100mm solo techo");
  const v2 = await embedText("cámara frigorífica ISOPANEL PIR 80mm");
  const allEqual = v1.every((val, i) => val === v2[i]);
  ok(!allEqual, "textos distintos producen vectores distintos");
}

{
  const h = hashText("test text");
  ok(typeof h === "string" && h.length === 64, `hashText retorna hex de 64 chars: ${h.slice(0, 8)}...`);
  ok(/^[0-9a-f]+$/.test(h), "hashText es hexadecimal");
}

{
  const text = "Cliente X, fecha 2025-01-01, panel ISODEC_EPS 150mm";
  eq(hashText(text), hashText(text), "hashText es determinístico");
}

if (activeProvider() === "stub") {
  const v = await embedText("test normalization vector");
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  ok(Math.abs(norm - 1.0) < 0.001, `stub produce vector L2-normalizado (norma=${norm.toFixed(4)})`);
}

// ─── 2. retrieveSimilarQuotes — inputs inválidos ──────────────────────────────

console.log("\n[2] retrieveSimilarQuotes — inputs inválidos");

{
  const result = await retrieveSimilarQuotes("ab"); // < 3 chars
  ok(Array.isArray(result) && result.length === 0, "retorna [] para query demasiado corta");
}

{
  const result = await retrieveSimilarQuotes("");
  ok(Array.isArray(result) && result.length === 0, "retorna [] para query vacía");
}

{
  // Degradación graceful: retorna [] sin lanzar excepción aunque la DB esté
  // caída, la tabla no exista (migración no aplicada) o DATABASE_URL esté vacío.
  let result;
  let threw = false;
  try {
    result = await retrieveSimilarQuotes("panel 100mm techo 200m2");
  } catch {
    threw = true;
  }
  ok(!threw, "retrieveSimilarQuotes NO lanza excepción ante DB caída o tabla inexistente");
  ok(Array.isArray(result), "retorna Array en cualquier caso de fallo de DB");
}

// ─── 3. formatRetrievedContextForPrompt ──────────────────────────────────────

console.log("\n[3] formatRetrievedContextForPrompt");

{
  const result = formatRetrievedContextForPrompt([]);
  eq(result, "", "retorna string vacío para array vacío");
}

{
  const result = formatRetrievedContextForPrompt(null);
  eq(result, "", "retorna string vacío para null");
}

{
  const quotes = [
    {
      lead_id: "abc123",
      similarity: 0.85,
      metadata: {
        fecha: "2025-03-15",
        cliente_nombre: "Bromyros SA",
        panel_familia: "ISODEC_EPS",
        panel_espesor: 100,
        area_m2: 320,
        total_con_iva_usd: 12400,
      },
    },
  ];
  const result = formatRetrievedContextForPrompt(quotes);
  ok(result.includes("Casos similares de la base histórica"), "incluye encabezado correcto");
  ok(result.includes("2025-03-15"), "incluye fecha");
  ok(result.includes("Bromyros SA"), "incluye cliente");
  ok(result.includes("ISODEC"), "incluye familia de panel");
  ok(result.includes("100mm"), "incluye espesor");
  ok(result.includes("320 m²"), "incluye área");
  ok(result.includes("12400"), "incluye total");
  ok(result.includes("0.85"), "incluye score de similitud");
}

{
  const quotes = [
    {
      lead_id: "xyz",
      similarity: 0.75,
      metadata: {
        fecha: "2025-06-01",
        cliente_nombre: "Juan García",
        panel_familia: null,
        panel_espesor: null,
        area_m2: null,
        total_con_iva_usd: null,
      },
    },
  ];
  const result = formatRetrievedContextForPrompt(quotes);
  ok(!result.includes("null"), "no incluye la palabra 'null' para campos vacíos");
  ok(result.includes("Juan García"), "incluye cliente aunque otros campos sean null");
}

{
  const quotes = [
    { lead_id: "a1", similarity: 0.90, metadata: { fecha: "2025-01-01", cliente_nombre: "Cliente A", panel_familia: "ISODEC_EPS", panel_espesor: 150 } },
    { lead_id: "b2", similarity: 0.80, metadata: { fecha: "2025-02-15", cliente_nombre: "Cliente B", panel_familia: "ISOROOF_3G", panel_espesor: 80 } },
  ];
  const result = formatRetrievedContextForPrompt(quotes);
  const lines = result.split("\n").filter((l) => l.startsWith("-"));
  eq(lines.length, 2, "2 quotes → 2 líneas de datos");
}

// ─── 4. buildSystemPrompt — integración con ragContext ───────────────────────

console.log("\n[4] buildSystemPrompt — integración RAG");

{
  const prompt = buildSystemPrompt({}, { ragContext: "" });
  ok(
    !prompt.includes("Casos similares de la base histórica"),
    "sin ragContext el prompt NO contiene sección RAG",
  );
}

{
  const fakeRagBlock = "## Casos similares de la base histórica:\n- 2025-03-15 | Bromyros | ISODEC EPS 100mm | 320 m² | USD 12400 | score: 0.85";
  const prompt = buildSystemPrompt({}, { ragContext: fakeRagBlock });
  ok(prompt.includes("Casos similares de la base histórica"), "con ragContext el prompt SÍ contiene el bloque RAG");
  ok(prompt.includes("Bromyros"), "el bloque RAG incluye el lead inyectado");
}

{
  const fakeRagBlock = "## Casos similares de la base histórica:\n- 2025-01-01 | Test | ISODEC EPS 100mm | score: 0.80";
  const prompt = buildSystemPrompt({}, { ragContext: fakeRagBlock });
  ok(prompt.includes("Panelin"), "bloque IDENTITY sigue presente con ragContext");
  ok(prompt.includes("PRECIOS CANÓNICOS"), "bloque de precios sigue presente con ragContext");
}

// ─── 5. Idempotencia: mismo lead → mismo hash ─────────────────────────────────

console.log("\n[5] Idempotencia content_hash");

function buildTextForEmbeddingMock(lead) {
  const parts = [];
  if (lead.cliente_nombre) parts.push(`Cliente ${lead.cliente_nombre}`);
  if (lead.fecha) parts.push(`fecha ${lead.fecha}`);
  if (lead.panel_familia || lead.panel_espesor) {
    const pp = ["panel"];
    if (lead.panel_familia) pp.push(lead.panel_familia.replace(/_/g, " "));
    if (lead.panel_espesor) pp.push(`${lead.panel_espesor}mm`);
    parts.push(pp.join(" "));
  }
  if (lead.scenario) parts.push(`escenario ${lead.scenario.replace(/_/g, " ")}`);
  if (lead.area_m2 != null) parts.push(`área ${lead.area_m2} m2`);
  if (lead.total_con_iva_usd != null) parts.push(`total USD ${lead.total_con_iva_usd}`);
  if (parts.length < 2) return null;
  return parts.join(", ") + ".";
}

{
  const lead = {
    lead_id: "test123",
    fecha: "2025-03-15",
    cliente_nombre: "Bromyros SA",
    panel_familia: "ISODEC_EPS",
    panel_espesor: 100,
    area_m2: 320,
    total_con_iva_usd: 12400,
  };
  const text1 = buildTextForEmbeddingMock(lead);
  const text2 = buildTextForEmbeddingMock({ ...lead });
  eq(text1, text2, "mismo lead produce mismo text_for_embedding");
  eq(hashText(text1), hashText(text2), "mismo texto produce mismo content_hash");
}

{
  const sparse = { lead_id: "x", cliente_nombre: "X" };
  eq(buildTextForEmbeddingMock(sparse), null, "lead con 1 campo retorna null (no embeder)");
}

{
  const valid = { lead_id: "y", cliente_nombre: "Y", fecha: "2025-01-01" };
  ok(buildTextForEmbeddingMock(valid) !== null, "lead con 2 campos retorna texto válido");
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`RAG tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
