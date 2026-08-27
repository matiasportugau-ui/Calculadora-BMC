/**
 * Driver login intent: chofer password vs magic-link token.
 * Run: node tests/driverLoginIntent.test.js
 */
import assert from "node:assert/strict";
import { generateOpaqueToken } from "../server/lib/driverToken.js";
import {
  looksLikeOpaqueDriverToken,
  identityLooksLikeEmailOrPhone,
  resolveDriverLoginIntent,
} from "../src/utils/logistica/driverLoginIntent.js";

console.log("driverLoginIntent");

{
  assert.equal(identityLooksLikeEmailOrPhone("juan@bmc.uy"), true);
  assert.equal(identityLooksLikeEmailOrPhone("099123456"), true);
  assert.equal(identityLooksLikeEmailOrPhone("+598 99 123 456"), true);
  assert.equal(identityLooksLikeEmailOrPhone("Juan"), false);
  assert.equal(identityLooksLikeEmailOrPhone(""), false);
  console.log("  ✓ identity email/phone detection");
}

{
  const opaque = generateOpaqueToken(32);
  assert.equal(looksLikeOpaqueDriverToken(opaque), true);
  assert.equal(looksLikeOpaqueDriverToken("secreto1"), false);
  assert.equal(looksLikeOpaqueDriverToken("short"), false);
  console.log("  ✓ opaque token heuristic");
}

{
  const opaque = generateOpaqueToken(32);
  // #1147 bug: phone + magic token must be magic_token, not chofer_password
  const thirdParty = resolveDriverLoginIntent("099123456", opaque);
  assert.equal(thirdParty.mode, "magic_token");
  assert.equal(thirdParty.tokenCandidate, opaque);

  const fleet = resolveDriverLoginIntent("juan@bmc.uy", "secreto1");
  assert.equal(fleet.mode, "chofer_password");

  const namePlusToken = resolveDriverLoginIntent("Juan", opaque);
  assert.equal(namePlusToken.mode, "magic_token");
  assert.equal(namePlusToken.tokenCandidate, opaque);

  const tokenOnly = resolveDriverLoginIntent("", opaque);
  assert.equal(tokenOnly.mode, "magic_token");
  assert.equal(tokenOnly.tokenCandidate, opaque);
  console.log("  ✓ phone/email + opaque token → magic-link (not chofer/login)");
}

console.log("driverLoginIntent OK");
