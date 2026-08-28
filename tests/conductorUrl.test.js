import assert from "node:assert/strict";
import { conductorPublicUrl } from "../src/utils/conductorUrl.js";
import { driverInstallUrl, driverRouteUrl, isDriverRouteUrl } from "../src/utils/logistica/driverQr.js";
import { driverIdFromPhone, ensureStopUuid } from "../server/lib/driverId.js";

console.log("conductorUrl + driverId");

assert.equal(
  conductorPublicUrl("https://calculadora-bmc.vercel.app", "tok"),
  "https://calculadora-bmc.vercel.app/conductor?t=tok",
);
assert.ok(!conductorPublicUrl("https://x.com", "a").includes("/calculadora/conductor"));

{
  const install = driverInstallUrl("https://calculadora-bmc.vercel.app");
  const route = driverRouteUrl("https://calculadora-bmc.vercel.app", "tok");
  assert.equal(install, "https://calculadora-bmc.vercel.app/conductor");
  assert.equal(route, conductorPublicUrl("https://calculadora-bmc.vercel.app", "tok"));
  assert.equal(isDriverRouteUrl(route), true);
  assert.equal(isDriverRouteUrl(install), false);
  console.log("  ✓ install QR payload /conductor; route QR is same as driver_url");
}

const a = driverIdFromPhone("+59899111222");
const b = driverIdFromPhone("59899111222");
assert.equal(a, b);
assert.match(a, /^[0-9a-f-]{36}$/);

const u = ensureStopUuid({ id: "s1" }, 0);
assert.match(u, /^[0-9a-f-]{36}$/);
assert.equal(ensureStopUuid({ id: "11111111-1111-4111-8111-111111111111" }, 0), "11111111-1111-4111-8111-111111111111");

console.log("conductorUrl + driverId OK");
