import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleAdsClient } from "../server/lib/googleAdsClient.js";
import { __test__ as adsRouteTest } from "../server/routes/ads.js";

const completeConfig = {
  googleAdsDeveloperToken: "developer-token",
  googleAdsOAuthClientId: "oauth-client",
  googleAdsOAuthClientSecret: "oauth-secret",
  googleAdsRefreshToken: "refresh-token",
  googleAdsLoginCustomerId: "3971648492",
};

function makeClientHarness({ campaign, mutationResult = { resource_names: ["updated"] } } = {}) {
  const state = {
    constructorOptions: null,
    customerOptions: [],
    queries: [],
    mutations: [],
    warnings: [],
  };

  const customer = {
    async *queryStream(query) {
      state.queries.push(query);
      if (campaign) yield { campaign };
    },
    async mutateResources(operations) {
      state.mutations.push(operations);
      return mutationResult;
    },
  };

  class FakeGoogleAdsApi {
    constructor(options) {
      state.constructorOptions = options;
    }

    Customer(options) {
      state.customerOptions.push(options);
      return customer;
    }

    async listAccessibleCustomers() {
      return ["customers/8607757427"];
    }
  }

  const client = createGoogleAdsClient({
    config: completeConfig,
    GoogleAdsApiClass: FakeGoogleAdsApi,
    campaignStatus: { PAUSED: "PAUSED_TEST", ENABLED: "ENABLED_TEST" },
    logger: {
      warn(context, message) {
        state.warnings.push({ context, message });
      },
    },
  });

  return { client, state };
}

test("Google Ads client fails closed when mutation credentials are incomplete", async () => {
  let constructed = 0;
  class UnexpectedGoogleAdsApi {
    constructor() {
      constructed += 1;
    }
  }
  const client = createGoogleAdsClient({
    config: { ...completeConfig, googleAdsRefreshToken: "" },
    GoogleAdsApiClass: UnexpectedGoogleAdsApi,
  });

  await assert.rejects(
    () => client.listAccessibleCustomers(),
    (error) =>
      error.status === 500 &&
      error.message === "Missing Google Ads configuration: GOOGLE_ADS_REFRESH_TOKEN",
  );
  assert.equal(constructed, 0, "an incomplete configuration must not instantiate the SDK");
});

test("campaign mutations default to a preview and never call mutateResources", async () => {
  const { client, state } = makeClientHarness({
    campaign: {
      resource_name: "customers/8607757427/campaigns/123",
      campaign_budget: "customers/8607757427/campaignBudgets/456",
    },
  });

  const result = await client.pauseCampaign("860-775-7427", "123");

  assert.equal(result.dryRun, true);
  assert.equal(result.applied, false);
  assert.equal(state.mutations.length, 0);
  assert.deepEqual(result.operations, [
    {
      entity: "campaign",
      operation: "update",
      resource: {
        resource_name: "customers/8607757427/campaigns/123",
        status: "PAUSED_TEST",
      },
    },
  ]);
  assert.equal(state.customerOptions[0].customer_id, "8607757427");
  assert.equal(state.customerOptions[0].login_customer_id, "3971648492");
});

test("campaign mutations call mutateResources only after explicit apply opt-in", async () => {
  const { client, state } = makeClientHarness({
    campaign: { resource_name: "customers/8607757427/campaigns/123" },
  });

  const result = await client.enableCampaign("8607757427", "123", { apply: true });

  assert.equal(result.dryRun, false);
  assert.equal(result.applied, true);
  assert.deepEqual(result.result, { resource_names: ["updated"] });
  assert.equal(state.mutations.length, 1);
  assert.equal(state.mutations[0][0].resource.status, "ENABLED_TEST");
  assert.equal(state.warnings.length, 1);
  assert.match(state.warnings[0].message, /APPLIED/);
});

test("budget updates reject campaigns without a linked budget before mutation", async () => {
  const { client, state } = makeClientHarness({
    campaign: { resource_name: "customers/8607757427/campaigns/123" },
  });

  await assert.rejects(
    () => client.updateBudget("8607757427", "123", 5_000_000, { apply: true }),
    (error) => error.status === 409 && /no linked campaign_budget/.test(error.message),
  );
  assert.equal(state.mutations.length, 0);
});

test("Ads routes treat only the literal boolean true as mutation approval", () => {
  for (const body of [undefined, {}, { apply: false }, { apply: "true" }, { apply: 1 }]) {
    assert.equal(adsRouteTest.shouldApplyMutation(body), false);
  }
  assert.equal(adsRouteTest.shouldApplyMutation({ apply: true }), true);
});

test("Ads route validators reject invalid budgets and normalize valid inputs", () => {
  for (const body of [
    undefined,
    {},
    { amount_micros: 0 },
    { amount_micros: -1 },
    { amount_micros: "not-a-number" },
  ]) {
    assert.throws(
      () => adsRouteTest.parseBudgetAmountMicros(body),
      (error) => error.status === 400 && /positive number/.test(error.message),
    );
  }
  assert.equal(adsRouteTest.parseBudgetAmountMicros({ amount_micros: "2500000" }), 2_500_000);
});

test("Ads route validators reject blank campaign names and trim valid names", () => {
  for (const body of [undefined, {}, { name: "" }, { name: "   " }, { name: 123 }]) {
    assert.throws(
      () => adsRouteTest.parseCampaignName(body),
      (error) => error.status === 400 && error.message === "name is required",
    );
  }
  assert.equal(adsRouteTest.parseCampaignName({ name: "  Campaña BMC  " }), "Campaña BMC");
});
