// ═══════════════════════════════════════════════════════════════════════════
// WA Cockpit — Ingest contract tests (offline)
// Ejecuta sin servidor: valida server/lib/waValidate.js puro.
// Ejecutar: node tests/wa-ingest-contract.js
// ═══════════════════════════════════════════════════════════════════════════

import { validateIngestBatch, validateIngestMessage } from "../server/lib/waValidate.js";

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

console.log("\n═══ WA Cockpit · F1 ingest contract ═══");

// ── batch shape ────────────────────────────────────────────────────────
{
  const r = validateIngestBatch(null);
  assert("rejects null body", !r.ok, r.ok, false);
}
{
  const r = validateIngestBatch({});
  assert("rejects body without messages", !r.ok, r.ok, false);
}
{
  const r = validateIngestBatch({ messages: [] });
  assert("rejects empty messages array", !r.ok, r.ok, false);
}
{
  const big = { messages: Array.from({ length: 501 }, (_, i) => ({ id: i })) };
  const r = validateIngestBatch(big);
  assert("rejects batch > 500", !r.ok, r.ok, false);
}
{
  const r = validateIngestBatch({ messages: [{}], live: true, operator_id: "matias", batch_id: "b1" });
  assert("accepts shape with metadata", r.ok, r.ok, true);
  assert("propagates operator_id", r.operator_id === "matias", r.operator_id, "matias");
  assert("propagates batch_id", r.batch_id === "b1", r.batch_id, "b1");
  assert("normalizes live to boolean", r.live === true, r.live, true);
}

// ── message validation ────────────────────────────────────────────────
function validMsg(extra = {}) {
  return {
    chat_id: "5491111111111@c.us",
    msg_id: "ABC123",
    ts: "2026-05-04T20:00:00.000Z",
    direction: "in",
    type: "text",
    text: "hola",
    from: { phone: "5491111111111", name: "Cliente" },
    ...extra,
  };
}

{
  const r = validateIngestMessage(validMsg());
  assert("happy path is valid", r.valid, r.valid, true);
  assert("normalized phone is E.164 format", r.normalized?.phone === "+5491111111111", r.normalized?.phone, "+5491111111111");
  assert("normalized contact_name preserved", r.normalized?.contact_name === "Cliente", r.normalized?.contact_name, "Cliente");
  assert("normalized direction kept", r.normalized?.direction === "in", r.normalized?.direction, "in");
  assert("source defaults to wa_web", r.normalized?.source === "wa_web", r.normalized?.source, "wa_web");
  assert("ts coerced to ISO", typeof r.normalized?.ts === "string" && r.normalized.ts.includes("T"), r.normalized?.ts, "ISO");
}

{
  const r = validateIngestMessage({ ...validMsg(), chat_id: "" });
  assert("rejects empty chat_id", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), msg_id: "" });
  assert("rejects empty msg_id", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), direction: "sideways" });
  assert("rejects invalid direction", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), type: "ufo" });
  assert("rejects invalid type", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), source: "telnet" });
  assert("rejects invalid source", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), ts: "not a date" });
  assert("rejects bogus ts", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), text: "x".repeat(8001) });
  assert("rejects oversized text", !r.valid, r.valid, false);
}

{
  const r = validateIngestMessage({ ...validMsg(), text: null });
  assert("accepts null text (e.g. media)", r.valid, r.valid, true);
}

{
  const r = validateIngestMessage({
    ...validMsg(),
    direction: "out",
    type: "image",
    text: null,
    raw: { id: "x", caption: null },
  });
  assert("accepts out-image with raw payload", r.valid, r.valid, true);
  assert("normalized raw kept", typeof r.normalized?.raw === "object", typeof r.normalized?.raw, "object");
}

{
  const r = validateIngestMessage({
    chat_id: "c1",
    msg_id: "m1",
    ts: 1764892800000,
    direction: "in",
    type: "text",
    text: "hi",
  });
  assert("accepts numeric ts (epoch ms)", r.valid, r.valid, true);
}

{
  const r = validateIngestMessage({
    chat_id: "c1",
    msg_id: "m2",
    ts: "2026-05-04T20:00:00Z",
    direction: "in",
    type: "text",
    text: "raw phone variant",
    phone: "+54 9 11 1111-1111",
  });
  assert(
    "phone with formatting is stripped to E.164",
    r.normalized?.phone === "+5491111111111",
    r.normalized?.phone,
    "+5491111111111",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`RESULTADOS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
