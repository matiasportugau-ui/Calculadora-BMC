/**
 * geminiTools.js — adapt the Anthropic-native AGENT_TOOLS to Gemini's
 * function-calling shape so the Gemini provider (the free fallback when
 * Claude is unfunded) can EXECUTE the same calculator/CRM tools instead of
 * role-playing `<tool_code>` text.
 *
 * Reuses the exact same tool dispatch (`executeTool` in agentTools.js) — this
 * module only translates the *schema* and packages tool *results* for Gemini.
 * No tool logic lives here.
 *
 * SDK: @google/generative-ai v0.24.x. A `Tool` is `{ functionDeclarations }`;
 * each declaration is `{ name, description, parameters? }` where `parameters`
 * is an OpenAPI-subset Schema. Gemini is stricter than JSON Schema, so we
 * whitelist supported keys and drop the rest (default/format/pattern/$schema/
 * additionalProperties), collapse anyOf/oneOf to their first branch, and omit
 * `parameters` entirely for no-argument tools (an empty object schema is
 * rejected by some SDK builds).
 */

// Keys Gemini's FunctionDeclarationSchema accepts. Everything else is dropped.
const ALLOWED_SCHEMA_KEYS = new Set([
  "type",
  "description",
  "enum",
  "properties",
  "required",
  "items",
  "nullable",
]);

/**
 * Recursively sanitize a JSON-Schema fragment into a Gemini-safe schema.
 * - Collapses anyOf/oneOf/allOf to their first member (Gemini fn-decls in
 *   this SDK build don't support union schemas).
 * - Drops unsupported keys (default, format, pattern, additionalProperties…).
 * - Guarantees every leaf carries a `type` (defaults to "string") so Gemini
 *   never sees a typeless property.
 */
export function sanitizeSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;

  if (Array.isArray(schema.anyOf) && schema.anyOf.length) return sanitizeSchema(schema.anyOf[0]);
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) return sanitizeSchema(schema.oneOf[0]);
  if (Array.isArray(schema.allOf) && schema.allOf.length) return sanitizeSchema(schema.allOf[0]);

  const out = {};
  for (const [key, val] of Object.entries(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) continue;
    if (key === "properties" && val && typeof val === "object") {
      const props = {};
      for (const [pk, pv] of Object.entries(val)) props[pk] = sanitizeSchema(pv);
      out.properties = props;
    } else if (key === "items") {
      out.items = sanitizeSchema(val);
    } else {
      out[key] = val;
    }
  }

  // JSON-Schema union types (e.g. `type: ["string","number"]`) are rejected by
  // Gemini — it wants a single scalar type. Collapse to the first non-"null"
  // member (the most permissive, "string", when both string+number are given)
  // and surface a "null" member as `nullable: true`.
  if (Array.isArray(out.type)) {
    if (out.type.includes("null")) out.nullable = true;
    const nonNull = out.type.filter((t) => t !== "null");
    out.type = nonNull[0] || "string";
  }

  // Gemini requires a concrete type on every node.
  if (!out.type && !out.properties && !out.items) out.type = "string";
  return out;
}

/**
 * Convert one Anthropic tool ({ name, description, input_schema }) into a
 * Gemini FunctionDeclaration. No-argument tools omit `parameters`.
 */
export function toFunctionDeclaration(tool) {
  const decl = { name: tool.name, description: tool.description };
  const schema = tool.input_schema;
  const hasProps = !!(schema && schema.properties && Object.keys(schema.properties).length > 0);
  if (hasProps) decl.parameters = sanitizeSchema(schema);
  return decl;
}

/**
 * Package the Anthropic AGENT_TOOLS array into Gemini's `tools` shape:
 * `[{ functionDeclarations: [...] }]`.
 */
export function toGeminiTools(anthropicTools) {
  return [{ functionDeclarations: (anthropicTools || []).map(toFunctionDeclaration) }];
}

/**
 * Wrap an `executeTool` result (a JSON string) into the object Gemini expects
 * for a functionResponse `response` field. A bare object passes through; any
 * non-object (array, primitive, or unparseable string) is wrapped in
 * `{ result: ... }` so the shape is always a JSON struct.
 */
export function toGeminiResponse(resultStr) {
  try {
    const parsed = JSON.parse(resultStr);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return { result: parsed };
  } catch {
    return { result: String(resultStr ?? "") };
  }
}
