import assert from "node:assert/strict";
import {
  getCockpitTokenRequestBrowserOrigin,
  isCockpitTokenEndpointEnabled,
  isCockpitTokenBrowserOriginAllowed,
} from "../server/lib/cockpitTokenOrigin.js";

const baseConfig = { publicBaseUrl: "https://panelin-calc-example-uc.a.run.app" };

assert.equal(isCockpitTokenBrowserOriginAllowed("https://calculadora-bmc.vercel.app", baseConfig), true);
assert.equal(isCockpitTokenBrowserOriginAllowed("https://evil.vercel.app", baseConfig), false);
assert.equal(
  isCockpitTokenBrowserOriginAllowed("https://calculadora-bmc-git-foo-matprompts-projects.vercel.app", baseConfig),
  true,
);
assert.equal(isCockpitTokenBrowserOriginAllowed("http://localhost:5173", baseConfig), true);
assert.equal(isCockpitTokenBrowserOriginAllowed("", baseConfig), false);
assert.equal(isCockpitTokenBrowserOriginAllowed("https://panelin-calc-example-uc.a.run.app", baseConfig), true);

const reqAllowed = { headers: { origin: "http://localhost:5173" } };
assert.equal(getCockpitTokenRequestBrowserOrigin(reqAllowed, baseConfig), "http://localhost:5173");

const reqNoHeaders = { headers: {} };
assert.equal(getCockpitTokenRequestBrowserOrigin(reqNoHeaders, baseConfig), "");

const reqReferer = {
  headers: {
    referer: "https://calculadora-bmc.vercel.app/wa-operativo",
  },
};
assert.equal(getCockpitTokenRequestBrowserOrigin(reqReferer, baseConfig), "https://calculadora-bmc.vercel.app");

const previousEnv = {
  appEnv: process.env.APP_ENV,
  nodeEnv: process.env.NODE_ENV,
  kService: process.env.K_SERVICE,
  bmcEndpoint: process.env.BMC_COCKPIT_TOKEN_ENDPOINT_ENABLED,
  legacyEndpoint: process.env.COCKPIT_TOKEN_ENDPOINT_ENABLED,
};

function restoreEnv() {
  for (const [key, value] of Object.entries({
    APP_ENV: previousEnv.appEnv,
    NODE_ENV: previousEnv.nodeEnv,
    K_SERVICE: previousEnv.kService,
    BMC_COCKPIT_TOKEN_ENDPOINT_ENABLED: previousEnv.bmcEndpoint,
    COCKPIT_TOKEN_ENDPOINT_ENABLED: previousEnv.legacyEndpoint,
  })) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

try {
  delete process.env.APP_ENV;
  delete process.env.NODE_ENV;
  delete process.env.K_SERVICE;
  delete process.env.BMC_COCKPIT_TOKEN_ENDPOINT_ENABLED;
  delete process.env.COCKPIT_TOKEN_ENDPOINT_ENABLED;

  assert.equal(
    isCockpitTokenEndpointEnabled({ appEnv: "development", publicBaseUrl: "http://localhost:3001" }),
    true,
  );
  assert.equal(
    isCockpitTokenEndpointEnabled({ appEnv: "production", publicBaseUrl: "https://panelin-calc.example.com" }),
    false,
  );
  assert.equal(
    isCockpitTokenEndpointEnabled({ appEnv: "development", publicBaseUrl: "https://panelin-calc-abc-uc.a.run.app" }),
    false,
  );

  process.env.K_SERVICE = "panelin-calc";
  assert.equal(
    isCockpitTokenEndpointEnabled({ appEnv: "development", publicBaseUrl: "http://localhost:3001" }),
    false,
  );

  process.env.BMC_COCKPIT_TOKEN_ENDPOINT_ENABLED = "true";
  assert.equal(
    isCockpitTokenEndpointEnabled({ appEnv: "production", publicBaseUrl: "https://panelin-calc-abc-uc.a.run.app" }),
    true,
  );
} finally {
  restoreEnv();
}

console.log("cockpitTokenOrigin tests OK");
