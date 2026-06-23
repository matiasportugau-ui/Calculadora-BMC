#!/usr/bin/env node
/**
 * Omni smoke — health + metrics (WAVE 3 K4).
 * Usage: BMC_API_BASE=http://localhost:3001 API_AUTH_TOKEN=... npm run smoke:omni
 */
import dotenv from "dotenv";

dotenv.config();

const base = (process.env.BMC_API_BASE || process.env.SMOKE_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const token = process.env.API_AUTH_TOKEN || process.env.API_KEY || "";

async function fetchJson(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...opts, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const results = { ok: true, base, checks: [] };

  const health = await fetchJson("/api/omni/health");
  results.checks.push({ name: "omni_health", status: health.status, ok: health.status === 200 || health.status === 503 });
  if (health.status === 503) {
    console.log(JSON.stringify({ ok: true, skipped: "omni_db_unavailable", checks: results.checks }, null, 2));
    return;
  }

  const metrics = await fetchJson("/api/omni/metrics");
  results.checks.push({
    name: "omni_metrics",
    status: metrics.status,
    ok: metrics.status === 200,
    pending_jobs: metrics.body?.omni_ai_jobs_pending,
  });

  results.ok = results.checks.every((c) => c.ok);
  console.log(JSON.stringify(results, null, 2));
  if (!results.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
