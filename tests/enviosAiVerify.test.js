/**
 * Offline pins for server/lib/enviosAiVerify.js (#1019 glue).
 * HTTP routes mock runEnviosAiVerify; this covers LLM error mapping + proposal normalize.
 * Run: node tests/enviosAiVerify.test.js
 */
import assert from "node:assert/strict";
import { runEnviosAiVerify } from "../server/lib/enviosAiVerify.js";

const STOP = {
  cliente: "Alvaro",
  telefono: "",
  direccion: "Maldonado",
  rawSheetText: "ENCARGO Cotizacion-Isodec-100-mm.pdf 10 paneles",
  pdfText: "ISODEC EPS 100 mm — 10 paneles L=6.00",
};

console.log("enviosAiVerify — LLM throw → ai_failed (no network)");
{
  const err = Object.assign(new Error("credit_balance_exhausted"), { details: { status: 429 } });
  let seenMax = null;
  const out = await runEnviosAiVerify(STOP, {
    maxTokens: 900,
    callAiCompletion: async (args) => {
      seenMax = args.maxTokens;
      throw err;
    },
  });
  assert.equal(out.ok, false);
  assert.equal(out.error, "ai_failed");
  assert.match(String(out.message), /credit_balance_exhausted/);
  assert.equal(out.details?.status, 429);
  assert.equal(out.proposal.ok, false);
  assert.ok(out.evidence.sources.some((s) => s.id === "ventas_row"));
  assert.equal(seenMax, 900, "maxTokens must reach callAiCompletion");
}

console.log("enviosAiVerify — structured proposal → ok + provider + truncated rawPreview");
{
  const json = {
    confidence: "alta",
    notes: ["Desde filename"],
    needsHuman: [],
    fields: { telefono: "099111222" },
    paneles: [{ tipo: "ISODEC", espesor: 100, longitud: 6, cantidad: 10 }],
    accesorios: [],
    replacePaneles: true,
  };
  const longTail = "Z".repeat(800);
  const out = await runEnviosAiVerify(STOP, {
    callAiCompletion: async () => ({
      text: `${JSON.stringify(json)}\n${longTail}`,
      provider: "grok",
    }),
  });
  assert.equal(out.ok, true);
  assert.equal(out.provider, "grok");
  assert.equal(out.proposal.ok, true);
  assert.equal(out.proposal.paneles[0].tipo, "ISODEC");
  assert.equal(out.proposal.paneles[0].cantidad, 10);
  assert.equal(out.proposal.fields.telefono, "099111222");
  assert.equal(out.rawPreview.length, 500);
  assert.equal(out.rawPreview.endsWith("Z".repeat(10)) || out.rawPreview.includes("ISODEC"), true);
}

console.log("enviosAiVerify — needsHuman still ok even if parse is weak");
{
  const out = await runEnviosAiVerify(
    { cliente: "A" },
    {
      callAiCompletion: async () => ({
        text: JSON.stringify({ confidence: "baja", needsHuman: ["confirmar espesor"], paneles: [] }),
        provider: "gemini",
      }),
    },
  );
  assert.equal(out.ok, true, "needsHuman must keep ok true so the operator modal still opens");
  assert.deepEqual(out.proposal.needsHuman, ["confirmar espesor"]);
}

console.log("  ✅ enviosAiVerify asserts passed\n");
