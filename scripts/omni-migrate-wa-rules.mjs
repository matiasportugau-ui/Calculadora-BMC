#!/usr/bin/env node
/**
 * Migrate wa_rules → omni_automation_rules (WAVE 3 F3).
 * Usage: DATABASE_URL=... npm run omni:migrate-wa-rules [-- --dry-run]
 */
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const { rows: waRules } = await pool.query(
      `SELECT id, name, priority, when_conditions, then_actions, enabled
       FROM wa_rules WHERE enabled = true ORDER BY priority ASC`,
    );

    let inserted = 0;
    for (const rule of waRules) {
      const conditions = {
        all: [
          { field: "channel", op: "eq", value: "wa" },
          ...(Array.isArray(rule.when_conditions?.all) ? rule.when_conditions.all : []),
        ],
      };
      if (rule.when_conditions && !rule.when_conditions.all) {
        Object.assign(conditions, rule.when_conditions);
        if (!conditions.all?.some((c) => c.field === "channel")) {
          conditions.all = [{ field: "channel", op: "eq", value: "wa" }, ...(conditions.all || [])];
        }
      }

      const actions = [];
      const ta = rule.then_actions || {};
      if (ta.label) actions.push({ type: "tag_conversation", params: { tags: [ta.label] } });
      if (ta.status) actions.push({ type: "set_conversation_status", params: { status: ta.status } });
      if (ta.assign) actions.push({ type: "set_priority", params: { priority: 2 } });

      if (dryRun) {
        console.log(`would migrate: ${rule.name} (${actions.length} actions)`);
        inserted += 1;
        continue;
      }

      const { rowCount } = await pool.query(
        `INSERT INTO omni_automation_rules (name, trigger_event, conditions, actions, priority, enabled, created_by)
         SELECT $1, 'message.ingested', $2::jsonb, $3::jsonb, $4, $5, 'wa_rules_migration'
         WHERE NOT EXISTS (
           SELECT 1 FROM omni_automation_rules WHERE name = $1 AND created_by = 'wa_rules_migration'
         )`,
        [rule.name, JSON.stringify(conditions), JSON.stringify(actions), rule.priority, rule.enabled],
      );
      inserted += rowCount;
    }

    console.log(JSON.stringify({ ok: true, dryRun, wa_rules: waRules.length, inserted }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
