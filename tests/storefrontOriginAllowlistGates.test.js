// Exact-match shop origin allowlist — spoof / prefix / scheme / port.
// Complementary to tip storefrontVoicePack + open #1177 evil-origin HTTP 403.
// Run: node tests/storefrontOriginAllowlistGates.test.js

import assert from "node:assert/strict";
import { isStorefrontOriginAllowed } from "../server/routes/publicVoice.js";

const APEX = "https://bmcuruguay.com.uy";
const WWW = "https://www.bmcuruguay.com.uy";
const prodApex = { appEnv: "production", storefrontVoiceOrigins: [APEX] };
const prodBoth = { appEnv: "production", storefrontVoiceOrigins: [APEX, WWW] };

assert.equal(isStorefrontOriginAllowed(APEX, prodApex), true, "exact allow");
assert.equal(isStorefrontOriginAllowed(WWW, prodBoth), true, "listed www");
assert.equal(isStorefrontOriginAllowed(WWW, prodApex), false, "www is not implied by apex");

assert.equal(
  isStorefrontOriginAllowed("https://bmcuruguay.com.uy.evil.com", prodApex),
  false,
  "suffix spoof must not startsWith-match",
);
assert.equal(
  isStorefrontOriginAllowed("https://evil-bmcuruguay.com.uy", prodApex),
  false,
  "prefix / lookalike host",
);
assert.equal(
  isStorefrontOriginAllowed("https://shop.bmcuruguay.com.uy", prodApex),
  false,
  "subdomain is not implied",
);
assert.equal(
  isStorefrontOriginAllowed(`${APEX}/`, prodApex),
  false,
  "trailing slash is a different origin string — pin, do not prefix-match",
);
assert.equal(
  isStorefrontOriginAllowed(`${APEX}/products/isodec`, prodApex),
  false,
  "path is not an Origin header",
);
assert.equal(
  isStorefrontOriginAllowed("http://bmcuruguay.com.uy", prodApex),
  false,
  "http ≠ https",
);
assert.equal(
  isStorefrontOriginAllowed("https://bmcuruguay.com.uy:443", prodApex),
  false,
  "explicit :443 is not the listed origin",
);
assert.equal(
  isStorefrontOriginAllowed("https://bmcuruguay.com.uy:8443", prodApex),
  false,
  "alt port",
);
assert.equal(isStorefrontOriginAllowed("null", prodApex), false, "sandboxed iframe Origin: null");
assert.equal(isStorefrontOriginAllowed("https://evil.example", prodApex), false);

assert.equal(
  isStorefrontOriginAllowed(` ${APEX}`, prodApex),
  false,
  "helper does not trim — requestOrigin trims first; pin, do not rewrite includes()",
);
assert.equal(isStorefrontOriginAllowed("   ", prodApex), false, "whitespace-only is not empty-origin");

assert.equal(isStorefrontOriginAllowed("", prodApex), false, "empty origin denied in production");
assert.equal(isStorefrontOriginAllowed(undefined, prodApex), false);
assert.equal(
  isStorefrontOriginAllowed("", { appEnv: "development", storefrontVoiceOrigins: [] }),
  true,
  "empty origin only in development",
);
assert.equal(
  isStorefrontOriginAllowed(APEX, { appEnv: "production", storefrontVoiceOrigins: [] }),
  false,
  "empty allowlist deny-all in production",
);
assert.equal(
  isStorefrontOriginAllowed(APEX, { appEnv: "production" }),
  false,
  "missing origins list is deny-all",
);

console.log("storefrontOriginAllowlistGates.test.js: ok");
