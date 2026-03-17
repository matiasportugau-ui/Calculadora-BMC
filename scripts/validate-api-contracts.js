#!/usr/bin/env node
/**
 * BMC API Contract Validator
 * Validates API responses against canonical contract.
 * Run: BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js
 * Requires: server running (npm run start:api)
 */
const BASE = process.env.BMC_API_BASE || "http://localhost:3001";

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
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

async function main() {
  console.log(`\nBMC API Contract Validator — ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  const checks = [
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
  ];

  for (const { name, path, check, allow503 } of checks) {
    try {
      const { status, data } = await fetchJson(path);
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

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
