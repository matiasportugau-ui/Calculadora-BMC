/**
 * Google Ads client safety (#722) — dry-run default must never call mutateResources.
 * Offline: injects a fake GoogleAdsApi via __testApi.
 *
 * Run: node --test tests/googleAdsClient.test.js
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleAdsClient } from "../server/lib/googleAdsClient.js";

const FULL_CONFIG = {
  googleAdsDeveloperToken: "dev-token",
  googleAdsOAuthClientId: "client-id",
  googleAdsOAuthClientSecret: "client-secret",
  googleAdsRefreshToken: "refresh-token",
  googleAdsLoginCustomerId: "3971648492",
};

function makeTestApi({ mutateCalls }) {
  const campaignRow = {
    campaign: {
      id: 99,
      name: "Campaña test",
      status: 2,
      resource_name: "customers/8607757427/campaigns/99",
      campaign_budget: "customers/8607757427/campaignBudgets/7",
    },
  };

  return {
    async listAccessibleCustomers() {
      return ["customers/8607757427"];
    },
    Customer() {
      return {
        async *queryStream() {
          yield campaignRow;
        },
        async mutateResources(operations) {
          mutateCalls.push(operations);
          return { results: [{ resource_name: campaignRow.campaign.resource_name }] };
        },
      };
    },
  };
}

test("assertConfig fails closed when Google Ads env is incomplete", async () => {
  const client = createGoogleAdsClient({
    config: { ...FULL_CONFIG, googleAdsRefreshToken: "" },
    logger: { warn() {}, error() {} },
  });
  await assert.rejects(
    () => client.listAccessibleCustomers(),
    (err) => {
      assert.match(String(err.message), /Missing Google Ads configuration/);
      assert.match(String(err.message), /GOOGLE_ADS_REFRESH_TOKEN/);
      assert.equal(err.status, 500);
      return true;
    },
  );
});

test("pauseCampaign defaults to dry-run and never mutates", async () => {
  const mutateCalls = [];
  const client = createGoogleAdsClient({
    config: FULL_CONFIG,
    logger: { warn() {}, error() {} },
    __testApi: makeTestApi({ mutateCalls }),
  });

  const preview = await client.pauseCampaign("8607757427", "99");
  assert.equal(preview.dryRun, true);
  assert.equal(preview.applied, false);
  assert.equal(mutateCalls.length, 0);
  assert.ok(Array.isArray(preview.operations));
  assert.equal(preview.operations[0]?.entity, "campaign");
});

test("pauseCampaign with apply:true calls mutateResources once", async () => {
  const mutateCalls = [];
  const client = createGoogleAdsClient({
    config: FULL_CONFIG,
    logger: { warn() {}, error() {} },
    __testApi: makeTestApi({ mutateCalls }),
  });

  const applied = await client.pauseCampaign("8607757427", "99", { apply: true });
  assert.equal(applied.dryRun, false);
  assert.equal(applied.applied, true);
  assert.equal(mutateCalls.length, 1);
});

test("updateBudget dry-run keeps amount_micros on campaign_budget op", async () => {
  const mutateCalls = [];
  const client = createGoogleAdsClient({
    config: FULL_CONFIG,
    logger: { warn() {}, error() {} },
    __testApi: makeTestApi({ mutateCalls }),
  });

  const preview = await client.updateBudget("8607757427", "99", 1_500_000, { apply: false });
  assert.equal(preview.dryRun, true);
  assert.equal(mutateCalls.length, 0);
  assert.equal(preview.operations[0]?.entity, "campaign_budget");
  assert.equal(preview.operations[0]?.resource?.amount_micros, 1_500_000);
});
