// Module: google-ads | Owner: bmc-dev | Created: 2026-07-14
// Mount in server/index.js:
//   import adsRouter from './routes/ads.js';
//   app.use('/api/ads', adsRouter);
//
// RBAC: reuses the same coarse gate as routes/marketing.js
// (requireServiceOrUser({ role: 'admin' })) — a fine-grained `ads` module in
// identity.modules is a deferred fast-follow, not part of this milestone.
//
// Safety: every mutation route defaults to a dry-run preview. It only calls
// the real Google Ads mutateResources endpoint when the caller passes
// { apply: true } in the request body — see server/lib/googleAdsClient.js.

import { Router } from 'express';
import pg from 'pg';
import pino from 'pino';
import { requireServiceOrUser } from '../middleware/requireServiceOrUser.js';
import { config } from '../config.js';
import { createGoogleAdsClient } from '../lib/googleAdsClient.js';
import { logActivity } from '../lib/userActivityLog.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const requireAds = requireServiceOrUser({ role: 'admin' });
const router = Router();
const googleAds = createGoogleAdsClient({ config, logger: log });

let _pool = null;
const pool = () => {
  if (!_pool) {
    if (!process.env.DATABASE_URL) return null;
    _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
};

const audit = (req, action, { resourceType, resourceId, outcome, payload } = {}) => {
  logActivity({
    pool: pool(),
    actorId: req.user?.id ?? null,
    action,
    resourceType,
    resourceId,
    outcome,
    payload,
    req,
  }).catch(() => {});
};

// ─── GET /api/ads/accounts ────────────────────────────────────────
// Proves the refresh token works and lists every account it can see —
// use this to resolve which of BMC's accounts are actually reachable
// today, rather than assuming.
router.get('/accounts', requireAds, async (req, res) => {
  try {
    const resourceNames = await googleAds.listAccessibleCustomers();
    audit(req, 'ads.account.query', { resourceType: 'accounts', outcome: 'success' });
    res.json({ resource_names: resourceNames });
  } catch (err) {
    log.error({ err, route: 'GET /accounts' }, 'listAccessibleCustomers failed');
    audit(req, 'ads.account.query', { resourceType: 'accounts', outcome: 'failure' });
    res.status(502).json({ error: 'Google Ads API request failed', message: err?.message });
  }
});

// ─── GET /api/ads/accounts/:customerId/campaigns ──────────────────
router.get('/accounts/:customerId/campaigns', requireAds, async (req, res) => {
  const { customerId } = req.params;
  try {
    const rows = await googleAds.searchStream(
      customerId,
      `SELECT campaign.id, campaign.name, campaign.status,
              campaign.advertising_channel_type, campaign_budget.amount_micros
       FROM campaign ORDER BY campaign.id`,
    );
    audit(req, 'ads.account.query', { resourceType: 'campaigns', resourceId: customerId, outcome: 'success' });
    res.json({ customer_id: customerId, campaigns: rows });
  } catch (err) {
    log.error({ err, route: 'GET /accounts/:customerId/campaigns', customerId }, 'campaign query failed');
    audit(req, 'ads.account.query', { resourceType: 'campaigns', resourceId: customerId, outcome: 'failure' });
    res.status(502).json({ error: 'Google Ads API request failed', message: err?.message });
  }
});

// ─── GET /api/ads/accounts/:customerId/report ─────────────────────
// The PDF-verification pass: account status, current campaign state,
// last-90-days spend/clicks/conversions, and whether conversion tracking
// (conversion_action) is actually configured. Read-only, no mutation.
router.get('/accounts/:customerId/report', requireAds, async (req, res) => {
  const { customerId } = req.params;
  try {
    const [customerRows, campaignRows, metricRows, conversionActionRows] = await Promise.all([
      googleAds.searchStream(
        customerId,
        `SELECT customer.descriptive_name, customer.status, customer.currency_code,
                customer.test_account
         FROM customer LIMIT 1`,
      ),
      googleAds.searchStream(
        customerId,
        `SELECT campaign.id, campaign.name, campaign.status,
                campaign.advertising_channel_type, campaign_budget.amount_micros
         FROM campaign ORDER BY campaign.id`,
      ),
      googleAds.searchStream(
        customerId,
        `SELECT segments.date, campaign.name, metrics.clicks, metrics.impressions,
                metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM campaign WHERE segments.date DURING LAST_90_DAYS`,
      ),
      googleAds.searchStream(
        customerId,
        `SELECT conversion_action.id, conversion_action.name, conversion_action.status,
                conversion_action.type, conversion_action.category
         FROM conversion_action`,
      ),
    ]);
    audit(req, 'ads.account.query', { resourceType: 'report', resourceId: customerId, outcome: 'success' });
    res.json({
      customer_id: customerId,
      customer: customerRows[0]?.customer ?? null,
      campaigns: campaignRows.map((r) => r.campaign),
      metrics_last_90_days: metricRows,
      conversion_actions: conversionActionRows.map((r) => r.conversion_action),
    });
  } catch (err) {
    log.error({ err, route: 'GET /accounts/:customerId/report', customerId }, 'report query failed');
    audit(req, 'ads.account.query', { resourceType: 'report', resourceId: customerId, outcome: 'failure' });
    res.status(502).json({ error: 'Google Ads API request failed', message: err?.message });
  }
});

// ─── GET /api/ads/mcc/linked-accounts ─────────────────────────────
// Which customer IDs are actually linked under the MCC today — resolves
// the "is BMC Uruguay linked yet" question from live data, not assumption.
router.get('/mcc/linked-accounts', requireAds, async (req, res) => {
  const mccId = config.googleAdsLoginCustomerId;
  if (!mccId) return res.status(500).json({ error: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID not configured' });
  try {
    const rows = await googleAds.searchStream(
      mccId,
      `SELECT customer_client.id, customer_client.descriptive_name,
              customer_client.status, customer_client.manager, customer_client.level
       FROM customer_client`,
    );
    audit(req, 'ads.account.query', { resourceType: 'mcc_linked_accounts', resourceId: mccId, outcome: 'success' });
    res.json({ mcc_id: mccId, linked_accounts: rows.map((r) => r.customer_client) });
  } catch (err) {
    log.error({ err, route: 'GET /mcc/linked-accounts' }, 'customer_client query failed');
    audit(req, 'ads.account.query', { resourceType: 'mcc_linked_accounts', resourceId: mccId, outcome: 'failure' });
    res.status(502).json({ error: 'Google Ads API request failed', message: err?.message });
  }
});

const mutationHandler = (action, fn) => async (req, res) => {
  const { customerId, campaignId } = req.params;
  const apply = req.body?.apply === true;
  try {
    const result = await fn(req, { customerId, campaignId, apply });
    audit(req, action, {
      resourceType: 'campaign',
      resourceId: campaignId,
      outcome: 'success',
      payload: { customerId, apply },
    });
    res.json(result);
  } catch (err) {
    log.error({ err, action, customerId, campaignId }, 'campaign mutation failed');
    audit(req, action, {
      resourceType: 'campaign',
      resourceId: campaignId,
      outcome: 'failure',
      payload: { customerId, apply },
    });
    const status = err?.status && err.status >= 400 && err.status < 500 ? err.status : 502;
    res.status(status).json({ error: 'Google Ads mutation failed', message: err?.message });
  }
};

// ─── POST /api/ads/accounts/:customerId/campaigns/:campaignId/pause ───
router.post(
  '/accounts/:customerId/campaigns/:campaignId/pause',
  requireAds,
  mutationHandler('ads.campaign.pause', (req, { customerId, campaignId, apply }) =>
    googleAds.pauseCampaign(customerId, campaignId, { apply }),
  ),
);

// ─── POST /api/ads/accounts/:customerId/campaigns/:campaignId/enable ──
router.post(
  '/accounts/:customerId/campaigns/:campaignId/enable',
  requireAds,
  mutationHandler('ads.campaign.enable', (req, { customerId, campaignId, apply }) =>
    googleAds.enableCampaign(customerId, campaignId, { apply }),
  ),
);

// ─── POST /api/ads/accounts/:customerId/campaigns/:campaignId/budget ──
router.post(
  '/accounts/:customerId/campaigns/:campaignId/budget',
  requireAds,
  mutationHandler('ads.campaign.update_budget', (req, { customerId, campaignId, apply }) => {
    const amountMicros = Number(req.body?.amount_micros);
    if (!Number.isFinite(amountMicros) || amountMicros <= 0) {
      const err = new Error('amount_micros must be a positive number');
      err.status = 400;
      throw err;
    }
    return googleAds.updateBudget(customerId, campaignId, amountMicros, { apply });
  }),
);

// ─── POST /api/ads/accounts/:customerId/campaigns/:campaignId/name ────
router.post(
  '/accounts/:customerId/campaigns/:campaignId/name',
  requireAds,
  mutationHandler('ads.campaign.update_name', (req, { customerId, campaignId, apply }) => {
    const name = req.body?.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error('name is required');
      err.status = 400;
      throw err;
    }
    return googleAds.updateCampaignName(customerId, campaignId, name.trim(), { apply });
  }),
);

export default router;
