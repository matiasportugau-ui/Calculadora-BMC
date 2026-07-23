/**
 * IMP-01 residual — tool-count contract.
 * Offline: AGENT_TOOLS length must equal OpenAPI catalog + unique names.
 * Prevents silent 22/42/48/51 doc drift vs live registry.
 */
import assert from "node:assert/strict";
import { AGENT_TOOLS } from "../server/lib/agentTools.js";
import { buildAgentToolsOpenApi } from "../server/lib/agentToolsOpenApi.js";

const names = AGENT_TOOLS.map((t) => t.name);
const unique = new Set(names);

assert.ok(AGENT_TOOLS.length >= 50, `expected ≥50 tools (got ${AGENT_TOOLS.length})`);
assert.equal(
  unique.size,
  AGENT_TOOLS.length,
  `duplicate tool names in AGENT_TOOLS: ${AGENT_TOOLS.length - unique.size}`,
);

const doc = buildAgentToolsOpenApi(AGENT_TOOLS, { toolsRequiringAuth: [] });
const catalog = doc.components["x-agent-tools"] || [];
assert.equal(
  catalog.length,
  AGENT_TOOLS.length,
  `OpenAPI x-agent-tools count ${catalog.length} !== AGENT_TOOLS ${AGENT_TOOLS.length}`,
);

const enumNames =
  doc.paths["/api/agent/exec-tool"]?.post?.requestBody?.content?.["application/json"]
    ?.schema?.properties?.name?.enum || [];
assert.equal(
  enumNames.length,
  AGENT_TOOLS.length,
  `exec-tool name enum ${enumNames.length} !== AGENT_TOOLS ${AGENT_TOOLS.length}`,
);

// Hard pin current SoT (bump intentionally when tools change + update tools-manifest evidence)
assert.equal(
  AGENT_TOOLS.length,
  55,
  `AGENT_TOOLS length is ${AGENT_TOOLS.length}; update pin + docs/sdd/.../tools-manifest.md if intentional`,
);

console.log(`agentToolsCount.contract.test.js: ok (${AGENT_TOOLS.length} tools)`);
