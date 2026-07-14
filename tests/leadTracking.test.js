import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  captureUtmFromLocation,
  trackLeadEvent,
} from "../src/utils/leadTracking.js";

const originalWindow = globalThis.window;
const originalSessionStorage = globalThis.sessionStorage;
const originalFetch = globalThis.fetch;

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      values.set(key, value);
    },
  };
}

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;

  if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = originalSessionStorage;

  globalThis.fetch = originalFetch;
});

describe("lead conversion tracking", () => {
  it("captures only populated UTM parameters from the landing URL", () => {
    const storage = makeStorage();
    globalThis.window = {
      location: {
        search: "?utm_source=meta&utm_campaign=Techos+UY&utm_term=panel&other=ignored",
      },
    };
    globalThis.sessionStorage = storage;

    captureUtmFromLocation();

    assert.deepEqual(storage.writes, [[
      "bmc.utm",
      JSON.stringify({
        utm_source: "meta",
        utm_campaign: "Techos UY",
        utm_term: "panel",
      }),
    ]]);
  });

  it("does not overwrite stored attribution when the URL has no UTM parameters", () => {
    const existing = JSON.stringify({ utm_source: "google" });
    const storage = makeStorage({ "bmc.utm": existing });
    globalThis.window = { location: { search: "?quote=123" } };
    globalThis.sessionStorage = storage;

    captureUtmFromLocation();

    assert.deepEqual(storage.writes, []);
    assert.equal(storage.getItem("bmc.utm"), existing);
  });

  it("sends the stored attribution to both the beacon and Meta Pixel", async () => {
    const utm = { utm_source: "meta", utm_campaign: "roof-leads" };
    globalThis.sessionStorage = makeStorage({ "bmc.utm": JSON.stringify(utm) });

    const fetchCalls = [];
    const fbqCalls = [];
    globalThis.fetch = (...args) => {
      fetchCalls.push(args);
      return Promise.resolve({ ok: true });
    };
    globalThis.window = {
      fbq: (...args) => fbqCalls.push(args),
    };

    trackLeadEvent("quote.send.whatsapp");
    await Promise.resolve();

    assert.equal(fetchCalls.length, 1);
    const [url, options] = fetchCalls[0];
    assert.equal(url, "/api/public/lead-event");
    assert.equal(options.method, "POST");
    assert.equal(options.keepalive, true);
    assert.deepEqual(JSON.parse(options.body), {
      action: "quote.send.whatsapp",
      payload: { utm },
    });
    assert.deepEqual(fbqCalls, [["track", "Lead", { utm }]]);
  });

  it("falls back to empty attribution and never throws when telemetry fails", () => {
    globalThis.sessionStorage = makeStorage({ "bmc.utm": "{invalid-json" });
    globalThis.fetch = () => {
      throw new Error("network unavailable");
    };
    globalThis.window = {
      fbq: () => {
        throw new Error("pixel unavailable");
      },
    };

    assert.doesNotThrow(() => trackLeadEvent("quote.complete"));
  });
});
