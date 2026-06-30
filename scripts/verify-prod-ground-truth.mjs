#!/usr/bin/env node
/**
 * scripts/verify-prod-ground-truth.mjs — "what is REALLY working" doctor for the
 * Omni / Inbox AI-First system.
 *
 * The problem this solves: planning docs and audits drift from the live system.
 * Claims like "all OMNI_* flags = 1 in prod", "Email→CRM live", "ML ingest is a
 * gap" are easy to assert and hard to confirm. This script reconciles claims
 * against observable reality, in two tiers:
 *
 *   TIER 1 — no credentials (runs anywhere, incl. CI / this sandbox):
 *     hits the PUBLIC prod endpoints (/health, /capabilities, /api/wa/health)
 *     to prove the API is live, Sheets/tokens are wired, and how much WA volume
 *     is flowing. Zero secrets, read-only, no customer contact.
 *
 *   TIER 2 — owner-run with DATABASE_URL (the omni_* Postgres):
 *     runs the canonical recency / row-count queries over the omni_* tables to
 *     prove data is actually FLOWING into the unified inbox (conversations,
 *     messages, ai_jobs, suggestions, email_ingest_log, quote_embeddings).
 *
 * It NEVER mutates anything and NEVER contacts a customer. It is the executable
 * companion to docs/team/runbooks/VERIFY-PROD-GROUND-TRUTH.md (the claim ledger).
 *
 * Usage:
 *   node scripts/verify-prod-ground-truth.mjs                 # Tier 1 only (no creds)
 *   DATABASE_URL=postgres://... node scripts/verify-prod-ground-truth.mjs   # + Tier 2
 *   node scripts/verify-prod-ground-truth.mjs --base https://...            # override prod base
 *   node scripts/verify-prod-ground-truth.mjs --json         # machine-readable
 *   BMC_API_BASE=https://... npm run omni:ground-truth
 *
 * Exit codes: 0 = no hard failures · 1 = a hard failure (API down / unreadable) ·
 * Note: "0 rows in 24h" is reported as a GAP (warning), not a hard failure — the
 * flags may be intentionally off, which is itself a finding worth surfacing.
 */
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_BASE = "https://panelin-calc-q74zutv7dq-uc.a.run.app";
const TIMEOUT_MS = 25_000;

function parseArgs(argv) {
  let base = process.env.BMC_API_BASE || process.env.SMOKE_BASE_URL || DEFAULT_BASE;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) base = argv[++i];
    else if (argv[i] === "--json") json = true;
  }
  return { base: String(base).trim().replace(/\/+$/, ""), json };
}

async function fetchJson(method, path, base, bodyObj) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const opts = { method, signal: ctrl.signal, headers: { Accept: "application/json" } };
    if (bodyObj != null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(`${base}${path}`, opts);
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { _raw: text.slice(0, 200) };
    }
    return { status: res.status, body: parsed };
  } catch (e) {
    return { status: 0, body: null, error: e?.message || String(e) };
  } finally {
    clearTimeout(t);
  }
}

// ─── Tier 1 — public, no credentials ────────────────────────────────────────

async function tier1Public(base) {
  const checks = [];
  let hardFail = false;

  const h = await fetchJson("GET", "/health", base);
  const healthOk = h.status === 200 && h.body?.ok === true;
  const tabs = h.body?.sheets_diagnostics?.tabs || [];
  checks.push({
    id: "api.health",
    label: "API /health vivo + Sheets/tokens",
    ok: healthOk,
    detail: healthOk
      ? `appEnv=${h.body.appEnv} hasTokens=${h.body.hasTokens} hasSheets=${h.body.hasSheets} ` +
        `mlTokenStore=${h.body.mlTokenStoreOk} CRM_Operativo=${tabs.includes("CRM_Operativo")}`
      : `esperado 200 + {ok:true}; recibido ${h.status}${h.error ? ` (${h.error})` : ""}`,
  });
  if (!healthOk) hardFail = true;

  const c = await fetchJson("GET", "/capabilities", base);
  const capOk = c.status === 200 && c.body?.build;
  checks.push({
    id: "api.capabilities",
    label: "API /capabilities (build desplegado)",
    ok: !!capOk,
    detail: capOk
      ? `gitSha=${c.body.build.gitSha?.slice(0, 8)} version=${c.body.build.version}`
      : `esperado 200 JSON con build; recibido ${c.status}`,
  });
  if (!capOk) hardFail = true;

  // WA cockpit health exposes real volume WITHOUT secrets: count_chats + 24h msgs.
  // 503 = DATABASE_URL not wired in that deployment (informational, not a failure).
  const wa = await fetchJson("GET", "/api/wa/health", base);
  if (wa.status === 200) {
    const chats = wa.body?.count_chats ?? "?";
    const msgs24 = wa.body?.count_msgs_24h ?? "?";
    const flowing = Number(msgs24) > 0;
    checks.push({
      id: "wa.health",
      label: "WhatsApp data-flow (público, sin creds)",
      ok: true,
      gap: !flowing,
      detail: `chats=${chats} msgs_24h=${msgs24}${flowing ? "" : " — GAP: 0 mensajes WA en 24h"}`,
    });
  } else if (wa.status === 503) {
    checks.push({
      id: "wa.health",
      label: "WhatsApp data-flow (público, sin creds)",
      ok: true,
      detail: "503 — WA cockpit sin DATABASE_URL en este deploy (informativo)",
    });
  } else {
    checks.push({
      id: "wa.health",
      label: "WhatsApp data-flow (público, sin creds)",
      ok: false,
      detail: `esperado 200 o 503; recibido ${wa.status}`,
    });
    hardFail = true;
  }

  return { checks, hardFail };
}

