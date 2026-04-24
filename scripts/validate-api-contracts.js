#!/usr/bin/env node
/**
 * BMC API Contract Validator
 * Validates API responses against canonical contract (dashboard /api/*, calculator /calc/*, GET /capabilities).
 * Run: BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js
 * Requires: server running (npm run start:api)
 */
const BASE = process.env.BMC_API_BASE || "http://localhost:3001";

async function fetchJson(path, options = {}) {
  const { method, body, headers: extraHeaders, ...rest } = options;
  const headers = { ...(extraHeaders || {}) };
  const opts = { method: method || "GET", headers, ...rest };
  if (body != null) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function hasKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return false;
  return keys.every((k) => k in obj);
}

function checkKpiFinanciero(data) {
  const required = ["ok", "pendingPayments", "calendar", "byPeriod", "byCurrency", "currencies", "metas"];
  if (!hasKeys(data, required)) return { ok: false, msg: `Missing keys: ${required.filter((k) => !(k in data)).join(", ")}` };
  if (!Array.isArray(data.pendingPayments)) return { ok: false, msg: "pendingPayments must be array" };
  if (!Array.isArray(data.calendar)) return { ok: false, msg: "calendar must be array" };
  if (!Array.isArray(data.currencies)) return { ok: false, msg: "currencies must be array" };
  if (!Array.isArray(data.metas)) return { ok: false, msg: "metas must be array" };
  const byPeriodKeys = ["estaSemana", "proximaSemana", "esteMes", "total"];
  if (!hasKeys(data.byPeriod || {}, byPeriodKeys)) return { ok: false, msg: `byPeriod missing: ${byPeriodKeys.join(", ")}` };
  return { ok: true };
}

function checkProximasEntregas(data) {
  if (!hasKeys(data, ["ok", "data"])) return { ok: false, msg: "Missing ok or data" };
  if (!Array.isArray(data.data)) return { ok: false, msg: "data must be array" };
  return { ok: true };
}

function checkAudit(data) {
  if (!hasKeys(data, ["ok", "headers", "data"])) return { ok: false, msg: "Missing ok, headers or data" };
  if (!Array.isArray(data.data)) return { ok: false, msg: "data must be array" };
  return { ok: true };
}

function checkKpiReport(data) {
  const required = ["ok", "totalPendiente", "estaSemana", "proximaSemana", "entregasEstaSemana", "bajoStock", "equilibrio"];
  if (!hasKeys(data, required)) return { ok: false, msg: `Missing keys: ${required.filter((k) => !(k in data)).join(", ")}` };
  if (typeof data.totalPendiente !== "number") return { ok: false, msg: "totalPendiente must be number" };
  if (typeof data.entregasEstaSemana !== "number") return { ok: false, msg: "entregasEstaSemana must be number" };
  if (typeof data.bajoStock !== "number") return { ok: false, msg: "bajoStock must be number" };
  // irae_prevision added 2026-04-24
  if (!data.irae_prevision || typeof data.irae_prevision !== "object") return { ok: false, msg: "irae_prevision must be an object" };
  const iraeFields = ["base_ganancia_anual", "tasa", "monto_estimado", "fiscal_disclaimer", "periodo"];
  const missingIrae = iraeFields.filter((k) => !(k in data.irae_prevision));
  if (missingIrae.length > 0) return { ok: false, msg: `irae_prevision missing: ${missingIrae.join(", ")}` };
  return { ok: true };
}

function checkAgentStats(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "ok must be true" };
  const numFields = ["conversations", "turns", "active_last_hour", "avg_turns_per_conv", "hedge_rate_pct"];
  for (const f of numFields) {
    if (typeof data[f] !== "number") return { ok: false, msg: `${f} must be a number` };
  }
  if (data.avg_latency_ms !== null && typeof data.avg_latency_ms !== "number") {
    return { ok: false, msg: "avg_latency_ms must be number or null" };
  }
  if (!data.providers || typeof data.providers !== "object" || Array.isArray(data.providers)) {
    return { ok: false, msg: "providers must be a plain object" };
  }
  return { ok: true };
}

/** Minimal solo_techo body — must stay valid with PANELS_TECHO in constants */
const MIN_COTIZAR_SOLO_TECHO = {
  escenario: "solo_techo",
  lista: "web",
  techo: {
    familia: "ISODEC_EPS",
    espesor: 100,
    largo: 6,
    ancho: 5,
    color: "Blanco",
  },
};

