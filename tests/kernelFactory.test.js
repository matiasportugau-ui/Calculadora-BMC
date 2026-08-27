// tests/kernelFactory.test.js
// Factory + living playbook + Kernel tools. No xAI network.
// Run: node tests/kernelFactory.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kernel-factory-"));
process.env.KERNEL_STORE_PATH = path.join(tmpDir, "store.json");
process.env.API_AUTH_TOKEN = "kernel-factory-test-token";
delete process.env.KERNEL_ALLOW_CODE_APPLY;
delete process.env.KERNEL_COLLECTION_ID;
delete process.env.XAI_COLLECTION_ID;

const { slugAgentId, resetStore, loadStore, saveStore } = await import("../server/lib/kernel/store.js");
const { provisionAgent, seedPanelin, listSupervisedAgents, refreshPanelinPlaybook } = await import(
  "../server/lib/kernel/provision.js"
);
const { executeKernelTool, searchCode, readSourceFile, normalizeRepoPath } = await import(
  "../server/lib/kernel/tools.js"
);
const { buildKernelSessionBootstrap } = await import(
  "../server/lib/kernel/kernelSessionConfig.js"
);
const { kernelToolDefsForSession, KERNEL_TOOL_NAMES } = await import(
  "../server/lib/kernel/kernelTools.js"
);
const { default: kernelRouter } = await import("../server/routes/kernel.js");
const { default: agentVoiceRouter } = await import("../server/routes/agentVoice.js");
const { config } = await import("../server/config.js");

config.grokApiKey = config.grokApiKey || ("xai-" + "k".repeat(48));
process.env.GROK_API_KEY = config.grokApiKey;

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

console.log("\n— kernelFactory\n");

resetStore();
seedPanelin();

ok(slugAgentId("Calc Assistant") === "calc-assistant", "slug Calc Assistant");
ok(slugAgentId("Núcleo X") === "nucleo-x", "slug strips accents");

{
  const listed = listSupervisedAgents();
  ok(listed.agents.some((a) => a.agent_id === "panelin"), "seeds panelin");
  ok(listed.activeAgentId === "panelin", "default active is panelin");
}

const created = provisionAgent({
  name: "Calc Assistant",
  role: "help the operator use Calculadora",
  language: "es",
});
ok(created.agent_id === "calc-assistant", "provision agent_id");
ok(created.playbook.includes("Calc Assistant"), "playbook has name");
ok(created.playbook.includes("never invent calculation"), "playbook contract");
ok(!created.playbook.includes("You are Kernel"), "new agent does not copy Kernel playbook");

try {
  provisionAgent({ name: "Calc Assistant", role: "dup" });
  ok(false, "duplicate provision throws");
} catch (err) {
  ok(err.status === 409, "duplicate provision → 409");
}

try {
  provisionAgent({ name: "", role: "x" });
  ok(false, "empty name throws");
} catch (err) {
  ok(err.status === 400, "empty name → 400");
}

{
  const ingest1 = executeKernelTool("ingest_conversation_turn", {
    speaker: "operator",
    role: "operator",
    text: "eso está mal",
    addressed_to: "kernel",
    timestamp: "2026-08-26T12:00:00.000Z",
  });
  const ingest2 = executeKernelTool("ingest_conversation_turn", {
    speaker: "operator",
    role: "operator",
    text: "eso está mal",
    addressed_to: "kernel",
    timestamp: "2026-08-26T12:00:00.000Z",
  });
  ok(ingest1.ok && ingest1.duplicate === false, "first turn stored");
  ok(ingest2.ok && ingest2.duplicate === true, "duplicate turn skipped");
}