// ─── Tier 2 — owner-run, needs DATABASE_URL ─────────────────────────────────

/** Each probe: a label + SQL. Missing tables degrade to a "table absent" note. */
const DB_PROBES = [
  {
    id: "omni_conversations",
    label: "Conversaciones unificadas (por canal, últimas 24h)",
    sql: `SELECT channel,
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
                 MAX(created_at) AS newest
          FROM omni_conversations GROUP BY channel ORDER BY total DESC`,
    flowKey: "last_24h",
  },
  {
    id: "omni_messages",
    label: "Mensajes (últimas 24h)",
    sql: `SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
                 MAX(created_at) AS newest
          FROM omni_messages`,
    flowKey: "last_24h",
  },
  {
    id: "omni_ai_jobs",
    label: "Jobs de IA (estado + costo, últimas 24h)",
    sql: `SELECT status,
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
                 ROUND(COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= now() - interval '24 hours'),0)::numeric, 4) AS cost_24h_usd
          FROM omni_ai_jobs GROUP BY status ORDER BY total DESC`,
    flowKey: "last_24h",
  },
  {
    id: "omni_suggestions",
    label: "Sugerencias staged (cola de aprobación HITL)",
    sql: `SELECT approval_state,
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h
          FROM omni_suggestions GROUP BY approval_state ORDER BY total DESC`,
    flowKey: "last_24h",
  },
  {
    id: "email_ingest_log",
    label: "Email→CRM dedupe ledger (prueba el pipeline de correo)",
    sql: `SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
                 MAX(created_at) AS newest
          FROM public.email_ingest_log`,
    flowKey: "last_24h",
  },
  {
    id: "quote_embeddings",
    label: "Corpus RAG (vectores por provider)",
    sql: `SELECT COALESCE(provider, '(untagged)') AS provider,
                 COUNT(*)::int AS total,
                 COUNT(embedding)::int AS embedded
          FROM quote_embeddings GROUP BY provider ORDER BY total DESC`,
    flowKey: null,
  },
];

async function tier2Db(databaseUrl) {
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const checks = [];
  try {
    for (const probe of DB_PROBES) {
      try {
        const r = await pool.query(probe.sql);
        const rows = r.rows || [];
        const flowing =
          probe.flowKey == null
            ? rows.length > 0
            : rows.some((row) => Number(row[probe.flowKey]) > 0);
        checks.push({
          id: probe.id,
          label: probe.label,
          ok: true,
          gap: !flowing,
          detail: rows.length
            ? rows
                .map((row) =>
                  Object.entries(row)
                    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : v}`)
                    .join(" "),
                )
                .join(" · ")
            : "0 filas",
        });
      } catch (e) {
        const absent = e.code === "42P01"; // undefined_table
        checks.push({
          id: probe.id,
          label: probe.label,
          ok: !absent ? false : true,
          gap: absent,
          detail: absent
            ? "tabla ausente (pre-migración) — correr npm run omni:migrate / migrations/0001"
            : `error: ${e.message}`,
        });
      }
    }
  } finally {
    await pool.end().catch(() => {});
  }
  return { checks };
}

// ─── Report ─────────────────────────────────────────────────────────────────

function printHuman(base, tier1, tier2, hasDb) {
  const line = (m) => console.log(m);
  line("");
  line("Ground-truth — Omni / Inbox AI-First");
  line(`  Base: ${base}`);
  line("");
  line("TIER 1 — público (sin credenciales)");
  for (const c of tier1.checks) {
    const mark = c.ok ? (c.gap ? "⚠" : "✓") : "✗";
    line(`  ${mark}  ${c.label}`);
    line(`      ${c.detail}`);
  }
  line("");
  if (hasDb) {
    line("TIER 2 — DB omni_* (DATABASE_URL presente)");
    for (const c of tier2.checks) {
      const mark = c.ok ? (c.gap ? "⚠" : "✓") : "✗";
      line(`  ${mark}  ${c.label}`);
      line(`      ${c.detail}`);
    }
  } else {
    line("TIER 2 — omitido (sin DATABASE_URL)");
    line("      Para probar el flujo real a omni_*: DATABASE_URL=postgres://… npm run omni:ground-truth");
  }
  line("");
}

async function main() {
  const { base, json } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL || "";
  const hasDb = !!databaseUrl;

  const tier1 = await tier1Public(base);
  const tier2 = hasDb ? await tier2Db(databaseUrl) : { checks: [] };

  const allChecks = [...tier1.checks, ...tier2.checks];
  const hardFail = tier1.hardFail || tier2.checks.some((c) => !c.ok);
  const gaps = allChecks.filter((c) => c.ok && c.gap);

  if (json) {
    console.log(
      JSON.stringify(
        { ok: !hardFail, base, at: new Date().toISOString(), hasDb, gaps: gaps.length, checks: allChecks },
        null,
        2,
      ),
    );
    process.exit(hardFail ? 1 : 0);
  }

  printHuman(base, tier1, tier2, hasDb);
  if (hardFail) {
    console.log("RESULTADO: FALLA — la API no responde sana o una tabla es ilegible. Ver ✗ arriba.");
    process.exit(1);
  }
  if (gaps.length) {
    console.log(
      `RESULTADO: VIVO con ${gaps.length} GAP(s) (⚠) — el sistema responde pero hay señales sin flujo. ` +
        "Un gap suele significar un flag apagado, no un bug. Ver el claim ledger en el runbook.",
    );
  } else {
    console.log("RESULTADO: OK — API sana" + (hasDb ? " y datos fluyendo a omni_*." : " (Tier 1; correr Tier 2 con DATABASE_URL para confirmar el flujo)."));
  }
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
