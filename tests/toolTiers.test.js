import assert from "node:assert/strict";
import { getToolTier, filterToolsByTier, TOOL_TIERS } from "../server/lib/toolTiers.js";
import { AGENT_TOOLS } from "../server/lib/agentTools.js";

assert.ok(TOOL_TIERS.includes("quote"));
assert.equal(getToolTier("calcular_cotizacion"), "quote");
assert.equal(getToolTier("guardar_en_crm"), "crm");
assert.equal(getToolTier("email_enviar"), "email");

const mapped = AGENT_TOOLS.map((t) => ({ name: t.name, tier: getToolTier(t.name) }));
const quoteOnly = filterToolsByTier(mapped, "quote");
assert.ok(quoteOnly.length > 0);
assert.ok(quoteOnly.every((t) => t.tier === "quote"));
assert.ok(quoteOnly.length < AGENT_TOOLS.length);

const all = filterToolsByTier(mapped, "");
assert.equal(all.length, AGENT_TOOLS.length);

console.log("toolTiers.test.js: ok");