{
  executeKernelTool("ingest_conversation_turn", {
    speaker: "operator",
    role: "operator",
    text: "Hola, Kernel.",
    addressed_to: "kernel",
    timestamp: "2026-08-27T01:19:24.668Z",
  });
  const g1 = executeKernelTool("ingest_conversation_turn", {
    speaker: "operator",
    role: "operator",
    text: "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
    addressed_to: "kernel",
    timestamp: "2026-08-27T01:19:26.845Z",
  });
  const g2 = executeKernelTool("ingest_conversation_turn", {
    speaker: "operator",
    role: "operator",
    text: "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
    addressed_to: "kernel",
    timestamp: "2026-08-27T01:19:29.438Z",
  });
  ok(g1.merged === true, "growing ASR prefix merges into last turn");
  ok(g2.merged === true, "identical final ASR merges");
  const conv = executeKernelTool("read_conversation_log", { speaker: "operator", limit: 20 });
  const hola = (conv.turns || []).filter((t) => /una sola vez/i.test(t.text));
  ok(hola.length === 1, "one spoken sentence stored once");
}

{
  const ev = executeKernelTool("ingest_app_event", {
    type: "calc.evaluate",
    source: "engine",
    severity: "info",
    payload: JSON.stringify({ scenario: "techo" }),
  });
  ok(ev.ok, "app event stored");
  const log = executeKernelTool("read_event_log", { types: "calc.evaluate", limit: 10 });
  ok(log.ok && log.events.length >= 1, "read_event_log returns evaluate");
}

{
  const conv = executeKernelTool("read_conversation_log", { limit: 20 });
  ok(conv.ok && conv.turns.some((t) => t.text === "eso está mal"), "conversation log");
}

{
  executeKernelTool("ingest_app_event", {
    type: "snapshot",
    source: "ui",
    severity: "debug",
    payload: "{}",
  });
  const snap = executeKernelTool("read_project_snapshot", {});
  ok(snap.ok && snap.snapshot.activeAgentId, "snapshot has activeAgentId");
}

{
  const pb = executeKernelTool("read_playbook", { agent_id: "calc-assistant" });
  ok(pb.ok && pb.playbook.includes("Calc Assistant"), "read_playbook");
  const blocked = executeKernelTool("apply_playbook_patch", {
    agent_id: "calc-assistant",
    patch: "ALWAYS say the lista de precios before the total.",
    reason: "forgot price list",
  });
  ok(blocked.ok === false, "observe mode cannot apply_playbook_patch");
  const modePatch = executeKernelTool("set_mode", { mode: "patch", user_confirmed: true });
  ok(modePatch.ok && modePatch.mode === "patch", "set_mode patch with confirm");
  const patched = executeKernelTool("apply_playbook_patch", {
    agent_id: "calc-assistant",
    patch: "ALWAYS say the lista de precios before the total.",
    reason: "forgot price list",
    user_confirmed: true,
  });
  ok(patched.ok && patched.reload === true && patched.version >= 2, "apply_playbook_patch bumps version");
  const after = executeKernelTool("read_playbook", { agent_id: "current" });
  ok(after.playbook.includes("lista de precios"), "patched playbook visible");
}

{
  const imp = executeKernelTool("append_improvement", {
    title: "agente inventó un total",
    symptom: "dijo un número sin tool",
    internal_cause: "playbook no forzaba calc tool",
    evidence: "turn abc",
    proposed_fix: "ALWAYS emit numbers from calc tool",
    target: "agent",
    agent_id: "calc-assistant",
  });
  ok(imp.ok && imp.improvement.id, "append_improvement");
  const log = executeKernelTool("read_improvement_log", { status: "open" });
  ok(log.items.some((i) => i.title.includes("inventó")), "improvement log");
}

{
  const mode = executeKernelTool("set_mode", { mode: "report" });
  ok(mode.ok && mode.mode === "report", "set_mode report without confirm");
}

{
  const prop = executeKernelTool("propose_code_change", {
    title: "tiny",
    files: "src/hooks/useVoiceSession.js",
    diff: "not a real apply",
    reason: "test",
  });
  ok(prop.ok && prop.proposal_id, "propose_code_change stages");
  executeKernelTool("set_mode", { mode: "patch", user_confirmed: true });
  const applied = executeKernelTool("apply_code_change", {
    proposal_id: prop.proposal_id,
    user_confirmed: true,
  });
  ok(applied.ok === false && applied.staged === true, "apply_code_change refused without env");
}

ok(normalizeRepoPath("../.env") == null, "reject path traversal");
ok(normalizeRepoPath("src/hooks/useVoiceSession.js"), "allow src/");
ok(normalizeRepoPath("node_modules/foo.js") == null, "deny node_modules");

