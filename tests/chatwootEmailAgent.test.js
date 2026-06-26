// ═══════════════════════════════════════════════════════════════════════════
// Tests — Chatwoot webhook normalization + Email Agent tool gating (offline)
// Ejecutar: node tests/chatwootEmailAgent.test.js
// No red, no Chatwoot, no AI: valida lógica pura (normalize, isIncoming, confirm-gate).
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert";

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, `FAIL: ${name}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

// ── 1. emailLeadIngest: schema + guard ──────────────────────────────────────
import { getEmailLeadSchema, extractEmailLead } from "../server/lib/emailLeadIngest.js";

{
  const schema = await getEmailLeadSchema();
  const parsed = schema.parse({ cliente: "Juan" });
  ok("schema fills 12 fields with defaults", Object.keys(parsed).length === 12);
  ok("schema preserves provided field", parsed.cliente === "Juan");
  ok("schema defaults empties", parsed.telefono === "");

  const empty = await extractEmailLead({ cuerpo: "" });
  ok("extractEmailLead rejects empty body", empty.ok === false && empty.error === "missing_cuerpo");
}

// ── 2. Chatwoot client: unconfigured guard ──────────────────────────────────
import { isChatwootConfigured } from "../server/lib/chatwootClient.js";
{
  const prev = { ...process.env };
  delete process.env.CHATWOOT_API_BASE;
  delete process.env.CHATWOOT_API_TOKEN;
  delete process.env.CHATWOOT_ACCOUNT_ID;
  ok("isChatwootConfigured false when unset", isChatwootConfigured() === false);
  process.env.CHATWOOT_API_BASE = "https://x";
  process.env.CHATWOOT_API_TOKEN = "t";
  process.env.CHATWOOT_ACCOUNT_ID = "1";
  ok("isChatwootConfigured true when all set", isChatwootConfigured() === true);
  Object.assign(process.env, prev);
}

// ── 3. Email Agent tools: confirm-gate on send/assign ───────────────────────
import { EMAIL_AGENT_TOOLS, executeEmailTool } from "../server/lib/emailAgentTools.js";
{
  ok("email tools registered", EMAIL_AGENT_TOOLS.length >= 11);
  const names = EMAIL_AGENT_TOOLS.map((t) => t.name);
  ok("has email_enviar_respuesta", names.includes("email_enviar_respuesta"));
  ok("has email_reporte", names.includes("email_reporte"));

  // With Chatwoot configured but no real network, send WITHOUT confirm must be
  // refused BEFORE any network call (pure gate check).
  const prev = { ...process.env };
  process.env.CHATWOOT_API_BASE = "https://x";
  process.env.CHATWOOT_API_TOKEN = "t";
  process.env.CHATWOOT_ACCOUNT_ID = "1";

  const noConfirm = await executeEmailTool("email_enviar_respuesta", {
    conversationId: 1,
    contenido: "hola",
  });
  ok("send refused without user_confirmed", noConfirm.ok === false && noConfirm.requiere_confirmacion === true);

  const assignNoConfirm = await executeEmailTool("email_asignar", {
    conversationId: 1,
    assigneeId: 2,
  });
  ok("assign refused without user_confirmed", assignNoConfirm.ok === false && assignNoConfirm.requiere_confirmacion === true);

  Object.assign(process.env, prev);
}

// ── 4. Email tools: unconfigured returns clean error (no crash) ─────────────
{
  const prev = { ...process.env };
  delete process.env.CHATWOOT_API_BASE;
  delete process.env.CHATWOOT_API_TOKEN;
  delete process.env.CHATWOOT_ACCOUNT_ID;
  const r = await executeEmailTool("email_reporte", {});
  ok("tool returns chatwoot_not_configured when unset", r.ok === false && r.error === "chatwoot_not_configured");
  Object.assign(process.env, prev);
}

console.log(`\n✅ chatwootEmailAgent: ${passed} checks passed`);
