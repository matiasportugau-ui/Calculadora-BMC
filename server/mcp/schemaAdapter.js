/**
 * Convert Anthropic-style input_schema (JSON Schema) into a Zod raw shape
 * suitable for McpServer.registerTool({ inputSchema }).
 *
 * Nested objects become z.record(z.unknown()) to avoid fragile deep mapping;
 * top-level primitives/enums are typed when possible. Full JSON schema is
 * always appended to the tool description for clients that need detail.
 */
import { z } from "zod";

function propToZod(prop) {
  if (!prop || typeof prop !== "object") return z.unknown().optional();

  const desc = prop.description ? String(prop.description) : undefined;
  let base;

  if (Array.isArray(prop.enum) && prop.enum.length) {
    const enums = prop.enum.map(String);
    base = z.enum(enums);
  } else if (prop.type === "string") {
    base = z.string();
  } else if (prop.type === "number" || prop.type === "integer") {
    base = z.number();
  } else if (prop.type === "boolean") {
    base = z.boolean();
  } else if (prop.type === "array") {
    base = z.array(z.unknown());
  } else if (prop.type === "object") {
    base = z.record(z.string(), z.unknown());
  } else {
    base = z.unknown();
  }

  if (desc) base = base.describe(desc);
  return base.optional();
}

/**
 * @param {object|undefined} inputSchema — Anthropic input_schema
 * @returns {Record<string, import('zod').ZodTypeAny>}
 */
export function anthropicSchemaToZodShape(inputSchema) {
  const props = inputSchema?.properties;
  if (!props || typeof props !== "object") {
    // Accept any bag of args (voice agents often send flat JSON).
    return {
      _args: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Optional free-form args object"),
    };
  }

  /** @type {Record<string, import('zod').ZodTypeAny>} */
  const shape = {};
  for (const [key, prop] of Object.entries(props)) {
    shape[key] = propToZod(prop);
  }

  // Always allow passthrough of unexpected keys via optional catch-all not needed —
  // MCP SDK validates against shape; extra keys may be stripped. Mirror exec-tool
  // by also accepting a nested `input` bag for compatibility with stdio MCP.
  if (!shape.input) {
    shape.input = z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional nested input object (merged over top-level args)");
  }
  return shape;
}

/**
 * Merge top-level tool args with optional nested `input` (stdio MCP compat).
 * @param {Record<string, unknown>} args
 */
export function normalizeToolArgs(args) {
  const a = args && typeof args === "object" ? { ...args } : {};
  const nested = a.input;
  delete a.input;
  delete a._args;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...a, ...nested };
  }
  if (a._args && typeof a._args === "object") {
    return { ...a._args, ...a };
  }
  return a;
}

/**
 * Short schema note for description (avoid dumping huge schemas into voice prompts).
 */
export function schemaSummary(inputSchema) {
  const props = inputSchema?.properties;
  if (!props) return "No required fields.";
  const required = new Set(inputSchema.required || []);
  const keys = Object.keys(props);
  const parts = keys.slice(0, 24).map((k) => (required.has(k) ? `${k}*` : k));
  const more = keys.length > 24 ? ` (+${keys.length - 24})` : "";
  return `Args: ${parts.join(", ")}${more}. *=required.`;
}
