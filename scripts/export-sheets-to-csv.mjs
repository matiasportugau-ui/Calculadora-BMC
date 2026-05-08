#!/usr/bin/env node
/**
 * Export BMC Google Sheets tabs to CSV files for RAG ingest.
 *
 * Mapping rule:
 *   - Never reference nonexistent tabs.
 *   - The full per-workbook mapping comes from
 *     `scripts/discover-sheets-mapping.mjs` → /tmp/panelin-rag/sheets-mapping.json.
 *   - This script reads that mapping and ingests 100% of every tab in every
 *     workbook listed in INGEST_SCOPE below.
 *
 * Output: /tmp/panelin-rag/sheets/<workbookNum>_<tabSlug>.csv
 * Idempotent — overwrites on re-run.
 *
 * Auth: GOOGLE_APPLICATION_CREDENTIALS (service account JSON path).
 */

import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { google } from 'googleapis';

const OUT_DIR = '/tmp/panelin-rag/sheets';
const MAPPING_PATH = '/tmp/panelin-rag/sheets-mapping.json';

// Workbooks to fully ingest. Tabs are resolved from the mapping JSON, so
// nonexistent or renamed tabs cannot leak in.
const INGEST_SCOPE = ['BMC_SHEET_ID', 'BMC_PAGOS_SHEET_ID'];

const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'untitled';

function csvEscape(cell) {
  const s = cell == null ? '' : String(cell);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
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

async function loadMapping() {
  if (!existsSync(MAPPING_PATH)) {
    throw new Error(
      `Mapping not found at ${MAPPING_PATH}. Run scripts/discover-sheets-mapping.mjs first.`,
    );
  }
  return JSON.parse(await readFile(MAPPING_PATH, 'utf8'));
}

async function main() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set in .env');
  }

  const mapping = await loadMapping();
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  await mkdir(OUT_DIR, { recursive: true });

  const summary = [];
  for (const wb of mapping.workbooks) {
    if (!INGEST_SCOPE.includes(wb.envId)) continue;
    if (wb.status !== 'ok') {
      console.error(`SKIP ${wb.envId} — ${wb.status}`);
      summary.push({ envId: wb.envId, status: `skipped: ${wb.status}` });
      continue;
    }
    const id = wb.spreadsheetId || process.env[wb.envId];
    if (!id) {
      console.error(
        `SKIP ${wb.envId} — missing spreadsheetId in mapping and env var ${wb.envId} is not set.`,
      );
      summary.push({
        envId: wb.envId,
        status: `skipped: missing spreadsheetId (mapping/env ${wb.envId})`,
      });
      continue;
    }
    if (wb.spreadsheetId && process.env[wb.envId] && process.env[wb.envId] !== wb.spreadsheetId) {
      console.warn(
        `WARN ${wb.envId} mapping spreadsheetId differs from current env. Using mapping spreadsheetId from discovery output for reproducibility.`,
      );
    }
    for (const tab of wb.tabs) {
      const name = `${wb.num}_${slug(tab.title)}`;
      try {
        const rows = await fetchTab(sheets, id, tab.title);
        const csv = rowsToCsv(rows);
        const outPath = `${OUT_DIR}/${name}.csv`;
        await writeFile(outPath, csv, 'utf8');
        console.log(
          `OK  ${name.padEnd(50)} → ${outPath} (${rows.length} rows, tab="${tab.title}")`,
        );
        summary.push({ workbook: wb.envId, tab: tab.title, status: 'ok', rows: rows.length, outPath });
      } catch (err) {
        console.error(`FAIL ${name} (tab="${tab.title}") — ${err.message}`);
        summary.push({ workbook: wb.envId, tab: tab.title, status: `fail: ${err.message}` });
      }
    }
  }

  const failures = summary.filter((s) => s.status?.startsWith('fail'));
  console.log(`\n${summary.length} tabs processed, ${failures.length} failures.`);
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
