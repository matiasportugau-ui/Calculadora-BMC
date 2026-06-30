// Contract tests for server/lib/geminiTools.js
// Ensures the Anthropic AGENT_TOOLS → Gemini function-declaration adapter
// never emits a schema Gemini's API rejects (array `type`, unsupported keys,
// empty object params), and that tool results are packaged as JSON objects.
// Run: node tests/geminiTools.test.js  (offline — no network)

import { AGENT_TOOLS } from "../server/lib/agentTools.js";
import {
  toGeminiTools,
  toGeminiResponse,
  sanitizeSchema,
  toFunctionDeclaration,
} from "../server/lib/geminiTools.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}
function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

// Keys Gemini's FunctionDeclarationSchema rejects.
const FORBIDDEN = new Set([
  "default", "format", "pattern", "additionalProperties",
  "anyOf", "oneOf", "allOf", "$schema", "minimum", "maximum",
  "minItems", "maxItems",
]);

function walk(node, path, onProblem) {
  if (!node || typeof node !== "object") return;
  for (const k of Object.keys(node)) {
    if (FORBIDDEN.has(k)) onProblem(`forbidden key "${k}" at ${path}`);
  }
  if (Array.isArray(node.type)) onProblem(`array type at ${path}`);
  if (node.type !== undefined && node.properties === undefined && node.items === undefined && typeof node.type !== "string") {
    onProblem(`non-string scalar type at ${path}`);
  }
  if (node.properties) for (const [pk, pv] of Object.entries(node.properties)) walk(pv, `${path}.${pk}`, onProblem);
  if (node.items) walk(node.items, `${path}[]`, onProblem);
}

group("all AGENT_TOOLS convert to Gemini-safe declarations", () => {
  const decls = toGeminiTools(AGENT_TOOLS)[0].functionDeclarations;
  assert(decls.length === AGENT_TOOLS.length, `count matches (${decls.length}/${AGENT_TOOLS.length})`);
  let problems = 0;
  for (const d of decls) {
    assert(typeof d.name === "string" && d.name.length > 0, `${d.name}: has name`);
    assert(typeof d.description === "string" && d.description.length > 0, `${d.name}: has description`);
    if (d.parameters) {
      assert(d.parameters.type === "object", `${d.name}: top-level params are object`);
      walk(d.parameters, d.name, (msg) => { problems++; console.error(`  ✗ ${msg}`); });
    }
  }
  assert(problems === 0, "no forbidden keys / array types anywhere in the tree");
});

group("no-argument tools omit `parameters`", () => {
  // get_calc_state has properties: {} → Gemini rejects empty object schema.
  const decl = toFunctionDeclaration({ name: "noop", description: "x", input_schema: { type: "object", properties: {} } });
  assert(decl.parameters === undefined, "empty-properties tool omits parameters");
});

group("union `type` arrays collapse to scalar + nullable", () => {
  const s = sanitizeSchema({ type: ["string", "number"] });
  assert(s.type === "string", "['string','number'] → 'string'");
  assert(s.nullable === undefined, "no null member → not nullable");
  const n = sanitizeSchema({ type: ["number", "null"] });
  assert(n.type === "number", "['number','null'] → 'number'");
  assert(n.nullable === true, "null member → nullable:true");
});

group("unsupported keys stripped, enum kept", () => {
  const s = sanitizeSchema({ type: "string", enum: ["a", "b"], default: "a", format: "date-time", pattern: "^x$" });
  assert(Array.isArray(s.enum) && s.enum.length === 2, "enum preserved");
  assert(s.default === undefined, "default stripped");
  assert(s.format === undefined, "format stripped");
  assert(s.pattern === undefined, "pattern stripped");
});

group("toGeminiResponse always yields a JSON object", () => {
  assert(JSON.stringify(toGeminiResponse('{"ok":true,"t":1}')) === '{"ok":true,"t":1}', "object passes through");
  assert(toGeminiResponse("[1,2,3]").result.length === 3, "array wrapped in {result}");
  assert(toGeminiResponse("not json").result === "not json", "non-JSON string wrapped");
  assert(typeof toGeminiResponse("42") === "object", "primitive wrapped in object");
});

console.log(`\ngeminiTools: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