const MIN_PRESUPUESTO_LIBRE = {
  lista: "web",
  librePanelLines: [{ familia: "ISODEC_EPS", espesor: 100, m2: 10 }],
};

function checkGptEntryPoint(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "ok must be true" };
  if (!Array.isArray(data.actions) || data.actions.length < 1) return { ok: false, msg: "actions must be non-empty array" };
  if (typeof data.openapi_url !== "string" || !data.openapi_url.includes("/calc/openapi")) {
    return { ok: false, msg: "openapi_url must point to /calc/openapi" };
  }
  const cotizar = data.actions.find((a) => a.path === "/calc/cotizar");
  if (!cotizar) return { ok: false, msg: "actions must include /calc/cotizar" };
  return { ok: true };
}

function checkCotizarResponse(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "expected ok: true" };
  if (!hasKeys(data, ["meta", "resumen", "bom"])) return { ok: false, msg: "Missing meta, resumen or bom" };
  if (!Array.isArray(data.bom)) return { ok: false, msg: "bom must be array" };
  return { ok: true };
}

function checkCapabilities(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "ok must be true" };
  if (!hasKeys(data, ["calculator", "dashboard", "discovery"])) return { ok: false, msg: "Missing calculator, dashboard or discovery" };
  if (!data.calculator?.actions?.length) return { ok: false, msg: "calculator.actions required" };
  return { ok: true };
}

function checkFollowups(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "ok must be true" };
  if (!Array.isArray(data.items)) return { ok: false, msg: "items must be array" };
  if (typeof data.count !== "number") return { ok: false, msg: "count must be number" };
  return { ok: true };
}

function checkPanelsimEmailSummary(data) {
  if (!data || typeof data !== "object") return { ok: false, msg: "not an object" };
  if (typeof data.ok !== "boolean") return { ok: false, msg: "ok must be boolean" };
  return { ok: true };
}

function checkMlCockpitQueue(data) {
  if (!data || data.ok !== true) return { ok: false, msg: "ok must be true" };
  if (!Array.isArray(data.items)) return { ok: false, msg: "items must be array" };
  return { ok: true };
}

function checkTransportistaHealth(data) {
  if (!data || typeof data !== "object") return { ok: false, msg: "not an object" };
  if (data.ok !== true) return { ok: false, msg: "ok must be true" };
  if (data.module !== "transportista") return { ok: false, msg: "module must be transportista" };
  return { ok: true };
}

