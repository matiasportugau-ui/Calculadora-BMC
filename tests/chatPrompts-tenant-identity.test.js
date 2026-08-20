import test from "node:test";
import assert from "node:assert/strict";
import { buildIdentityBlock, buildSystemPrompt } from "../server/lib/chatPrompts.js";
import { tenantizePrompt, tenantPromptLeaks, TENANT_ALLOWED_TOOLS } from "../server/lib/tenantPrompt.js";
import { agentIdentity } from "../src/config/whitelabel.js";

test("BMC identity block is still Panelin of BMC Uruguay", () => {
  const bmc = buildIdentityBlock(null);
  assert.match(bmc, /Tu nombre es Panelin/);
  assert.match(bmc, /BMC Uruguay/);
});

test("tenant identity names and never say Panelin/BMC", () => {
  const cases = [
    ["bc", "JenIA", "BC"],
    ["paneleslam", "MonkIA", "LAM"],
    ["smartbuilding", "Basuuuu IA", "SMARTBUILDING"],
  ];
  for (const [slug, name, brand] of cases) {
    const block = buildIdentityBlock(slug);
    assert.match(block, new RegExp(`Tu nombre es ${name}`));
    assert.match(block, new RegExp(brand));
    assert.doesNotMatch(block, /Tu nombre es Panelin/);
    assert.doesNotMatch(block, /asistente experto de ventas de BMC Uruguay/);
  }
});

test("tenant system prompt carries JenIA and the brand guard", () => {
  const prompt = buildSystemPrompt({}, { tenantSlug: "bc" });
  assert.match(prompt, /JenIA/);
  assert.doesNotMatch(prompt.slice(0, 400), /Tu nombre es Panelin/);
});

test("tenant prompts leak no BMC/Panelin/Metalog and keep calc tools", () => {
  for (const slug of ["bc", "paneleslam", "smartbuilding"]) {
    const id = agentIdentity(slug);
    const prompt = buildSystemPrompt({}, { tenantSlug: slug });
    const leaks = tenantPromptLeaks(prompt);
    assert.deepEqual(leaks, [], `${slug} leaks ${leaks.join(",")}`);
    assert.match(prompt, new RegExp(id.name));
    assert.match(prompt, new RegExp(id.closing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(prompt, /calcular_cotizacion/);
    assert.doesNotMatch(prompt, /wolfboard_pendientes/);
    assert.doesNotMatch(prompt, /guardar_en_crm/);
  }
});

test("BMC prompt still names Panelin and BMC Uruguay", () => {
  const prompt = buildSystemPrompt({}, {});
  assert.match(prompt, /Tu nombre es Panelin/);
  assert.match(prompt, /BMC Uruguay/);
  assert.match(prompt, /wolfboard_pendientes/);
});

test("tenantizePrompt rewrites catalog heading", () => {
  const id = agentIdentity("bc");
  const out = tenantizePrompt("## CATÁLOGO DE PRODUCTOS BMC URUGUAY\nventa/BMC", id);
  assert.match(out, /CATÁLOGO DE PANELES · BC/);
  assert.doesNotMatch(out, /BMC/);
});

test("tenant tool allowlist is calc-only", () => {
  assert.equal(TENANT_ALLOWED_TOOLS.has("calcular_cotizacion"), true);
  assert.equal(TENANT_ALLOWED_TOOLS.has("wolfboard_pendientes"), false);
  assert.equal(TENANT_ALLOWED_TOOLS.has("enviar_whatsapp_link"), false);
});
