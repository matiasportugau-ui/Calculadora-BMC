#!/usr/bin/env node
/**
 * WA Module Pro Settings — Admin CLI
 *
 * Bootstrap, emergencia y export/import sin pasar por la UI.
 *
 * Uso (más comandos en `wa-admin help`):
 *   node scripts/wa-admin.mjs operator add --email user@example.com --name "User Name" --role owner
 *   node scripts/wa-admin.mjs operator list
 *   node scripts/wa-admin.mjs operator revoke --id <operator_id>
 *
 *   node scripts/wa-admin.mjs config get <key>
 *   node scripts/wa-admin.mjs config set <key> <value>
 *   node scripts/wa-admin.mjs config dump [--out config.json]
 *   node scripts/wa-admin.mjs config import <file> [--dry-run]
 *
 *   node scripts/wa-admin.mjs flags list
 *   node scripts/wa-admin.mjs flags get <key>
 *   node scripts/wa-admin.mjs flags toggle <key>
 *
 *   node scripts/wa-admin.mjs webhook list
 *   node scripts/wa-admin.mjs webhook test --id <id>
 *
 *   node scripts/wa-admin.mjs sla check
 *
 * Alias npm: `npm run wa:admin -- <args>`.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { getWaPool } from "../server/lib/waDb.js";
import {
  primeWaConfig,
  setSetting,
  getSetting,
  setFlag,
  getFlag,
  describeAll,
  _resetWaConfigForTests,
} from "../server/lib/waConfig.js";

const pool = getWaPool();

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out.flags[key] = true;
      } else {
        out.flags[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function printHelp() {
  console.log(`WA Module Pro Settings Admin CLI

Operadores:
  operator add --email <email> --name <name> --role <owner|admin|member>
                            Crea/actualiza operador. Si es el primer Owner,
                            funciona como bootstrap (no requiere magic link).
  operator list             Lista operadores con role/status/last_active_at.
  operator revoke --id <id> Invalida todos los refresh tokens del operador.

Config (settings):
  config get <key>          Lee un setting puntual (notación con dots).
  config set <key> <value>  Escribe (JSON.parse si es posible). Validación zod.
  config dump [--out <file>]  Imprime todo (settings+flags+drift) o lo escribe.
  config import <file> [--dry-run]
                            Restaura desde JSON. --dry-run muestra cambios sin tocar.

Flags:
  flags list                Lista todos los feature flags y su estado.
  flags get <key>           Booleano efectivo (incluye rollout_percent).
  flags toggle <key>        Invierte enabled del flag.

Webhooks:
  webhook list              Lista webhooks configurados.
  webhook test --id <id>    Dispara un POST de test (event=test.ping) al endpoint.

SLA:
  sla check [--verbose]     Corre un tick manual del worker. Imprime breaches
                            detectados/resueltos. Útil para forzar la query
                            sin esperar al schedule periódico.
`);
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const [category, cmd, ...rest] = _;

  if (!category || category === "help" || category === "-h" || category === "--help") {
    printHelp();
    process.exit(0);
  }

  await primeWaConfig({ pool });

  try {
    if (category === "operator") await handleOperator(cmd, rest, flags);
    else if (category === "config") await handleConfig(cmd, rest, flags);
    else if (category === "flags") await handleFlags(cmd, rest, flags);
    else if (category === "webhook" || category === "webhooks") await handleWebhook(cmd, rest, flags);
    else if (category === "sla") await handleSla(cmd, rest, flags);
    else {
      console.error(`Unknown category: ${category}. Run 'wa-admin help'.`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    if (process.env.DEBUG) console.error(e.stack);
    process.exit(1);
  } finally {
    _resetWaConfigForTests();
    await pool.end().catch(() => {});
  }
}

// ─── Operator ─────────────────────────────────────────────────────────────

async function handleOperator(cmd, _rest, flags) {
  if (cmd === "add") {
    const { email, name, role } = flags;
    if (!email || !name || !role) {
      console.error("Missing flags: --email, --name, --role");
      process.exit(1);
    }
    if (!["owner", "admin", "member"].includes(role)) {
      console.error("Invalid --role (owner|admin|member)");
      process.exit(1);
    }
    const operatorId = String(email).split("@")[0].replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const { rows: existing } = await pool.query("select count(*)::int as n from wa_operators");
    const isBootstrap = existing[0]?.n === 0;
    await pool.query(
      `insert into wa_operators (operator_id, email, name, role, status, created_at)
       values ($1, $2, $3, $4, 'active', now())
       on conflict (email) do update
         set name = excluded.name,
             role = excluded.role,
             status = case when wa_operators.status = 'invited' then 'active' else wa_operators.status end`,
      [operatorId, String(email).toLowerCase(), name, role],
    );
    console.log(
      isBootstrap
        ? `✓ Bootstrap: primer ${role} creado (${operatorId}). Ahora podés pedirte un magic link y entrar.`
        : `✓ Operator ${operatorId} added/updated.`,
    );
    return;
  }
  if (cmd === "list") {
    const { rows } = await pool.query(
      "select operator_id, email, name, role, status, last_login_at, last_active_at from wa_operators order by created_at",
    );
    console.table(rows);
    return;
  }
  if (cmd === "revoke") {
    const id = flags.id;
    if (!id) {
      console.error("Missing flag: --id");
      process.exit(1);
    }
    const r = await pool.query(
      `update wa_operators
          set refresh_token_hash = null,
              refresh_expires_at = null,
              jwt_revoked_at = now()
        where operator_id = $1
        returning operator_id, email`,
      [id],
    );
    if (r.rowCount === 0) {
      console.error(`Operator ${id} not found.`);
      process.exit(1);
    }
    console.log(`✓ Sessions revoked for ${r.rows[0].email}.`);
    return;
  }
  console.error(`Unknown operator command: ${cmd}. (add|list|revoke)`);
  process.exit(1);
}

// ─── Config ───────────────────────────────────────────────────────────────

async function handleConfig(cmd, rest, flags) {
  if (cmd === "get") {
    const key = rest[0];
    if (!key) {
      console.error("Usage: config get <key>");
      process.exit(1);
    }
    const v = getSetting(key);
    console.log(typeof v === "object" ? JSON.stringify(v, null, 2) : String(v));
    return;
  }
  if (cmd === "set") {
    const key = rest[0];
    let raw = rest.slice(1).join(" ");
    if (!key) {
      console.error("Usage: config set <key> <value>");
      process.exit(1);
    }
    let value = raw;
    try { value = JSON.parse(raw); } catch { /* keep as string */ }
    await setSetting(key, value, { actor: "cli-admin" });
    console.log(`✓ Setting ${key} updated.`);
    return;
  }
  if (cmd === "dump") {
    const all = describeAll();
    const json = JSON.stringify(all, null, 2);
    if (flags.out) {
      await fs.writeFile(path.resolve(flags.out), json, "utf8");
      console.log(`✓ Dumped to ${flags.out}`);
    } else {
      console.log(json);
    }
    return;
  }
  if (cmd === "import") {
    const file = rest[0];
    if (!file) {
      console.error("Usage: config import <file> [--dry-run]");
      process.exit(1);
    }
    const raw = await fs.readFile(path.resolve(file), "utf8");
    const parsed = JSON.parse(raw);
    const incoming = parsed.settings || parsed; // acepta dump completo o array directo
    if (!Array.isArray(incoming)) {
      console.error("Invalid file: expected `{settings: [...]}` o array directo.");
      process.exit(1);
    }
    const dryRun = Boolean(flags["dry-run"]);
    let updated = 0;
    let skipped = 0;
    const errors = [];
    for (const item of incoming) {
      if (!item.key || item.value === undefined) {
        skipped++;
        continue;
      }
      const current = getSetting(item.key);
      const same = JSON.stringify(current) === JSON.stringify(item.value);
      if (same) {
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`Δ ${item.key}: ${JSON.stringify(current)} → ${JSON.stringify(item.value)}`);
        updated++;
        continue;
      }
      try {
        await setSetting(item.key, item.value, { actor: "cli-import" });
        updated++;
      } catch (e) {
        errors.push(`${item.key}: ${e.message}`);
      }
    }
    console.log(
      dryRun
        ? `(dry-run) Cambiarían ${updated} settings, ${skipped} sin cambios.`
        : `✓ Import: ${updated} updated, ${skipped} sin cambios, ${errors.length} errores.`,
    );
    if (errors.length) {
      console.error("Errores:\n  " + errors.join("\n  "));
      if (!dryRun) process.exit(1);
    }
    return;
  }
  console.error(`Unknown config command: ${cmd}. (get|set|dump|import)`);
  process.exit(1);
}