async function main() {
  console.log(`\nBMC API Contract Validator — ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  const checks = [
    {
      name: "GET /capabilities",
      path: "/capabilities",
      check: checkCapabilities,
      allow503: false,
    },
    {
      name: "GET /api/followups",
      path: "/api/followups",
      check: checkFollowups,
      allow503: false,
    },
    {
      name: "GET /calc/gpt-entry-point",
      path: "/calc/gpt-entry-point",
      check: checkGptEntryPoint,
      allow503: false,
    },
    {
      name: "POST /calc/cotizar (solo_techo mínimo)",
      path: "/calc/cotizar",
      method: "POST",
      body: MIN_COTIZAR_SOLO_TECHO,
      check: checkCotizarResponse,
      allow503: false,
    },
    {
      name: "POST /calc/cotizar/presupuesto-libre (mínimo)",
      path: "/calc/cotizar/presupuesto-libre",
      method: "POST",
      body: MIN_PRESUPUESTO_LIBRE,
      check: checkCotizarResponse,
      allow503: false,
    },
    {
      name: "GET /api/kpi-financiero",
      path: "/api/kpi-financiero",
      check: checkKpiFinanciero,
      allow503: true,
    },
    {
      name: "GET /api/proximas-entregas",
      path: "/api/proximas-entregas",
      check: checkProximasEntregas,
      allow503: true,
    },
    {
      name: "GET /api/audit",
      path: "/api/audit",
      check: checkAudit,
      allow503: true,
    },
    {
      name: "GET /api/kpi-report",
      path: "/api/kpi-report",
      check: checkKpiReport,
      allow503: true,
    },
    {
      name: "GET /api/transportista/health",
      path: "/api/transportista/health",
      check: checkTransportistaHealth,
      allow503: true,
    },
  ];

  const apiToken = process.env.API_AUTH_TOKEN || process.env.API_KEY;
  if (apiToken) {
    const name = "GET /api/email/panelsim-summary (auth)";
    try {
      const { status, data } = await fetchJson("/api/email/panelsim-summary", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (status === 503 && data?.error?.includes?.("API_AUTH_TOKEN")) {
        console.log(`  ⚠️  ${name} — 503 cockpit auth not configured on server`);
        passed++;
      } else if (status !== 200) {
        console.log(`  ❌ ${name} — HTTP ${status}`);
        failed++;
      } else {
        const result = checkPanelsimEmailSummary(data);
        if (result.ok) {
          console.log(`  ✅ ${name}`);
          passed++;
        } else {
          console.log(`  ❌ ${name} — ${result.msg}`);
          failed++;
        }
      }
    } catch (err) {
      console.log(`  ❌ ${name} — ${err.message}`);
      failed++;
    }
  } else {
    console.log("  ⚠️  GET /api/email/panelsim-summary — skip (set API_AUTH_TOKEN for contract check)");
    passed++;
  }

  if (apiToken) {
    const nameMl = "GET /api/crm/cockpit/ml-queue (auth)";
    try {
      const { status, data } = await fetchJson("/api/crm/cockpit/ml-queue", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (status === 503 && data?.error?.includes?.("API_AUTH_TOKEN")) {
        console.log(`  ⚠️  ${nameMl} — 503 cockpit auth not configured on server`);
        passed++;
      } else if (status === 503 && String(data?.error || "").toLowerCase().includes("sheet")) {
        console.log(`  ⚠️  ${nameMl} — 503 Sheets unavailable, skip contract`);
        passed++;
      } else if (status !== 200) {
        console.log(`  ❌ ${nameMl} — HTTP ${status}`);
        failed++;
      } else {
        const result = checkMlCockpitQueue(data);
        if (result.ok) {
          console.log(`  ✅ ${nameMl}`);
          passed++;
        } else {
          console.log(`  ❌ ${nameMl} — ${result.msg}`);
          failed++;
        }
      }
    } catch (err) {
      console.log(`  ❌ ${nameMl} — ${err.message}`);
      failed++;
    }
  } else {
    console.log("  ⚠️  GET /api/crm/cockpit/ml-queue — skip (set API_AUTH_TOKEN for contract check)");
    passed++;
  }

  // ── /api/crm/cockpit/row/:rowNum — linkPresupuesto null|URL (4b7da4b fix) ──
  if (apiToken) {
    const nameRow = "GET /api/crm/cockpit/row/2 (auth) — linkPresupuesto null|URL";
    try {
      const { status, data } = await fetchJson("/api/crm/cockpit/row/2", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (status === 503 && data?.error?.includes?.("API_AUTH_TOKEN")) {
        console.log(`  ⚠️  ${nameRow} — 503 cockpit auth not configured on server`);
        passed++;
      } else if (status === 503 && String(data?.error || "").toLowerCase().includes("sheet")) {
        console.log(`  ⚠️  ${nameRow} — 503 Sheets unavailable, skip contract`);
        passed++;
      } else if (status !== 200) {
        console.log(`  ❌ ${nameRow} — HTTP ${status}`);
        failed++;
      } else {
        const parsed = data?.parsed;
        if (!data || data.ok !== true) {
          console.log(`  ❌ ${nameRow} — ok must be true`);
          failed++;
        } else if (!parsed || typeof parsed !== "object") {
          console.log(`  ❌ ${nameRow} — parsed must be an object`);
          failed++;
        } else {
          // linkPresupuesto must be null OR a string starting with "http" (never a bare number/label)
          const lp = parsed.linkPresupuesto;
          const lpOk = lp === null || (typeof lp === "string" && lp.startsWith("http"));
          if (!lpOk) {
            console.log(`  ❌ ${nameRow} — linkPresupuesto must be null or URL string, got: ${JSON.stringify(lp)}`);
            failed++;
          } else {
            console.log(`  ✅ ${nameRow}`);
            passed++;
          }
        }
      }
    } catch (err) {
      console.log(`  ❌ ${nameRow} — ${err.message}`);
      failed++;
    }
  } else {
    console.log("  ⚠️  GET /api/crm/cockpit/row/:rowNum — skip (set API_AUTH_TOKEN for contract check)");
    passed++;
  }

  // ── /api/agent/stats (requires auth token) ───────────────────────────────
  if (apiToken) {
    const nameStats = "GET /api/agent/stats (auth)";
    try {
      const { status, data } = await fetchJson("/api/agent/stats", {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (status === 503 && data?.error?.includes?.("API_AUTH_TOKEN")) {
        console.log(`  ⚠️  ${nameStats} — 503 API_AUTH_TOKEN not configured on server`);
        passed++;
      } else if (status === 401) {
        console.log(`  ❌ ${nameStats} — 401 Unauthorized (token mismatch)`);
        failed++;
      } else if (status !== 200) {
        console.log(`  ❌ ${nameStats} — HTTP ${status}`);
        failed++;
      } else {
        const result = checkAgentStats(data);
        if (result.ok) {
          console.log(`  ✅ ${nameStats}`);
          passed++;
        } else {
          console.log(`  ❌ ${nameStats} — ${result.msg}`);
          failed++;
        }
      }
    } catch (err) {
      console.log(`  ❌ ${nameStats} — ${err.message}`);
      failed++;
    }
  } else {
    console.log("  ⚠️  GET /api/agent/stats — skip (set API_AUTH_TOKEN for contract check)");
    passed++;
  }

  for (const { name, path, check, allow503, method, body } of checks) {
    try {
      const opts =
        method === "POST"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body || {}),
            }
          : undefined;
      const { status, data } = await fetchJson(path, opts);
      if (status === 503 && allow503) {
        console.log(`  ⚠️  ${name} — 503 (Sheets unavailable, skip contract)`);
        passed++;
        continue;
      }
      if (status !== 200) {
        console.log(`  ❌ ${name} — HTTP ${status}`);
        failed++;
        continue;
      }
      const result = check(data);
      if (result.ok) {
        console.log(`  ✅ ${name}`);
        passed++;
      } else {
        console.log(`  ❌ ${name} — ${result.msg}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ ${name} — ${err.message}`);
      failed++;
    }
  }

  // ── /api/agent/chat contract tests (3.4) ────────────────────────────────────
  console.log("\n── /api/agent/chat ──");
  await runChatContractTests({ passed: (n) => { console.log(`  ✅ ${n}`); passed++; }, failed: (n, r) => { console.log(`  ❌ ${n} — ${r}`); failed++; } });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

/**
 * Read the first SSE event from an /api/agent/chat response.
 * Aborts after first event to avoid consuming LLM tokens.
 */
async function readFirstSseEvent(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (line) {
        reader.cancel();
        return JSON.parse(line.slice(6));
      }
    }
    buf = parts[parts.length - 1];
  }
  return null;
}

async function runChatContractTests({ passed: pass, failed: fail }) {
  const CHAT = `${BASE}/api/agent/chat`;

  // 3.4a — Minimal valid POST → 200 + text/event-stream + first event has type
  try {
    const res = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hola" }] }),
    });
    if (res.status !== 200) {
      fail("POST /api/agent/chat (mínimo) → 200", `HTTP ${res.status}`);
    } else if (!res.headers.get("content-type")?.includes("text/event-stream")) {
      fail("POST /api/agent/chat → content-type: text/event-stream", res.headers.get("content-type"));
    } else {
      const evt = await readFirstSseEvent(res);
      if (!evt || !["text", "error", "info", "kb_match", "done"].includes(evt.type)) {
        fail("POST /api/agent/chat → first SSE event has known type", JSON.stringify(evt));
      } else {
        pass("POST /api/agent/chat (mínimo) → 200 + SSE + typed event");
      }
    }
  } catch (err) {
    fail("POST /api/agent/chat (mínimo)", err.message);
  }

  // 3.4b — Empty messages array → 400
  try {
    const res = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    if (res.status === 400) pass("POST /api/agent/chat (messages=[]) → 400");
    else fail("POST /api/agent/chat (messages=[]) → 400", `got HTTP ${res.status}`);
  } catch (err) {
    fail("POST /api/agent/chat (messages=[])", err.message);
  }

  // 3.4c — 61 messages → 400 (exceeds input cap)
  try {
    const msgs = Array.from({ length: 61 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: "test" }));
    const res = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs }),
    });
    if (res.status === 400) pass("POST /api/agent/chat (61 messages) → 400");
    else fail("POST /api/agent/chat (61 messages) → 400", `got HTTP ${res.status}`);
  } catch (err) {
    fail("POST /api/agent/chat (61 messages)", err.message);
  }

  // 3.4d — Unknown action type should NOT reach client as action event
  // We send a message designed to trigger an action, but can only verify endpoint responds
  // (full action filtering is covered by unit tests)
  try {
    const res = await fetch(CHAT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "quiero cotizar un techo ISODEC_EPS 100mm" }] }),
    });
    if (res.status === 200) pass("POST /api/agent/chat (cotización request) → 200");
    else fail("POST /api/agent/chat (cotización request) → 200", `got HTTP ${res.status}`);
  } catch (err) {
    fail("POST /api/agent/chat (cotización request)", err.message);
  }
}

main();
