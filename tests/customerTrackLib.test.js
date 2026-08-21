/**
 * Run: node tests/customerTrackLib.test.js
 */
import assert from "node:assert/strict";
import { trackingPublicUrl, mintTrackToken, buildPublicTrackPayload } from "../server/lib/customerTrack.js";
import { sha256Hex } from "../server/lib/driverToken.js";

console.log("customerTrackLib");

{
  const url = trackingPublicUrl("https://calculadora-bmc.vercel.app", "abcToken");
  assert.equal(url, "https://calculadora-bmc.vercel.app/seguimiento/abcToken");
  console.log("  ✓ public URL uses frontend host");
}

{
  const { token, tokenHash } = mintTrackToken();
  assert.ok(token.length >= 32);
  assert.equal(tokenHash, sha256Hex(token));
  assert.notEqual(tokenHash, token);
  console.log("  ✓ token is hashed, not stored raw");
}

{
  const url = trackingPublicUrl("https://calculadora-bmc.vercel.app/", "../secret?x=1");
  assert.equal(url, "https://calculadora-bmc.vercel.app/seguimiento/..%2Fsecret%3Fx%3D1");
  console.log("  ✓ public URL encodes token path/query");
}

{
  const payload = buildPublicTrackPayload({
    snapshot: {
      quote_ref: "BMC-1",
      customer_display_name: "Silva",
      driver_phone: "+59899111222",
    },
    tripStatus: "draft",
    events: [],
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.order.ref, "BMC-1");
  assert.equal(payload.order.customer, "Silva");
  assert.equal(payload.truck, null);
  assert.equal(JSON.stringify(payload).includes("59899111222"), false);
  console.log("  ✓ public payload ok + strips driver phone");
}

console.log("customerTrackLib OK");
