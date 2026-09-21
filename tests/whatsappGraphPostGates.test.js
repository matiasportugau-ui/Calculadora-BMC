// WhatsApp Graph POST leftovers after tip whatsappOutboundUnified.
// Tip pins URL / digits / 4096 / missing-phone / missing-config and
// sendWhatsAppText throw on !ok. This file pins letters-only phone (no fetch),
// empty body still POSTs, Bearer header (token not in URL), and Graph non-JSON
// → data {} without leaking the access token.
// Run: node tests/whatsappGraphPostGates.test.js

import assert from "node:assert/strict";
import { postWhatsAppMessage, sendWhatsAppText } from "../server/lib/whatsappOutbound.js";

const realFetch = globalThis.fetch;
const CREDS = { accessToken: "tok-SECRET-value", phoneNumberId: "PNID" };

try {
  {
    const calls = [];
    globalThis.fetch = async (...args) => {
      calls.push(args);
      throw new Error("must not fetch");
    };
    await assert.rejects(
      () => postWhatsAppMessage({ to: "abc-xyz", text: "hola", ...CREDS }),
      /Missing destination phone/,
    );
    assert.equal(calls.length, 0);
  }

  {
    let last;
    globalThis.fetch = async (url, opts) => {
      last = { url, headers: opts.headers, body: JSON.parse(opts.body) };
      return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.E" }] }) };
    };

    const blank = await postWhatsAppMessage({ to: "59899", text: "", ...CREDS });
    assert.equal(blank.ok, true);
    assert.equal(last.body.text.body, "");

    await postWhatsAppMessage({ to: "59899", text: undefined, ...CREDS });
    assert.equal(last.body.text.body, "");

    await postWhatsAppMessage({ to: "59899", text: "   ", ...CREDS });
    assert.equal(last.body.text.body, "   ", "Graph body is not trimmed");
  }

  {
    let last;
    globalThis.fetch = async (url, opts) => {
      last = { url, headers: opts.headers, body: JSON.parse(opts.body) };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    await postWhatsAppMessage({ to: "+598 91 234 567", text: "hola", ...CREDS });
    assert.equal(last.url, "https://graph.facebook.com/v21.0/PNID/messages");
    assert.equal(String(last.url).includes("tok-SECRET-value"), false);
    assert.equal(last.headers.Authorization, "Bearer tok-SECRET-value");
    assert.equal(last.body.to, "59891234567");
    assert.equal(last.body.messaging_product, "whatsapp");
    assert.equal(last.body.type, "text");
  }

  {
    globalThis.fetch = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    });
    const r = await postWhatsAppMessage({ to: "59899", text: "hola", ...CREDS });
    assert.equal(r.ok, false);
    assert.equal(r.status, 502);
    assert.deepEqual(r.data, {});

    await assert.rejects(
      () => sendWhatsAppText({ to: "59899", text: "hola", ...CREDS }),
      (err) => {
        assert.match(String(err.message), /WhatsApp API:/);
        assert.equal(String(err.message).includes("tok-SECRET-value"), false);
        return true;
      },
    );
  }
} finally {
  globalThis.fetch = realFetch;
}

console.log("whatsappGraphPostGates.test.js: ok");
