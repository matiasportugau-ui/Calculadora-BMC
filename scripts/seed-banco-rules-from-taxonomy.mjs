#!/usr/bin/env node
/**
 * Seed banco_rules with taxonomy-aligned patterns (ported from metalog-bank-ledger).
 * Copy-only — no runtime coupling between repos.
 *
 * Usage:
 *   node scripts/seed-banco-rules-from-taxonomy.mjs --dry-run
 *   doppler run --config prd -- node scripts/seed-banco-rules-from-taxonomy.mjs --apply
 *   BMC_API_BASE=... BMC_ACCESS_TOKEN=... BMC_FINANZAS_PASSWORD=... \
 *     node scripts/seed-banco-rules-from-taxonomy.mjs --api --apply
 */
import pg from "pg";
import { classifySeedMovement } from "../server/lib/bancoSeedClassification.js";

/** Lower priority number = matched first. */
const RULES = [
  { priority: 10, pattern: "METALOG SAS", categoria: "transferencia_interna" },
  { priority: 11, pattern: "METALOG", categoria: "transferencia_interna" },
  { priority: 12, pattern: "BMC CANCEL", categoria: "transferencia_interna" },
  { priority: 13, pattern: "CANCEL BMC", categoria: "transferencia_interna" },
  { priority: 20, pattern: "MATIAS PORTUGAU PONS", categoria: "retiro_socio" },
  { priority: 21, pattern: "MATIAS", categoria: "retiro_socio" },
  { priority: 22, pattern: "MATÍAS", categoria: "retiro_socio" },
  { priority: 30, pattern: "SANDRA ARIAS", categoria: "egreso_sueldo" },
  { priority: 31, pattern: "RAMIRO", categoria: "egreso_sueldo" },
  { priority: 40, pattern: "BROMYROS", categoria: "egreso_proveedor" },
  { priority: 41, pattern: "PLEGADOS", categoria: "egreso_proveedor" },
  { priority: 42, pattern: "TRF SPI PAGO PROV", categoria: "egreso_proveedor" },
  { priority: 43, pattern: "PAGO A PROVEEDORES", categoria: "egreso_proveedor" },
  { priority: 50, pattern: "ARCOBELL", categoria: "ingreso_venta" },
  { priority: 51, pattern: "BUSITEL", categoria: "ingreso_venta" },
  { priority: 52, pattern: "HECTOR PINTOS", categoria: "ingreso_venta" },
  { priority: 53, pattern: "TRANSFERENCIA RECIBIDA SPI", categoria: "ingreso_venta" },
  { priority: 54, pattern: "SPI - BCU TRASPASO", categoria: "ingreso_venta" },
  { priority: 60, pattern: "Comercio:", categoria: "egreso_operativo" },
  { priority: 61, pattern: "PAGO SERVICIOS", categoria: "egreso_operativo" },
  { priority: 62, pattern: "TRANSFERENCIA SPI ENVIADA", categoria: "egreso_operativo" },
  { priority: 63, pattern: "TRF E-BROU ALQUILERES", categoria: "egreso_operativo" },
  { priority: 70, pattern: "SPI - COMISI", categoria: "egreso_financiero" },
  { priority: 71, pattern: "COMISION", categoria: "egreso_financiero" },
  { priority: 72, pattern: "TENENCIA TARJETA", categoria: "egreso_financiero" },
  { priority: 80, pattern: "DGI", categoria: "egreso_impuesto" },
  { priority: 81, pattern: "BPS", categoria: "egreso_impuesto" },
  { priority: 82, pattern: "IMPUESTO", categoria: "egreso_impuesto" },
  { priority: 90, pattern: "DEVOLUCION", categoria: "ingreso_otro" },
  { priority: 91, pattern: "REINTEGRO", categoria: "ingreso_otro" },
  { priority: 92, pattern: "Depósito Red:", categoria: "ingreso_otro" },
];

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run") || (!argv.includes("--apply") && !argv.includes("--api")),
    apply: argv.includes("--apply"),
    api: argv.includes("--api"),
  };
}

async function upsertRulesDb(client) {
  let inserted = 0;
  let skipped = 0;
  for (const rule of RULES) {
    const { rows } = await client.query(
      `select rule_id from banco_rules
        where archived_at is null and lower(pattern) = lower($1)
          and coalesce(categoria, '') = coalesce($2, '')
        limit 1`,
      [rule.pattern, rule.categoria ?? null],
    );
    if (rows.length) {
      skipped += 1;
      continue;
    }
    await client.query(
      `insert into banco_rules (pattern, categoria, entidad, priority)
       values ($1, $2, null, $3)`,
      [rule.pattern, rule.categoria ?? null, rule.priority],
    );
    inserted += 1;
  }
  return { inserted, skipped };
}

async function applyRulesDb(client) {
  const { rows: rules } = await client.query(
    `select pattern, categoria, entidad, priority
       from banco_rules where archived_at is null
       order by priority asc, created_at asc`,
  );
  const { rows: movements } = await client.query(
    `select movement_id, descripcion, asunto, debito, credito from banco_movements
      where categoria is null`,
  );
  let updated = 0;
  for (const m of movements) {
    const rule = classifySeedMovement(m, rules);
    if (!rule) continue;
    await client.query(
      `update banco_movements set categoria = $1, entidad = coalesce(entidad, $2)
       where movement_id = $3`,
      [rule.categoria, rule.entidad ?? null, m.movement_id],
    );
    updated += 1;
  }
  return { scanned: movements.length, updated, rules: rules.length };
}

async function countUnclassified(client) {
  const { rows } = await client.query(
    `select count(*)::int as n from banco_movements where categoria is null`,
  );
  return rows[0]?.n ?? 0;
}

async function runDb({ apply }) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required for DB mode");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const before = await countUnclassified(client);
    console.log(`Unclassified (categoria null) before: ${before}`);
    if (!apply) {
      console.log(`Would insert up to ${RULES.length} rules (skipping duplicates).`);
      RULES.forEach((r) => console.log(`  [${r.priority}] ${r.pattern} → ${r.categoria}`));
      return;
    }
    const seed = await upsertRulesDb(client);
    console.log(`Rules inserted: ${seed.inserted}, skipped (existing): ${seed.skipped}`);
    const result = await applyRulesDb(client);
    const after = await countUnclassified(client);
    console.log(`Apply: scanned=${result.scanned} updated=${result.updated} active_rules=${result.rules}`);
    console.log(`Unclassified after: ${after}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.api) {
    console.error("API mode not implemented — use --apply with DATABASE_URL (doppler run --config prd -- ...)");
    process.exit(1);
  }
  await runDb({ apply: args.apply && !args.dryRun });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