// ─── Flags ────────────────────────────────────────────────────────────────

async function handleFlags(cmd, rest) {
  if (cmd === "list") {
    const all = describeAll();
    console.table(
      all.flags.map((f) => ({
        key: f.key,
        enabled: f.enabled,
        rolloutPercent: f.rolloutPercent,
        owner: f.owner,
        expiresAt: f.expiresAt,
      })),
    );
    return;
  }
  if (cmd === "get") {
    const key = rest[0];
    if (!key) {
      console.error("Usage: flags get <key>");
      process.exit(1);
    }
    console.log(getFlag(key));
    return;
  }
  if (cmd === "toggle") {
    const key = rest[0];
    if (!key) {
      console.error("Usage: flags toggle <key>");
      process.exit(1);
    }
    const all = describeAll();
    const current = all.flags.find((f) => f.key === key);
    if (!current) {
      console.error(`Flag ${key} not found.`);
      process.exit(1);
    }
    await setFlag(key, { enabled: !current.enabled }, { actor: "cli-admin" });
    console.log(`✓ Flag ${key} → ${!current.enabled}.`);
    return;
  }
  console.error(`Unknown flags command: ${cmd}. (list|get|toggle)`);
  process.exit(1);
}

// ─── Webhooks ─────────────────────────────────────────────────────────────

