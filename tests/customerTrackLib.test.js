/**
 * Run: node tests/customerTrackLib.test.js
 */
import assert from "node:assert/strict";
import { trackingPublicUrl, mintTrackToken } from "../server/lib/customerTrack.js";
import { sha256Hex } from "../server/lib/driverToken.js";

console.log("customerTrackLib");

{
  const url = trackingPublicUrl("https://calculadora-bmc.vercel.app", "abcToken");
  assert.equal(url, "https://calculadora-bmc.vercel.app/seguimiento/abcToken");
  const encoded = trackingPublicUrl("https://calculadora-bmc.vercel.app/", "../admin?x=1");
  assert.equal(encoded, "https://calculadora-bmc.vercel.app/seguimiento/..%2Fadmin%3Fx%3D1");
  console.log("  ✓ public URL uses frontend host and encodes token");
}

{
  const { token, tokenHash } = mintTrackToken();
  assert.ok(token.length >= 32);
  assert.equal(tokenHash, sha256Hex(token));
  assert.notEqual(tokenHash, token);
  console.log("  ✓ token is hashed, not stored raw");
}

console.log("customerTrackLib OK");
