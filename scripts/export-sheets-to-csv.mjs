#!/usr/bin/env node
/**
 * Export curated BMC Google Sheets tabs to CSV files for RAG ingest.
 *
 * Sources (numbered per /tmp/panelin-rag/HANDOFF-UNIFIED-LM.md §4):
 *   1a CRM_Operativo          ← BMC_SHEET_ID
 *   1d Metas_Ventas           ← BMC_SHEET_ID
 *   2a (first tab of Pagos)   ← BMC_PAGOS_SHEET_ID
 *
 * Output: /tmp/panelin-rag/sheets/*.csv (idempotent — overwrites on re-run)
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (service account JSON path).
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { google } from 'googleapis';

const OUT_DIR = '/tmp/panelin-rag/sheets';

const TARGETS = [
  {
    name: '1a_CRM_Operativo',
    spreadsheetEnv: 'BMC_SHEET_ID',
    tabTitle: 'CRM_Operativo',
  },
  {
    name: '1d_Metas_Ventas',
    spreadsheetEnv: 'BMC_SHEET_ID',
    tabTitle: 'Metas_Ventas',
  },
  {
    name: '2a_Pagos_Pendientes_2026',
    spreadsheetEnv: 'BMC_PAGOS_SHEET_ID',
    tabTitle: null, // first tab — resolved at runtime
  },
];

function csvEscape(cell) {
  const s = cell == null ? '' : String(cell);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

async function getFirstTabTitle(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title,index))',
  });
  const first = (meta.data.sheets ?? []).sort(
    (a, b) => (a.properties.index ?? 0) - (b.properties.index ?? 0),
  )[0];
  if (!first) throw new Error(`No tabs found in spreadsheet ${spreadsheetId}`);
  return first.properties.title;
}

async function fetchTab(sheets, spreadsheetId, tabTitle) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabTitle.replace(/'/g, "''")}'`,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return res.data.values ?? [];
}

async function main() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set in .env');
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  await mkdir(OUT_DIR, { recursive: true });

  const summary = [];
  for (const t of TARGETS) {
    const spreadsheetId = process.env[t.spreadsheetEnv];
    if (!spreadsheetId) {
      console.error(`SKIP ${t.name} — env ${t.spreadsheetEnv} is missing`);
      summary.push({ ...t, status: 'skipped: env missing' });
      continue;
    }

    try {
      const tabTitle =
        t.tabTitle ?? (await getFirstTabTitle(sheets, spreadsheetId));
      const rows = await fetchTab(sheets, spreadsheetId, tabTitle);
      const csv = rowsToCsv(rows);
      const outPath = `${OUT_DIR}/${t.name}.csv`;
      await writeFile(outPath, csv, 'utf8');
      console.log(
        `OK  ${t.name.padEnd(28)} → ${outPath} (${rows.length} rows, tab="${tabTitle}")`,
      );
      summary.push({ ...t, status: 'ok', rows: rows.length, outPath });
    } catch (err) {
      console.error(`FAIL ${t.name} — ${err.message}`);
      summary.push({ ...t, status: `fail: ${err.message}` });
    }
  }

  const failures = summary.filter((s) => s.status?.startsWith('fail'));
  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