{
  const denied = readSourceFile(".env");
  ok(denied.ok === false, "read_source_file denies .env");
  const src = readSourceFile("src/utils/grokRealtimeTransport.js");
  ok(src.ok && src.content.includes("buildGrokSessionUpdate"), "read_source_file allowlist hit");
}

{
  const hits = searchCode({ query: "buildGrokSessionUpdate", path_glob: "src/**/*.js" });
  ok(hits.ok && hits.hits.length >= 1, "search_code finds transport helper");
  const literal = searchCode({ query: "(a+)+$", path_glob: "src/**/*.js" });
  ok(literal.ok, "search_code treats nested quantifiers as literal");
}

{
  const boot = buildKernelSessionBootstrap("calc-assistant");
  const names = (boot.tools || []).map((t) => t.name || t.type);
  ok(boot.voice === "rigel", "kernel voice rigel");
  ok(boot.turn_detection.idle_timeout_ms === null, "kernel idle_timeout null");
  ok(names.includes("ingest_conversation_turn"), "kernel has ingest_conversation_turn");
  ok(!names.includes("calcular_cotizacion"), "kernel does not get calc tools");
  ok(boot.instructions.includes("calc-assistant"), "kernel facts include agent_id");
  ok(!names.includes("file_search"), "no file_search without collection id");
}

ok(KERNEL_TOOL_NAMES.includes("apply_playbook_patch"), "tool name list");
ok(
  kernelToolDefsForSession().every((t) => t.type === "function"),
  "session tools are functions without collection",
);
ok(
  !kernelToolDefsForSession().some((t) => t.name === "apply_playbook_patch"),
  "observe session hides apply_playbook_patch",
);
ok(
  kernelToolDefsForSession("patch").some((t) => t.name === "apply_playbook_patch"),
  "patch session attaches apply_playbook_patch",
);

{
  const rep = executeKernelTool("deliver_report", {
    kind: "incident",
    summary: "el agente habló un total sin tool",
  });
  ok(rep.ok && rep.report.kind === "incident", "deliver_report");
}

