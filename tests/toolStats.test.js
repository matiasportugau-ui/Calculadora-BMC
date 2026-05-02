// ═══════════════════════════════════════════════════════════════════════════
// Contract tests for server/lib/toolStats.js
// Run: node tests/toolStats.test.js
// ═══════════════════════════════════════════════════════════════════════════

import { recordToolCall, classifyError, getToolStats, _resetToolStatsForTests } from "../server/lib/toolStats.js";
import { executeTool, AGENT_TOOLS } from "../server/lib/agentTools.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("classifyError", () => {
  assert(classifyError("requiere confirmación explícita del usuario") === "guard:user_confirmed", "user_confirmed bucket");
  assert(classifyError("BMC_SHEET_ID no configurado") === "config:missing_env", "missing_env bucket");
  assert(classifyError("WhatsApp no configurado") === "config:missing_env", "missing_env bucket (whatsapp)");
  assert(classifyError("title requerido") === "validation:required", "validation bucket");
  assert(classifyError("Cotización no encontrada") === "lookup:not_found", "not_found bucket");
  assert(classifyError("HTTP 500 al recuperar el HTML") === "network:upstream", "upstream bucket");
  assert(classifyError("Tool xyz no implementada") === "internal:unimplemented", "unimplemented bucket");
  assert(classifyError("") === "other", "empty → other");
  assert(classifyError("ruido aleatorio") === "other", "fallback → other");
});

group("recordToolCall + getToolStats — empty", () => {
  _resetToolStatsForTests();
  const stats = getToolStats();
  assert(stats.total_calls === 0, "no calls → total_calls 0");
  assert(Array.isArray(stats.tools) && stats.tools.length === 0, "no calls → tools []");
});

group("recordToolCall + aggregates", () => {
  _resetToolStatsForTests();
  recordToolCall({ tool: "calcular_cotizacion", ok: true, latencyMs: 50 });
  recordToolCall({ tool: "calcular_cotizacion", ok: true, latencyMs: 100 });
  recordToolCall({ tool: "calcular_cotizacion", ok: false, latencyMs: 200, errorClass: "validation:required" });
  recordToolCall({ tool: "generar_pdf", ok: true, latencyMs: 800 });

  const stats = getToolStats();
  assert(stats.total_calls === 4, "total 4");
  assert(stats.tools.length === 2, "2 distinct tools");

  const calc = stats.tools.find((t) => t.tool === "calcular_cotizacion");
  assert(calc, "calcular_cotizacion present");
  assert(calc.count === 3, "calc count 3");
  assert(calc.ok === 2 && calc.errors === 1, "ok=2 errors=1");
  assert(calc.error_rate === 0.333 || Math.abs(calc.error_rate - 1/3) < 0.001, "error_rate ~33%");
  assert(calc.latency_p50_ms === 100, "p50 = 100ms");
  assert(calc.latency_p95_ms === 200, "p95 = 200ms");
  assert(calc.errors_by_class["validation:required"] === 1, "validation bucket count 1");

  // Sorted by count desc — calc(3) comes before generar_pdf(1)
  assert(stats.tools[0].tool === "calcular_cotizacion", "sorted by count desc");
});

group("recordToolCall — window filter", () => {
  _resetToolStatsForTests();
  recordToolCall({ tool: "obtener_precio_panel", ok: true, latencyMs: 5 });
  // Simulate an old record by hand-pushing past the cutoff is hard with the
  // current API; instead, verify a tight 1-minute window includes the recent call.
  const stats = getToolStats({ windowMs: 60_000 });
  assert(stats.total_calls === 1, "recent call in window");
  assert(stats.tools[0].tool === "obtener_precio_panel", "tool surfaced");
});

await group("executeTool — telemetry wrapper records ok call", async () => {
  _resetToolStatsForTests();
  const raw = await executeTool("obtener_precio_panel", { familia: "ISODEC_EPS", espesor: 100, lista: "web" });
  const parsed = JSON.parse(raw);
  assert(parsed && !parsed.error, "tool ran successfully");
  const stats = getToolStats();
  assert(stats.total_calls >= 1, "telemetry recorded");
  const t = stats.tools.find((x) => x.tool === "obtener_precio_panel");
  assert(t && t.count >= 1 && t.ok >= 1, "ok call counted");
  assert(t.latency_p50_ms >= 0, "latency captured");
});

await group("executeTool — telemetry wrapper records error call with class", async () => {
  _resetToolStatsForTests();
  // Missing required field → tool returns { ok: false, error: "..." }
  await executeTool("guardar_en_crm", { pdf_url: "https://x" /* no user_confirmed */ });
  const stats = getToolStats();
  const t = stats.tools.find((x) => x.tool === "guardar_en_crm");
  assert(t && t.errors === 1, "error counted");
  assert(t.errors_by_class["guard:user_confirmed"] === 1, "classified as guard:user_confirmed");
});

group("AGENT_TOOLS not regressed by wrapper", () => {
  // Wrapper change shouldn't affect tool surface — same 22 tools should still be exported.
  assert(AGENT_TOOLS.length === 22, `22 tools exported (got ${AGENT_TOOLS.length})`);
});

console.log(`\n${"═".repeat(60)}`);
console.log(`toolStats tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) {
  process.exit(1);
}
