import assert from "node:assert/strict";
import {
  getCockpitTokenRequestBrowserOrigin,
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

console.log("cockpitTokenOrigin tests OK");
