import assert from "node:assert/strict";

import { buildMlWriteHeaders } from "../server/lib/mlInternalAuthHeaders.js";
import { sendMlReply } from "../server/lib/omni/outbound/mlReply.js";

assert.deepEqual(
  buildMlWriteHeaders({ apiAuthToken: "service-token" }, { "Content-Type": "application/json" }),
  { "Content-Type": "application/json", "x-api-key": "service-token" },
);

assert.deepEqual(
  buildMlWriteHeaders({ apiAuthToken: "" }, { "Content-Type": "application/json" }),
  { "Content-Type": "application/json" },
);

const originalFetch = globalThis.fetch;
let captured;
globalThis.fetch = async (url, options) => {
  captured = { url, options };
  return {
    ok: true,
    status: 200,
    async json() {
      return { id: "answer-1" };
    },
  };
};

try {
  const result = await sendMlReply({
    config: {
      apiAuthToken: "service-token",
      publicBaseUrl: "https://api.example.test/",
      port: 3001,
    },
    questionId: "12345",
    text: "Respuesta aprobada por operador",
  });

  assert.equal(result.ok, true);
  assert.equal(captured.url, "https://api.example.test/ml/questions/12345/answer");
  assert.equal(captured.options.method, "POST");
  assert.deepEqual(captured.options.headers, {
    "Content-Type": "application/json",
    "x-api-key": "service-token",
  });
  assert.deepEqual(JSON.parse(captured.options.body), { text: "Respuesta aprobada por operador" });
} finally {
  globalThis.fetch = originalFetch;
}

console.log("mlInternalAuthHeaders tests passed");
