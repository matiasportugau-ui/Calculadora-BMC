// Module: product-intelligence | Owner: bmc-dev | Created: 2026-06-29
// Collects and aggregates product data from MATRIZ, ETL, CRM, and ML
// for the AI-powered Product Intelligence Dashboard.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import pino from 'pino';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

function loadJson(filename) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf-8'));
  } catch (err) {
    log.warn({ err, filename }, 'Failed to load static data file');
    return null;
  }
}

let _data = null;
function getData() {
  if (!_data) {
    _data = {
      baselinePrices: loadJson('bmcBaselinePrices.json'),
      competitorMap: loadJson('competitorMap.json'),
      adsIntelligence: loadJson('adsIntelligence.json'),
      mlPulse: loadJson('mlPulse.json'),
    };
  }
  return _data;
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

// Product categories mapped to their internal panel keys and display names
export const PRODUCT_CATEGORIES = [
  { id: 'techos_isodec_eps',   label: 'ISODEC EPS (Techo)',   families: ['ISODEC_EPS', 'ISODEC_EPS_100'] },
  { id: 'techos_isodec_pir',   label: 'ISODEC PIR (Techo)',   families: ['ISODEC_PIR'] },
  { id: 'techos_isoroof_3g',   label: 'ISOROOF 3G (Techo)',   families: ['ISOROOF_3G', 'ISOROOF_PLUS_3G', 'ISOROOF_FOIL_3G', 'ISOROOF_COLONIAL'] },
  { id: 'paredes_isopanel_eps',label: 'ISOPANEL EPS (Pared)',  families: ['ISOPANEL_EPS', 'ISOPANEL_EPS_120', 'ISOPANEL_EPS_150', 'ISOPANEL_EPS_200', 'ISOPANEL_EPS_250'] },
  { id: 'paredes_isowall_pir', label: 'ISOWALL PIR (Pared)',   families: ['ISOWALL_PIR'] },
  { id: 'paredes_iso frig_pir',label: 'ISOFRIG PIR (Pared)',   families: ['ISOFRIG_PIR'] },
  { id: 'perfiles_techo',      label: 'Perfiles Techo',        families: [] },
  { id: 'perfiles_pared',      label: 'Perfiles Pared',        families: [] },
  { id: 'fijaciones',          label: 'Fijaciones',            families: [] },
  { id: 'selladores',          label: 'Selladores',            families: [] },
];

// Competitor product focus based on seeded metadata
const COMPETITOR_PRODUCT_FOCUS = {
  'ARMCO':              ['econopanel', 'tejapanel', 'steel_framing'],
  'BECAM SA':           ['hiansa_panel_5g', 'chapas', 'perfiles'],
  'Casa del Panel':     ['isopanel', 'panel_sandwich'],
  'Kingspan Bromyros':  ['ks1000', 'pir', 'panel_sandwich'],
};

export async function getEtlSummary() {
  try {
    const [lastRun, alertCounts, competitors] = await Promise.all([
      pool().query(`SELECT * FROM bmc_market_intel.v_last_etl_run`),
      pool().query(`SELECT * FROM bmc_market_intel.v_alert_counts`),
      pool().query(`SELECT id, name, domain, type, tier, threat_score, opportunity_score, metadata, notes, is_active FROM bmc_market_intel.competitors WHERE is_active = TRUE ORDER BY name`),
    ]);

    return {
      last_etl_run: lastRun.rows[0] ?? null,
      alert_counts: {
        info:     parseInt(alertCounts.rows[0]?.info_count ?? '0', 10),
        warning:  parseInt(alertCounts.rows[0]?.warning_count ?? '0', 10),
        critical: parseInt(alertCounts.rows[0]?.critical_count ?? '0', 10),
      },
      competitors: competitors.rows,
    };
  } catch (err) {
    log.error({ err }, 'getEtlSummary failed');
    return { last_etl_run: null, alert_counts: { info: 0, warning: 0, critical: 0 }, competitors: [] };
  }
}

export async function getPriceHistory(limitDays = 7) {
  try {
    const result = await pool().query(
      `SELECT ph.*, c.name AS competitor_name, c.domain
       FROM bmc_market_intel.price_history ph
       JOIN bmc_market_intel.competitors c ON c.id = ph.competitor_id
       WHERE ph.scraped_at >= NOW() - $1::interval
       ORDER BY ph.scraped_at DESC`,
      [`${limitDays} days`]
    );
    return result.rows;
  } catch (err) {
    log.error({ err }, 'getPriceHistory failed');
    return [];
  }
}

export function getBaselinePrices() {
  return getData().baselinePrices;
}

export function getCompetitorMap() {
  return getData().competitorMap;
}

export function getAdsIntelligence() {
  return getData().adsIntelligence;
}

export function getMlPulse() {
  return getData().mlPulse;
}

export async function getRecentAlerts(limit = 20) {
  try {
    const result = await pool().query(
      `SELECT a.*, c.name AS competitor_name, c.domain
       FROM bmc_market_intel.alerts a
       JOIN bmc_market_intel.competitors c ON c.id = a.competitor_id
       ORDER BY a.created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    log.error({ err }, 'getRecentAlerts failed');
    return [];
  }
}
