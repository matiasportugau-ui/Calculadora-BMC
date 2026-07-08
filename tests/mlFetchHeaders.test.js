// Regression test for ML Manager browser auth headers.
// Run: node tests/mlFetchHeaders.test.js
import assert from "node:assert/strict";
import { mlFetch } from "../src/components/hub/ml/utils/mlFetch.js";
import { setOperatorJwtGetter } from "../src/utils/operatorApiClient.js";

let pass = 0;
let fail = 0;
function t(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      pass++;
      console.log(`  ✅ ${name}`);
    })
    .catch((err) => {
      fail++;
      console.error(`  ❌ ${name}\n     ${err.message}`);
    });
}

console.log("mlFetch — browser-safe auth headers");

t("sends Bearer JWT without x-api-key to avoid CORS preflight rejection", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  setOperatorJwtGetter(() => "operator-jwt");
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await mlFetch("/api/crm/suggest-response", {
      method: "POST",
      body: { consulta: "precio?", origen: "mercadolibre" },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:3001/api/crm/suggest-response");
    assert.equal(calls[0].init.headers.Authorization, "Bearer operator-jwt");
    assert.equal(calls[0].init.headers["x-api-key"], undefined);
    assert.equal(calls[0].init.body, JSON.stringify({ consulta: "precio?", origen: "mercadolibre" }));
  } finally {
    globalThis.fetch = originalFetch;
    setOperatorJwtGetter(() => "");
  }
});

setTimeout(() => {
  console.log(
    `\n════════════════════════════════════════\nRESULTADOS: ${pass} passed, ${fail} failed, ${pass + fail} total\n════════════════════════════════════════`
  );
  process.exit(fail === 0 ? 0 : 1);
}, 0);
