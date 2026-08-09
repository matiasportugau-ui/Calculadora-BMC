/**
 * B-04 — OpenAPI export from AGENT_TOOLS
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAgentToolsOpenApi, toYaml } from "../server/lib/agentToolsOpenApi.js";
import { AGENT_TOOLS } from "../server/lib/agentTools.js";

const SAMPLE = [
  {
    name: "obtener_precio_panel",
    description: "Precio panel",
    input_schema: {
      type: "object",
      properties: {
        familia: { type: "string" },
        espesor: { type: "number" },
      },
      required: ["familia", "espesor"],
    },
  },
  {
    name: "guardar_en_crm",
    description: "Write CRM",
    input_schema: { type: "object", properties: { nota: { type: "string" } } },
  },
];

describe("buildAgentToolsOpenApi", () => {
  it("emits OpenAPI 3.1 with paths and per-tool schemas", () => {
    const doc = buildAgentToolsOpenApi(SAMPLE, {
      baseUrl: "https://example.test",
      toolsRequiringAuth: new Set(["guardar_en_crm"]),
    });
    assert.equal(doc.openapi, "3.1.0");
    assert.equal(doc.info.title, "Panelin Agent Tools API");
    assert.ok(doc.paths["/api/agent/tools/openapi"]);
    assert.ok(doc.paths["/api/agent/tools-manifest"]);
    assert.ok(doc.paths["/api/agent/exec-tool"]);
    assert.deepEqual(doc.servers, [{ url: "https://example.test", description: "API base" }]);
    assert.ok(doc.components.schemas.AgentToolInput_obtener_precio_panel);
    assert.equal(
      doc.components.schemas.AgentToolInput_obtener_precio_panel.required.includes("familia"),
      true,
    );
    const catalog = doc.components["x-agent-tools"];
    assert.equal(catalog.length, 2);
    assert.equal(catalog.find((t) => t.name === "guardar_en_crm").requires_auth, true);
    assert.equal(catalog.find((t) => t.name === "obtener_precio_panel").requires_auth, false);
    const enumNames = doc.paths["/api/agent/exec-tool"].post.requestBody.content["application/json"].schema.properties.name.enum;
    assert.deepEqual(enumNames, ["obtener_precio_panel", "guardar_en_crm"]);
  });

  it("covers live AGENT_TOOLS count without throw", () => {
    const doc = buildAgentToolsOpenApi(AGENT_TOOLS, { toolsRequiringAuth: [] });
    assert.ok(doc.components["x-agent-tools"].length >= 40);
    assert.equal(doc.components["x-agent-tools"].length, AGENT_TOOLS.length);
    assert.ok(doc.paths["/api/agent/exec-tool"].post.requestBody.content["application/json"].schema.properties.name.enum.length === AGENT_TOOLS.length);
  });

  it("toYaml serializes nested objects", () => {
    const y = toYaml({ openapi: "3.1.0", info: { title: "T", version: "1" } });
    assert.match(y, /openapi: 3\.1\.0/);
    assert.match(y, /title: T/);
  });
});
