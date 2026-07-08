import assert from "node:assert/strict";
import { mlFetch } from "../src/components/hub/ml/utils/mlFetch.js";

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

function installLocalStorageToken(token) {
  globalThis.localStorage = {
    getItem(key) {
      return key === "bmc_cockpit_token" ? token : null;
    },
  };
}

function installFetchRecorder(calls) {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

try {
  {
    const calls = [];
    installLocalStorageToken("operator.jwt.token");
    installFetchRecorder(calls);

    const result = await mlFetch("/api/crm/suggest-response", {
      method: "POST",
      body: { consulta: "Necesito cotizar un panel", origen: "mercadolibre" },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/api/crm/suggest-response");
    assert.equal(calls[0].init.credentials, "include");
    assert.equal(calls[0].init.headers.Authorization, "Bearer operator.jwt.token");
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.equal(Object.hasOwn(calls[0].init.headers, "x-api-key"), false);
    assert.equal(
      calls[0].init.body,
      JSON.stringify({ consulta: "Necesito cotizar un panel", origen: "mercadolibre" }),
    );
  }

  {
    const calls = [];
    installLocalStorageToken("");
    installFetchRecorder(calls);

    await mlFetch("/ml/users/me");

    assert.equal(calls.length, 1);
    assert.equal(Object.hasOwn(calls[0].init.headers, "Authorization"), false);
    assert.equal(Object.hasOwn(calls[0].init.headers, "x-api-key"), false);
  }

  console.log("mlFetch header contract tests passed");
} finally {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
}
