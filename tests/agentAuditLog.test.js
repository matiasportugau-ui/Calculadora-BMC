// ═══════════════════════════════════════════════════════════════════════════
// Unit tests for server/lib/agentAuditLog.js — durable agent tool audit log
//
// Run: node tests/agentAuditLog.test.js
//
// Strategy: pass a custom sink to recordAgentToolCall so we capture the
// emitted JSON line in-memory and assert on its shape, without touching
// global console.log.
// ═══════════════════════════════════════════════════════════════════════════

import { recordAgentToolCall, bearerFingerprint, __testing } from "../server/lib/agentAuditLog.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${label}`); }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

// Capture sink that records every line emitted.
function makeSink() {
  const lines = [];
  return { sink: (s) => lines.push(s), lines };
}

// ── shape and required fields ────────────────────────────────────────────────

await group("emits one JSON line with the canonical schema", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "calcular_cotizacion",
    source: "chat",
    caller: "chat:abc",
    input: { lista: "web", scenario: "solo_techo" },
    ok: true,
    duration_ms: 142,
    request_id: "req-1",
  }, sink);
  assert(lines.length === 1, "exactly one line emitted");
  const obj = JSON.parse(lines[0]);
  assert(obj.event === "agent_tool_audit", "event tag set");
  assert(obj.tool === "calcular_cotizacion", "tool name preserved");
  assert(obj.source === "chat", "source preserved");
  assert(obj.caller === "chat:abc", "caller preserved");
  assert(obj.ok === true, "ok flag set");
  assert(obj.error_class === null, "error_class null when ok");
  assert(obj.duration_ms === 142, "duration preserved");
  assert(typeof obj.timestamp === "string" && obj.timestamp.includes("T"), "ISO timestamp present");
  assert(obj.request_id === "req-1", "request id preserved");
});

await group("error path includes error_class and ok=false", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "guardar_en_crm",
    source: "mcp",
    caller: "mcp:abc123def456",
    input: { cliente: "Juan", user_confirmed: true },
    ok: false,
    error_class: "config:missing_env",
    duration_ms: 8,
  }, sink);
  const obj = JSON.parse(lines[0]);
  assert(obj.ok === false, "ok=false");
  assert(obj.error_class === "config:missing_env", "error_class preserved");
});

await group("source defaults to 'chat' when not 'mcp'", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({ tool: "x", source: "weird", input: {}, ok: true, duration_ms: 0 }, sink);
  const obj = JSON.parse(lines[0]);
  assert(obj.source === "chat", "unknown source coerced to chat");
});

// ── input redaction ──────────────────────────────────────────────────────────

await group("redacts free-text fields to length only", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: {
      mensaje: "Hola, quiero cotizar 200 metros de techo isodec eps 80mm para mi galpón",
      consulta: "¿cuánto sale?",
      observaciones: "alguna observación con datos potencialmente sensibles",
    },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  const s = obj.input_summary;
  assert(s.mensaje === undefined, "raw mensaje not present");
  assert(typeof s.mensaje_len === "number" && s.mensaje_len > 0, "mensaje_len present");
  assert(s.consulta === undefined && typeof s.consulta_len === "number", "consulta redacted");
  assert(s.observaciones === undefined && typeof s.observaciones_len === "number", "observaciones redacted");
});

await group("hashes identifying fields (telefono / pdf_id / rut)", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: {
      telefono: "099123456",
      pdf_id: "9c4b71ab-1234-5678",
      rut: "210123450017",
      to: "59899123456",
    },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  const s = obj.input_summary;
  assert(s.telefono === undefined, "raw telefono not present");
  assert(typeof s.telefono_fp === "string" && s.telefono_fp.length === 12, "telefono_fp is 12-char hex");
  assert(typeof s.pdf_id_fp === "string" && s.pdf_id_fp.length === 12, "pdf_id_fp present");
  assert(typeof s.rut_fp === "string" && s.rut_fp.length === 12, "rut_fp present");
  assert(typeof s.to_fp === "string" && s.to_fp.length === 12, "to_fp present");
});

await group("preserves safe scalar fields untouched", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: {
      lista: "web",
      escenario: "solo_techo",
      m2: 200,
      user_confirmed: true,
    },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  const s = obj.input_summary;
  assert(s.lista === "web", "lista preserved");
  assert(s.escenario === "solo_techo", "escenario preserved");
  assert(s.m2 === 200, "m2 number preserved");
  assert(s.user_confirmed === true, "boolean preserved");
});

await group("truncates long non-redacted strings", () => {
  const { sink, lines } = makeSink();
  const long = "x".repeat(200);
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: { color: long },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  assert(obj.input_summary.color.length < long.length, "long string truncated");
  assert(obj.input_summary.color.endsWith("…"), "truncation marker present");
});

await group("arrays are summarized to count only", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: { items: [1, 2, 3, 4, 5] },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  assert(obj.input_summary.items === undefined, "raw array not present");
  assert(obj.input_summary.items_count === 5, "items_count = 5");
});

await group("nested objects shallow-redacted (cliente.telefono fingerprinted)", () => {
  const { sink, lines } = makeSink();
  recordAgentToolCall({
    tool: "x",
    source: "chat",
    input: {
      cliente: {
        nombre: "Juan",
        telefono: "099123456",
        observaciones: "comentario muy largo con datos",
      },
    },
    ok: true,
    duration_ms: 1,
  }, sink);
  const obj = JSON.parse(lines[0]);
  const c = obj.input_summary.cliente;
  assert(typeof c === "object", "cliente is an object");
  assert(c.telefono === undefined && typeof c.telefono_fp === "string", "nested telefono fingerprinted");
  assert(c.observaciones === undefined && typeof c.observaciones_len === "number", "nested free-text redacted");
  assert(c.nombre === "Juan", "nested safe scalar preserved");
});

// ── bearerFingerprint helper ─────────────────────────────────────────────────

await group("bearerFingerprint", () => {
  assert(bearerFingerprint(null) === null, "null → null");
  assert(bearerFingerprint("") === null, "empty → null");
  const fp1 = bearerFingerprint("Bearer abc123secret");
  const fp2 = bearerFingerprint("Bearer abc123secret");
  const fp3 = bearerFingerprint("Bearer different");
  assert(fp1 === fp2, "deterministic for same token");
  assert(fp1 !== fp3, "different for different token");
  assert(typeof fp1 === "string" && fp1.length === 12, "12-char hex");
  assert(/^[0-9a-f]+$/.test(fp1), "lowercase hex chars only");
  // Token without "Bearer " prefix is still hashed
  const fp4 = bearerFingerprint("just-a-token");
  assert(typeof fp4 === "string" && fp4.length === 12, "raw token also fingerprinted");
});

// ── never throws ─────────────────────────────────────────────────────────────

await group("recordAgentToolCall never throws on weird inputs", () => {
  const { sink } = makeSink();
  recordAgentToolCall({}, sink);
  recordAgentToolCall({ tool: 123, source: null, input: "string-not-object", ok: 1, duration_ms: "bad" }, sink);
  recordAgentToolCall({ tool: "x", input: null, ok: false }, sink);
  passed++; // if we got here, none threw
});

await group("sink that throws is swallowed", () => {
  const throwingSink = () => { throw new Error("log pipeline down"); };
  // Should not throw to caller
  recordAgentToolCall({ tool: "x", source: "chat", input: {}, ok: true, duration_ms: 1 }, throwingSink);
  passed++; // if we got here, the throw was swallowed
});

// ── summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`agentAuditLog tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
