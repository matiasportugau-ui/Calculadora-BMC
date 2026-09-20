// Hub live WA operator ping leftover after #1163 / #1216.
// Tip storefrontLive + open #1183/#1189/#1219 pin PII, takeover, and 45s TTL —
// not the self-notify deny (STOREFRONT_LIVE_NOTIFY_WA === shop WA).
// Memory path only. Stubs global fetch — no Graph/Sheets/Postgres.
// Run: node tests/storefrontLiveNotifyGates.test.js

import assert from "node:assert/strict";

delete process.env.DATABASE_URL;

const { config } = await import("../server/config.js");
const { pingLiveSession, __testLive__ } = await import("../server/lib/voice/storefrontLive.js");

__testLive__.reset();
__testLive__.useMemory();

const prev = {
  storefrontLiveNotifyWa: config.storefrontLiveNotifyWa,
  storefrontWaNumber: config.storefrontWaNumber,
  whatsappAccessToken: config.whatsappAccessToken,
  whatsappPhoneNumberId: config.whatsappPhoneNumberId,
  frontendBaseUrl: config.frontendBaseUrl,
};
const prevFetch = globalThis.fetch;

function stubFetch(calls) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.X" }] }) };
  };
}

try {
  config.storefrontWaNumber = "59892663245";
  config.whatsappAccessToken = "tok";
  config.whatsappPhoneNumberId = "PNID";
  config.frontendBaseUrl = "https://calculadora-bmc.vercel.app/";

  {
    const calls = [];
    stubFetch(calls);
    config.storefrontLiveNotifyWa = "59892663245";
    const r = await pingLiveSession({
      id: "live-self",
      cliente: "Ana",
      telefono: "099888777",
      pageUrl: "https://bmcuruguay.com.uy/products/isodec",
      adminRow: 12,
    });
    assert.equal(r.ok, true);
    assert.equal(calls.length, 0, "notify WA equal to the public shop number must not Graph-send");
  }

  {
    const calls = [];
    stubFetch(calls);
    config.storefrontLiveNotifyWa = "";
    await pingLiveSession({
      id: "live-empty",
      cliente: "Ana",
      telefono: "099888777",
      adminRow: 12,
    });
    assert.equal(calls.length, 0, "empty STOREFRONT_LIVE_NOTIFY_WA skips Graph");
  }

  {
    const calls = [];
    stubFetch(calls);
    config.storefrontLiveNotifyWa = "123";
    await pingLiveSession({
      id: "live-short",
      cliente: "Ana",
      telefono: "099888777",
      adminRow: 12,
    });
    assert.equal(calls.length, 0, "notify number < 8 digits skips Graph");
  }

  {
    const calls = [];
    stubFetch(calls);
    config.storefrontLiveNotifyWa = "59899111222";
    config.whatsappAccessToken = "";
    config.whatsappPhoneNumberId = "";
    await pingLiveSession({
      id: "live-notokens",
      cliente: "Ana",
      telefono: "099888777",
      adminRow: 12,
    });
    assert.equal(calls.length, 0, "missing Cloud API creds skip Graph even with a notify number");
    config.whatsappAccessToken = "tok";
    config.whatsappPhoneNumberId = "PNID";
  }

  {
    const calls = [];
    stubFetch(calls);
    config.storefrontLiveNotifyWa = "+598 99 111 222";
    const sid = "live/notify?x";
    const r = await pingLiveSession({
      id: sid,
      cliente: "Luis",
      telefono: "099888777",
      pageUrl: "https://bmcuruguay.com.uy/collections/techos",
      adminRow: 12,
    });
    assert.equal(r.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/PNID/messages");
    assert.equal(calls[0].body.to, "59899111222", "digits-only owner number, not the shop line");
    assert.equal(calls[0].body.to.includes("59892663245"), false);
    const text = calls[0].body.text.body;
    assert.match(text, /Luis/);
    assert.match(text, /https:\/\/calculadora-bmc\.vercel\.app\/hub\/panelin-web\?s=/);
    assert.match(text, new RegExp(`s=${encodeURIComponent(sid)}`));
    assert.equal(text.includes("099888777"), false, "raw shopper phone stays out of the operator ping");
    assert.equal(String(calls[0].headers.Authorization || "").includes("tok"), true);
  }
} finally {
  globalThis.fetch = prevFetch;
  Object.assign(config, prev);
  __testLive__.reset();
}

console.log("storefrontLiveNotifyGates.test.js: ok");
