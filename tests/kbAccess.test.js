// Contract tests for server/lib/kbAccess.js + server/lib/kbDomains.js
// Offline-safe by construction: no DATABASE_URL/OPENAI_API_KEY in the test env
// means the team_kb_embeddings path and OpenAI embedding calls never fire —
// this exercises the exact degrade-gracefully paths kbAccess.js relies on in
// production when the migration hasn't run yet or a provider is down.
// Run: node tests/kbAccess.test.js  (offline — no network)

import { kbAccess } from "../server/lib/kbAccess.js";
import { resolveRoleProfile, domainForKnowledgeFile, ROLE_PROFILES, KB_DOMAINS } from "../server/lib/kbDomains.js";

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

group("resolveRoleProfile", () => {
  assert(resolveRoleProfile("panelin_chat") === ROLE_PROFILES.panelin_chat, "known customer-facing role resolves exactly");
  assert(resolveRoleProfile("bmc-security") === ROLE_PROFILES["bmc-security"], "known dev-agent role resolves exactly");
  assert(resolveRoleProfile("unknown-role-xyz") === ROLE_PROFILES.panelin_chat, "unknown role falls back to panelin_chat");
  assert(resolveRoleProfile(undefined) === ROLE_PROFILES.panelin_chat, "undefined role falls back to panelin_chat");
  assert(resolveRoleProfile(null) === ROLE_PROFILES.panelin_chat, "null role falls back to panelin_chat");
});

group("domainForKnowledgeFile", () => {
  assert(domainForKnowledgeFile("Security.md") === "security_finding", "Security.md → security_finding");
  assert(domainForKnowledgeFile("Calc.md") === "pricing_decision", "Calc.md → pricing_decision");
  assert(domainForKnowledgeFile("Judge.md") === "project_state", "unmapped file falls back to project_state");
});

group("role profile isolation — customer-facing roles never pull team docs", () => {
  for (const role of ["panelin_chat", "mercado_libre", "whatsapp", "email", "wolfboard"]) {
    const profile = resolveRoleProfile(role);
    assert(profile.teamDomains.length === 0, `${role}: teamDomains is empty`);
    assert(profile.trainingKB === true, `${role}: trainingKB enabled`);
  }
});

group("role profile isolation — dev-agent roles never pull customer Q&A/brain", () => {
  for (const role of ["bmc-security", "bmc-calc-specialist"]) {
    const profile = resolveRoleProfile(role);
    assert(profile.trainingKB === false, `${role}: trainingKB disabled`);
    assert(profile.brain === false, `${role}: brain disabled`);
    assert(profile.teamDomains.includes("project_state"), `${role}: always includes project_state`);
    assert(profile.teamDomains.every((d) => KB_DOMAINS.includes(d)), `${role}: every teamDomain is a valid KB_DOMAINS entry`);
  }
});

await group("kbAccess degrades gracefully with no DB/embedding provider configured", async () => {
  // No DATABASE_URL/OPENAI_API_KEY in the offline test env → team_kb_embeddings
  // and historical-quote lookups must return nothing rather than throw.
  const result = await kbAccess("bmc-security", "does the CORS origin check exist?");
  assert(Array.isArray(result.items), "bmc-security: items is an array even with nothing configured");
  assert(result.meta.role === "bmc-security", "meta.role echoes the requested role");
  assert(result.meta.profile === ROLE_PROFILES["bmc-security"], "meta.profile is the resolved profile");
});

await group("kbAccess never throws for a customer-facing role", async () => {
  const result = await kbAccess("panelin_chat", "panel de 100mm para techo");
  assert(Array.isArray(result.items), "panelin_chat: items is an array");
  assert(result.items.every((it) => typeof it.domain === "string" && KB_DOMAINS.includes(it.domain)), "every item has a valid domain tag");
});

group("role budgets match kbSurface.js's existing SURFACE_LIMITS (no regression for customer-facing roles)", () => {
  assert(ROLE_PROFILES.mercado_libre.budget === 350, "mercado_libre keeps its existing 350-char SURFACE_LIMITS budget");
  assert(ROLE_PROFILES.panelin_chat.budget === 4000, "panelin_chat keeps its existing 4000-char SURFACE_LIMITS budget");
  assert(ROLE_PROFILES.whatsapp.budget === 700, "whatsapp keeps its existing 700-char SURFACE_LIMITS budget");
});

await group("kbAccess never returns items exceeding the role's budget", async () => {
  const result = await kbAccess("mercado_libre", "panel 100mm 4 aguas 200m2");
  const totalChars = result.items.reduce((sum, it) => sum + it.text.length, 0);
  assert(totalChars <= ROLE_PROFILES.mercado_libre.budget, "total returned text stays within the 350-char budget");
});

console.log(`\nkbAccess: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
