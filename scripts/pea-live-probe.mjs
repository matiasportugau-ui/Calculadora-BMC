#!/usr/bin/env node
/**
 * IMP-PEA-00 — read-only live probe helper.
 * Usage: BMC_API_BASE=https://... node scripts/pea-live-probe.mjs [--markdown]
 */
const BASE = process.env.BMC_API_BASE || "http://localhost:3001";
const asMarkdown = process.argv.includes("--markdown");

async function probe(name, fn) {
  try {
    const result = await fn();
    return { name, ok: true, ...result };
  } catch (e) {
    return { name, ok: false, error: e.message };
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  const rows = [];
  const at = new Date().toISOString();

  rows.push(
    await probe("GET /health", async () => {
      const { status, data } = await fetchJson("/health");
      return { status, snippet: JSON.stringify(data)?.slice(0, 120) };
    }),
  );

  rows.push(
    await probe("GET /api/pea/health", async () => {
      const { status, data } = await fetchJson("/api/pea/health");
      return {
        status,
        pea_enabled: data?.pea_enabled,
        schema_ready: data?.schema_ready,
      };
    }),
  );

  rows.push(
    await probe("GET /api/environment", async () => {
      const { status, data } = await fetchJson("/api/environment");
      return { status, env: data?.env, staging: data?.staging };
    }),
  );

  rows.push(
    await probe("GET /api/pea/gaps (no auth)", async () => {
      const { status } = await fetchJson("/api/pea/gaps");
      return { status, expected: 401 };
    }),
  );

  if (asMarkdown) {
    console.log(`# Live probe run — ${at}\n`);
    console.log(`Base: \`${BASE}\`\n`);
    console.log("| Probe | OK | Status | Notes |");
    console.log("|-------|-----|--------|-------|");
    for (const r of rows) {
      const notes = r.error || JSON.stringify(r).slice(0, 80);
      console.log(`| ${r.name} | ${r.ok ? "yes" : "no"} | ${r.status ?? "-"} | ${notes} |`);
    }
    return;
  }

  console.log(JSON.stringify({ at, base: BASE, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