// HTTP surface
const app = express();
app.use(express.json());
app.use("/api", kernelRouter);
app.use("/api", agentVoiceRouter);
const server = await new Promise((resolve) => {
  const s = http.createServer(app);
  s.listen(0, () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const token = process.env.API_AUTH_TOKEN;

async function req(pathname, opts = {}) {
  const res = await fetch(`${base}${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

{
  const unauth = await fetch(`${base}/api/kernel/agents`);
  ok(unauth.status === 401, "GET agents without auth → 401");
}

{
  const list = await req("/api/kernel/agents");
  ok(list.status === 200 && list.json.ok, "GET /api/kernel/agents");
  ok(list.json.agents.some((a) => a.agent_id === "calc-assistant"), "list includes factory agent");
}

{
  const one = await req("/api/kernel/agents/calc-assistant");
  ok(one.json.agent?.playbook.includes("lista de precios"), "GET agent playbook includes patch");
}

{
  const boot = await req("/api/kernel/session-bootstrap?agent_id=calc-assistant");
  ok(boot.json.ok && boot.json.tool_names.includes("read_playbook"), "session-bootstrap tool names");
  ok(!boot.json.tool_names.includes("calcular_cotizacion"), "bootstrap is Kernel not calc");
}

{
  const made = await req("/api/kernel/agents", {
    method: "POST",
    body: JSON.stringify({ name: "Techo Guide", role: "explica techos IsoDec" }),
  });
  ok(made.status === 201 && made.json.agent_id === "techo-guide", "POST provision");
}

{
  const turn = await req("/api/kernel/events", {
    method: "POST",
    body: JSON.stringify({
      kind: "turn",
      speaker: "operator",
      role: "operator",
      text: "Kernel, reporte",
      addressed_to: "kernel",
    }),
  });
  ok(turn.json.ok, "host bus turn");
}

{
  const tool = await req("/api/kernel/tool", {
    method: "POST",
    body: JSON.stringify({
      name: "read_playbook",
      arguments: { agent_id: "techo-guide" },
    }),
  });
  ok(tool.json.ok && String(tool.json.result?.playbook || "").includes("Techo Guide"), "POST kernel/tool");
}

{
  const bad = await req("/api/kernel/tool", {
    method: "POST",
    body: JSON.stringify({ name: "calcular_cotizacion", arguments: {} }),
  });
  ok(bad.status === 400, "calc tool rejected on kernel/tool");
}

{
  const reload = await req("/api/kernel/reload/calc-assistant", { method: "POST" });
  ok(reload.json.ok && reload.json.instructions.includes("lista de precios"), "reload returns patched playbook");
}

{
  executeKernelTool("set_mode", { mode: "patch", user_confirmed: true });
  executeKernelTool("apply_playbook_patch", {
    agent_id: "panelin",
    patch: "KERNEL-RESET-MARKER",
    reason: "test reset",
    user_confirmed: true,
  });
  ok(Number(loadStore().agents.panelin.version) > 1, "panelin version bumped");
  const store = loadStore();
  refreshPanelinPlaybook(store);
  saveStore(store);
  ok(Number(store.agents.panelin.version) === 1, "reset restores panelin version 1");
  ok(!String(store.agents.panelin.playbook).includes("KERNEL-RESET-MARKER"), "reset restores seed playbook");
  const panelinReload = await req("/api/kernel/reload/panelin", { method: "POST" });
  ok(
    panelinReload.json.ok
      && String(panelinReload.json.instructions).includes("You are Panelin, a friendly"),
    "panelin reload returns Voice Brain Pack",
  );
  ok(
    !String(panelinReload.json.instructions).includes("KERNEL-RESET-MARKER"),
    "reset panelin reload has no living patches",
  );
}

{
  const a = loadStore();
  const b = loadStore();
  ok(a === b, "loadStore returns in-process singleton");
  a.activeAgentId = "calc-assistant";
  b.conversation.push({ id: "overlap", speaker: "operator", role: "operator", text: "x", timestamp: new Date().toISOString() });
  saveStore(a);
  const again = loadStore();
  ok(again.activeAgentId === "calc-assistant" && again.conversation.some((t) => t.id === "overlap"), "overlapping writers share memory");
}

// Dual mint bootstrap (mocked xAI)
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.x.ai/v1/realtime/client_secrets")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: "sess_kernel_test",
        model: "grok-voice-latest",
        client_secret: { value: "xai-ek_kernel", expires_at: Date.now() / 1000 + 60 },
      }),
      text: async () => "{}",
    };
  }
  return realFetch(url, init);
};

{
  const k = await req("/api/agent/voice/session", {
    method: "POST",
    body: JSON.stringify({
      aiProvider: "grok",
      kernelRole: "kernel",
      agentId: "calc-assistant",
    }),
  });
  const names = (k.json.session_bootstrap?.tools || []).map((t) => t.name || t.type);
  ok(k.status === 200 && k.json.kernel_role === "kernel", "voice/session kernelRole=kernel");
  ok(names.includes("ingest_conversation_turn"), "kernel mint tools include ingest");
  ok(!names.includes("calcular_cotizacion"), "kernel mint has no calc tools");
  ok(k.json.session_bootstrap?.voice === "rigel", "kernel mint voice rigel");
}

{
  const a = await req("/api/agent/voice/session", {
    method: "POST",
    body: JSON.stringify({
      aiProvider: "grok",
      kernelRole: "agent",
      agentId: "calc-assistant",
    }),
  });
  const names = (a.json.session_bootstrap?.tools || []).map((t) => t.name || t.type);
  ok(a.status === 200 && a.json.agent_id === "calc-assistant", "voice/session agent factory id");
  ok(names.includes("calcular_cotizacion"), "agent mint keeps calc tools");
  ok(!names.includes("ingest_conversation_turn"), "agent mint has no kernel ingest");
  ok(String(a.json.session_bootstrap?.instructions || "").includes("lista de precios"), "agent mint uses living playbook");
}

globalThis.fetch = realFetch;
await new Promise((resolve) => server.close(resolve));

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch { /* ignore */ }

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
