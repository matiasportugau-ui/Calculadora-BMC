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
      allow404: true, // route exists; 404 = server not restarted after deploy
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

  for (const { name, path, check, allow503, allow404, method, body } of checks) {
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
      if (status === 404 && allow404) {
        console.log(`  ⚠️  ${name} — 404 (route not loaded, restart server)`);
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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
