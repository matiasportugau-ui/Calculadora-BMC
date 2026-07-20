import { GoogleAdsApi, enums } from "google-ads-api";

// ═══════════════════════════════════════════════════════════════════════════
// server/lib/googleAdsClient.js — Google Ads API client for BMC Uruguay.
// ───────────────────────────────────────────────────────────────────────────
// Static refresh token (no rotating token-store write-back like ML's OAuth —
// see server/mercadoLibreClient.js for that pattern). customerId is always a
// per-call argument, never hardcoded, so one client serves all BMC accounts
// (BMC Uruguay 8607757427, BMC 5831137980) under the shared MCC
// (googleAdsLoginCustomerId, "BMC Manager" 3971648492).
//
// Every mutation defaults to dryRun (apply=false): it resolves the target
// resource and builds the operation, but never calls mutateResources unless
// the caller explicitly passes { apply: true }. See docs/procedimientos/
// GOOGLE-ADS-SETUP.md for credential provisioning.
// ═══════════════════════════════════════════════════════════════════════════

export const createGoogleAdsClient = ({
  config,
  logger,
  GoogleAdsApiClass = GoogleAdsApi,
  campaignStatus = enums.CampaignStatus,
}) => {
  let _client = null;

  const assertConfig = () => {
    const missing = [];
    if (!config.googleAdsDeveloperToken) missing.push("GOOGLE_ADS_DEVELOPER_TOKEN");
    if (!config.googleAdsOAuthClientId) missing.push("GOOGLE_ADS_OAUTH_CLIENT_ID");
    if (!config.googleAdsOAuthClientSecret) missing.push("GOOGLE_ADS_OAUTH_CLIENT_SECRET");
    if (!config.googleAdsRefreshToken) missing.push("GOOGLE_ADS_REFRESH_TOKEN");
    if (missing.length > 0) {
      const err = new Error(`Missing Google Ads configuration: ${missing.join(", ")}`);
      err.status = 500;
      throw err;
    }
  };

  const getClient = () => {
    assertConfig();
    if (!_client) {
      _client = new GoogleAdsApiClass({
        client_id: config.googleAdsOAuthClientId,
        client_secret: config.googleAdsOAuthClientSecret,
        developer_token: config.googleAdsDeveloperToken,
      });
    }
    return _client;
  };

  const getCustomer = (customerId) => {
    if (!customerId) {
      const err = new Error("customerId is required");
      err.status = 400;
      throw err;
    }
    return getClient().Customer({
      customer_id: String(customerId).replace(/-/g, ""),
      login_customer_id: config.googleAdsLoginCustomerId || undefined,
      refresh_token: config.googleAdsRefreshToken,
    });
  };

  /** Equivalent to CustomerService.listAccessibleCustomers — proves the refresh token works. */
  const listAccessibleCustomers = async () => {
    assertConfig();
    return getClient().listAccessibleCustomers(config.googleAdsRefreshToken);
  };

  /** Runs a GAQL query against one customer, returning all rows (buffers the stream). */
  const searchStream = async (customerId, gaqlQuery) => {
    const customer = getCustomer(customerId);
    const rows = [];
    for await (const row of customer.queryStream(gaqlQuery)) {
      rows.push(row);
    }
    return rows;
  };

  const findCampaign = async (customerId, campaignId) => {
    const rows = await searchStream(
      customerId,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.resource_name,
              campaign.campaign_budget
       FROM campaign WHERE campaign.id = ${Number(campaignId)}`,
    );
    if (!rows.length) {
      const err = new Error(`Campaign ${campaignId} not found on customer ${customerId}`);
      err.status = 404;
      throw err;
    }
    return rows[0].campaign;
  };

  /** Central gate: builds the operation, only calls mutateResources when apply=true. */
  const previewOrApply = async ({ customerId, operations, apply }) => {
    if (!apply) {
      return { dryRun: true, applied: false, customerId, operations };
    }
    const customer = getCustomer(customerId);
    const result = await customer.mutateResources(operations);
    logger?.warn?.({ customerId, operations }, "Google Ads mutation APPLIED (not a dry run)");
    return { dryRun: false, applied: true, customerId, result };
  };

  const setCampaignStatus = async (customerId, campaignId, status, { apply = false } = {}) => {
    const campaign = await findCampaign(customerId, campaignId);
    return previewOrApply({
      customerId,
      apply,
      operations: [
        {
          entity: "campaign",
          operation: "update",
          resource: { resource_name: campaign.resource_name, status },
        },
      ],
    });
  };

  const pauseCampaign = (customerId, campaignId, opts) =>
    setCampaignStatus(customerId, campaignId, campaignStatus.PAUSED, opts);

  const enableCampaign = (customerId, campaignId, opts) =>
    setCampaignStatus(customerId, campaignId, campaignStatus.ENABLED, opts);

  const updateCampaignName = async (customerId, campaignId, name, { apply = false } = {}) => {
    const campaign = await findCampaign(customerId, campaignId);
    return previewOrApply({
      customerId,
      apply,
      operations: [
        {
          entity: "campaign",
          operation: "update",
          resource: { resource_name: campaign.resource_name, name },
        },
      ],
    });
  };

  /** Budget lives on a separate CampaignBudget resource, referenced by campaign.campaign_budget. */
  const updateBudget = async (customerId, campaignId, amountMicros, { apply = false } = {}) => {
    const campaign = await findCampaign(customerId, campaignId);
    if (!campaign.campaign_budget) {
      const err = new Error(`Campaign ${campaignId} has no linked campaign_budget`);
      err.status = 409;
      throw err;
    }
    return previewOrApply({
      customerId,
      apply,
      operations: [
        {
          entity: "campaign_budget",
          operation: "update",
          resource: {
            resource_name: campaign.campaign_budget,
            amount_micros: Number(amountMicros),
          },
        },
      ],
    });
  };

  return {
    listAccessibleCustomers,
    searchStream,
    findCampaign,
    pauseCampaign,
    enableCampaign,
    updateCampaignName,
    updateBudget,
  };
};
