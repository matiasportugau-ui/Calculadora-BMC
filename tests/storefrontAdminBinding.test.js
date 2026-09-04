// HMAC Admin-row binding for public storefront — blocks IDOR on /chat /log.
// Run: node tests/storefrontAdminBinding.test.js

import assert from "node:assert/strict";
import {
  mintStorefrontAdminToken,
  resolveBoundAdminRow,
  storefrontBindingSecret,
  STOREFRONT_ADMIN_TOKEN_TTL_MS,
} from "../server/lib/voice/storefrontAdminBinding.js";
import { boundAdminRowFromRequest } from "../server/routes/publicVoice.js";

const cfg = { identityJwtSecret: "test-storefront-binding-secret-32b" };
assert.ok(storefrontBindingSecret(cfg).length >= 16);
assert.equal(storefrontBindingSecret({ identityJwtSecret: "short" }), "");

const token = mintStorefrontAdminToken(
  { adminRow: 31, telefono: "099123456" },
  cfg,
  1_700_000_000_000,
);
assert.ok(token && token.includes("."), "mints opaque token");

const ok = resolveBoundAdminRow(
  { adminToken: token, telefono: "099123456" },
  cfg,
  1_700_000_000_000,
);
assert.equal(ok.ok, true);
assert.equal(ok.adminRow, 31);

const spoof = resolveBoundAdminRow(
  { adminToken: token, telefono: "091111111" },
  cfg,
  1_700_000_000_000,
);
assert.equal(spoof.ok, false, "phone mismatch rejects");

const forged = resolveBoundAdminRow(
  { adminToken: token.replace(/\.[^.]+$/, ".AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") },
  cfg,
  1_700_000_000_000,
);
assert.equal(forged.ok, false, "bad HMAC rejects");

const expired = resolveBoundAdminRow(
  { adminToken: token },
  cfg,
  1_700_000_000_000 + STOREFRONT_ADMIN_TOKEN_TTL_MS + 1,
);
assert.equal(expired.ok, false, "expired rejects");

const noSecret = mintStorefrontAdminToken(
  { adminRow: 31, telefono: "099123456" },
  { identityJwtSecret: "" },
);
assert.equal(noSecret, null, "fail closed without secret");

assert.equal(
  boundAdminRowFromRequest({ adminRow: 2, telefono: "099123456" }, cfg),
  null,
  "raw adminRow alone must NOT bind",
);
const liveToken = mintStorefrontAdminToken({ adminRow: 31, telefono: "099123456" }, cfg);
assert.equal(
  boundAdminRowFromRequest({ adminToken: liveToken, telefono: "099123456", adminRow: 999 }, cfg),
  31,
  "token row wins; client adminRow ignored",
);

console.log("storefrontAdminBinding.test.js ok");
