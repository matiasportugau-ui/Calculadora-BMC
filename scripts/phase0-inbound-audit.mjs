#!/usr/bin/env node
/**
 * Phase 0 Audit Kickoff — BMC Inbound Messages
 * Per July 2026 Research Report: map sources, volumes, pain points, existing ML flows.
 *
 * Usage (local with Doppler):
 *   doppler run --project=bmc-backend --config=prd -- node scripts/phase0-inbound-audit.mjs
 *
 * It will:
 * - Query omni_conversations by channel (if DATABASE_URL present)
 * - Provide 30d/90d time windows
 * - Print ready-to-run SQL
 * - Note ML-specific flows
 * - Output JSON report
 */

import { getOmniPool } from '../server/lib/omni/omniDb.js';
import { collectOmniMetrics } from '../server/lib/omni/omniMetrics.js';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DOPPLER_DATABASE_URL || null;

async function runOmniCounts(pool) {
  if (!pool) {
    return { available: false, reason: 'No DATABASE_URL' };
  }

  const queries = {
    totalByChannel: `SELECT channel, COUNT(*)::int AS count FROM omni_conversations GROUP BY channel ORDER BY count DESC`,
    last30d: `SELECT channel, COUNT(*)::int AS count FROM omni_conversations WHERE created_at >= now() - interval '30 days' GROUP BY channel`,
    last90d: `SELECT channel, COUNT(*)::int AS count FROM omni_conversations WHERE created_at >= now() - interval '90 days' GROUP BY channel`,
    messages30d: `SELECT COUNT(*)::int AS count FROM omni_messages WHERE created_at >= now() - interval '30 days'`,
    dealsBySource: `SELECT COALESCE(source_channel, 'unknown') AS source_channel, COUNT(*)::int AS count FROM omni_deals GROUP BY source_channel`,
  };

  const results = {};
  for (const [name, sql] of Object.entries(queries)) {
    try {
      const { rows } = await pool.query(sql);
      results[name] = rows;
    } catch (e) {
      results[name] = { error: e.message };
    }
  }
  return { available: true, results };
}

async function main() {
  console.log('=== BMC Phase 0 Inbound Audit Kickoff ===');
  console.log('Date:', new Date().toISOString());
  console.log('Report reference: BMC_Inbound_Messages_Research_Report_July2026.pdf\n');

  // 1. Omni (modern unified inbox)
  console.log('--- Omni Postgres (unified channels) ---');
  let omniData = { available: false };
  if (DATABASE_URL) {
    const pool = getOmniPool(DATABASE_URL);
    omniData = await runOmniCounts(pool);
    try {
      const metrics = await collectOmniMetrics(pool);
      omniData.metrics = metrics;
    } catch (e) {}
  } else {
    console.log('DATABASE_URL not set. Run with doppler run ... for prod-like DB.');
  }

  console.dir(omniData, { depth: 2 });

  // 2. ML specific flows (still have dedicated surface)
  console.log('\n--- ML Dedicated Flows (pluggable adapter candidate) ---');
  console.log('Sources: mercadoLibreClient + ml-crm-sync.js + adapters/mlCrmRow.js');
  console.log('Channels mapped to: "ml" in omni');
  console.log('UI: /hub/ml (operativo) + /hub/ml-manager');
  console.log('Webhooks: /webhooks/ml');

  // 3. Legacy Sheets
  console.log('\n--- Legacy Sheets (CRM_Operativo) ---');
  console.log('Primary operator view for many flows.');
  console.log('Key columns (from wolfboard.js):');
  console.log('  F(5) = Origen (documented values: WA / EM / CL / LO / LL + ML flows)');
  console.log('  I(8) = Consulta (inbound message)');
  console.log('  J(9) = RespuestaAI');
  console.log('  L(11) = Estado');
  console.log('Accessed via: /api/wolfboard/pendientes , admin-ingreso, Canales');
  console.log('To count: use service account + googleapis (see existing patterns in server or scripts).');

  // 4. Other sources
  console.log('\n--- Other Channels (from omni schema) ---');
  console.log('omni_conversations.channel supports: ml | wa | email | facebook | instagram | omnicrm');
  console.log('WA: primarily via waWebhook + wa_crm_sync job → omni');
  console.log('Email: adapters/emailIngest.js');

  // 5. Pain points hints from code
  console.log('\n--- Observed Pain Points / Complexity (from code) ---');
  console.log('- Dual write risk (legacy WA vs omni canonical, many flags still dormido)');
  console.log('- Duplicates handling (OmniDuplicateContactsPanel, contactMerge)');
  console.log('- FRT breaches, urgency scoring per channel');
  console.log('- AI job budget + pending jobs');
  console.log('- Sheets as source of truth alongside Postgres (sync challenges)');

  const report = {
    generated_at: new Date().toISOString(),
    sources: {
      omni: { channels: ['ml','wa','email','facebook','instagram','omnicrm'], table: 'omni_conversations' },
      sheets: { tab: 'CRM_Operativo', origen_column: 'F', values: ['WA','EM','CL','LO','LL','ML?'] },
      ml_dedicated: { adapter: 'mlCrmRow', ui: ['/hub/ml', '/hub/ml-manager'] },
    },
    omni_counts: omniData,
    recommendations_for_next: [
      'Run with real DATABASE_URL to get actual 30d/90d numbers',
      'Pull CRM_Operativo row counts by Origen + date (last 90d)',
      'Cross-check ML volume from MercadoLibre API vs omni "ml" channel',
      'Document volume deltas between legacy Sheets and omni',
    ],
  };

  console.log('\n=== JSON Report ===');
  console.log(JSON.stringify(report, null, 2));

  console.log('\n=== Ready-to-run SQL (copy-paste into psql with prod DB) ===');
  console.log(`
SELECT channel, COUNT(*)::int AS count_30d
FROM omni_conversations
WHERE created_at >= now() - interval '30 days'
GROUP BY channel ORDER BY count_30d DESC;

SELECT channel, COUNT(*)::int AS count_90d
FROM omni_conversations
WHERE created_at >= now() - interval '90 days'
GROUP BY channel ORDER BY count_90d DESC;

-- Message volume
SELECT COUNT(*) FROM omni_messages WHERE created_at >= now() - interval '30 days';
  `);

  console.log('\nPhase 0 kickoff complete. Provide output or run with secrets for real numbers.');
}

main().catch(err => {
  console.error('Audit error:', err);
  process.exit(1);
});
