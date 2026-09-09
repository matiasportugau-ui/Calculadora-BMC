/**
 * Voice-mint rate + public /status leak gates (#1170 / #1216).
 * Exact prod cap (not just >3). Brain status is counts only — no lesson text.
 * Complementary to storefrontVoiceCredits + open #1177 shopper HTTP.
 * Run: node tests/storefrontMintRateAndStatus.test.js
 */
process.env.PUBLIC_STOREFRONT_VOICE = "1";
process.env.APP_ENV = "development";

const http = (await import("node:http")).default;
const assert = (await import("node:assert/strict")).default;
const express = (await import("express")).default;
const {
  STOREFRONT_SESSION_WINDOW_MS,
  storefrontSessionMax,
  skipStorefrontSessionLimit,
  isStorefrontOriginAllowed,
  default: createPublicVoiceRouter,
} = await import("../server/routes/publicVoice.js");
const { storefrontBrainStatus } = await import("../server/lib/voice/storefrontBrain.js");
const {
  shopperSafeChatError,
  __resetStorefrontVoiceCredits,
} = await import("../server/lib/voice/storefrontVoiceCredits.js");
const { config } = await import("../server/config.js");

console.log("storefrontMintRateAndStatus");

{
  assert.equal(STOREFRONT_SESSION_WINDOW_MS, 5 * 60 * 1000, "5-minute mint window");
  assert.equal(storefrontSessionMax("production"), 12, "prod mint cap");
  assert.equal(storefrontSessionMax("development"), 30, "dev mint cap");
  assert.equal(skipStorefrontSessionLimit({ method: "options" }, "production"), true);
  assert.equal(skipStorefrontSessionLimit({ method: "GET" }, "production"), false);
  assert.equal(skipStorefrontSessionLimit({ method: "POST" }, "production"), false);
  console.log("  ✓ mint window 5min; prod 12 / dev 30; only OPTIONS skipped in prod");
}

{
  const cfg = {
    appEnv: "production",
    storefrontVoiceOrigins: ["https://bmcuruguay.com.uy", "https://www.bmcuruguay.com.uy"],
  };
  assert.equal(isStorefrontOriginAllowed("https://bmcuruguay.com.uy", cfg), true);
  assert.equal(
    isStorefrontOriginAllowed("https://bmcuruguay.com.uy/", cfg),
    false,
    "trailing slash is a different Origin — allowlist is exact",
  );
  assert.equal(isStorefrontOriginAllowed("https://BMCuruguay.com.uy", cfg), false, "Origin match is case-sensitive");
  assert.equal(isStorefrontOriginAllowed("https://evil.example", cfg), false);
  console.log("  ✓ Origin allowlist is exact (slash / case)");
}

{
  const st = storefrontBrainStatus();
  assert.deepEqual(Object.keys(st).sort(), ["publicActive", "shared", "source", "total"]);
  assert.equal(st.shared, true);
  assert.equal(typeof st.publicActive, "number");
  assert.equal(typeof st.total, "number");
  assert.equal("lessons" in st, false);
  assert.equal("rule" in st, false);
  assert.equal("trigger" in st, false);
  const blob = JSON.stringify(st);
  assert.ok(!/openDrive|GOOGLE_DRIVE|precio_venta|lista venta/i.test(blob), "status must not echo lesson text");
  console.log("  ✓ storefrontBrainStatus is counts only");
}

{
  const net = shopperSafeChatError({ status: 502, message: "fetch failed ECONNRESET (no body)" });
  assert.equal(net.status, 502);
  assert.match(net.message, /Probá de nuevo/);
  assert.ok(!/ECONNRESET|no body|fetch failed/i.test(net.message), "SDK/network strings stay off the shopper");

  const credits = shopperSafeChatError({
    status: 403,
    body: "Your team has used all available credits or reached monthly spending limit",
  });
  assert.equal(credits.status, 403);
  assert.ok(!/credits|spending limit/i.test(credits.message));

  const other = shopperSafeChatError({ status: 418, message: "teapot" });
  assert.equal(other.status, 418);
  assert.equal(other.message, "No se pudo responder. Probá de nuevo.");
  console.log("  ✓ shopperSafeChatError strips network/credits SDK text");
}

__resetStorefrontVoiceCredits();
config.storefrontVoiceEnabled = true;
config.appEnv = "development";
config.storefrontVoiceOrigins = [
  "https://bmcuruguay.com.uy",
  "https://www.bmcuruguay.com.uy",
];

const app = express();
app.use(express.json());
app.use("/api/public/voice", createPublicVoiceRouter());

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;
const SHOP = "https://bmcuruguay.com.uy";

{
  const r = await fetch(`${BASE}/api/public/voice/status`, {
    headers: { Origin: SHOP },
  });
  assert.equal(r.status, 200);
  const json = await r.json();
  assert.equal(typeof json.bubble, "boolean");
  assert.ok(json.brain && typeof json.brain === "object", "/status includes brain counts");
  assert.deepEqual(Object.keys(json.brain).sort(), ["publicActive", "shared", "source", "total"]);
  assert.equal("lessons" in json.brain, false);
  assert.equal("error" in json, false);
  const blob = JSON.stringify(json);
  assert.ok(!/BEGIN PRIVATE KEY|service_account/i.test(blob));
  console.log("  ✓ GET /status brain keys are counts; no lesson / SA leak");
}

{
  const prev = config.appEnv;
  config.appEnv = "production";
  const slash = await fetch(`${BASE}/api/public/voice/status`, {
    headers: { Origin: "https://bmcuruguay.com.uy/" },
  });
  assert.equal(slash.status, 403, "trailing-slash Origin is 403 in production");
  config.appEnv = prev;
  console.log("  ✓ production trailing-slash Origin → 403");
}

__resetStorefrontVoiceCredits();
await new Promise((resolve) => server.close(resolve));
console.log("storefrontMintRateAndStatus: ok");