async function handleWebhook(cmd, _rest, flags) {
  if (cmd === "list") {
    const { rows } = await pool.query(
      `select id, event, url, enabled, last_status, last_status_code, last_attempt_at, failure_count
         from wa_webhooks
         order by event, created_at`,
    );
    if (rows.length === 0) {
      console.log("(sin webhooks configurados — agregalos vía POST /api/wa/webhooks o desde el panel UI)");
    } else {
      console.table(rows);
    }
    return;
  }
  if (cmd === "test") {
    const id = flags.id;
    if (!id) {
      console.error("Usage: webhook test --id <id>");
      process.exit(1);
    }
    const { initWaWebhooks, testWebhook } = await import("../server/lib/waWebhooks.js");
    initWaWebhooks({ pool });
    const r = await testWebhook({ id });
    console.log(`✓ Webhook ${id} test:`, r);
    return;
  }
  console.error(`Unknown webhook command: ${cmd}. (list|test)`);
  process.exit(1);
}

// ─── SLA ──────────────────────────────────────────────────────────────────

async function handleSla(cmd, _rest, flags) {
  if (cmd !== "check") {
    console.error(`Unknown sla command: ${cmd}. (check)`);
    process.exit(1);
  }
  const verbose = Boolean(flags.verbose);
  // Snapshot antes/después para reportar el delta del tick.
  const before = await pool.query(
    `select count(*) filter (where resolved_at is null)::int as open,
            count(*) filter (where resolved_at is not null)::int as resolved
       from wa_sla_breaches`,
  );
  const { startWaSlaWorker } = await import("../server/lib/waSlaWorker.js");
  // Forzamos un intervalo corto y un solo tick: arrancamos, esperamos un tick,
  // detenemos. El worker ya respeta el flag slaTracking.enabled internamente.
  await setSetting("sla.workerIntervalMs", 100, { actor: "cli-admin" });
  const stop = startWaSlaWorker({
    pool,
    logger: verbose ? console : { info() {}, warn() {}, error() {} },
  });
  await new Promise((r) => setTimeout(r, 350)); // ~3 ticks de margen
  stop();
  const after = await pool.query(
    `select count(*) filter (where resolved_at is null)::int as open,
            count(*) filter (where resolved_at is not null)::int as resolved
       from wa_sla_breaches`,
  );
  console.log("SLA breaches snapshot:");
  console.log("  antes:   open=" + before.rows[0].open + " resolved=" + before.rows[0].resolved);
  console.log("  después: open=" + after.rows[0].open + " resolved=" + after.rows[0].resolved);
  const newlyOpen = after.rows[0].open - before.rows[0].open;
  const newlyResolved = after.rows[0].resolved - before.rows[0].resolved;
  console.log(`  Δ open: ${newlyOpen >= 0 ? "+" : ""}${newlyOpen} · Δ resolved: ${newlyResolved >= 0 ? "+" : ""}${newlyResolved}`);
  if (verbose) {
    const { rows } = await pool.query(
      `select id, chat_id, kind, age_hours, breached_at, resolved_at
         from wa_sla_breaches
         order by breached_at desc
         limit 20`,
    );
    console.table(rows);
  }
}

main();
