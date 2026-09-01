// Panelin Ruta popup URL — draft stays in query, never becomes the path.
// Run: node tests/logisticaAgentUrl.test.js

import assert from "node:assert/strict";
import {
  buildLogisticaAgentUrl,
  isLogisticaAgentWindow,
  LOGISTICA_AGENT_WINDOW_NAME,
} from "../src/utils/logistica/openLogisticaAgentWindow.js";

assert.equal(LOGISTICA_AGENT_WINDOW_NAME, "logistica-trucker");
assert.equal(isLogisticaAgentWindow(), false, "no window → not the agent popup");

const origin = "https://calculadora-bmc.vercel.app";
const bare = new URL(buildLogisticaAgentUrl({ origin }));
assert.equal(bare.origin, origin);
assert.equal(bare.pathname, "/logistica");
assert.equal(bare.searchParams.get("agentWindow"), "1");
assert.equal(bare.searchParams.get("draft"), null);

const draft = buildLogisticaAgentUrl({
  origin,
  draft: " ENV-9 ../admin?x=1 ",
});
const withDraft = new URL(draft);
assert.equal(withDraft.pathname, "/logistica", "draft must not rewrite the path");
assert.equal(withDraft.searchParams.get("draft"), "ENV-9 ../admin?x=1");
assert.equal(withDraft.searchParams.get("agentWindow"), "1");
assert.ok(!withDraft.pathname.includes("admin"));
assert.ok(!draft.includes("javascript:"));

const js = new URL(
  buildLogisticaAgentUrl({ origin, draft: "javascript:alert(1)" }),
);
assert.equal(js.pathname, "/logistica");
assert.equal(js.protocol, "https:");
assert.equal(js.searchParams.get("draft"), "javascript:alert(1)");
assert.equal(js.searchParams.get("agentWindow"), "1");

const emptyDraft = new URL(buildLogisticaAgentUrl({ origin, draft: "   " }));
assert.equal(emptyDraft.searchParams.get("draft"), null);

console.log("logisticaAgentUrl.test.js ok");
