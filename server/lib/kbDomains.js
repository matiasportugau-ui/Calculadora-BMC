// KB domain enum + per-role access profiles — federates the existing, separate
// KB stores (training KB, brain KB, quote RAG, team_kb_embeddings) behind one
// role-aware interface. See server/lib/kbAccess.js for the consumer.
//
// This mirrors server/lib/kbSurface.js's shape (enum + normalize + limits) but
// on the "agent role" axis instead of the "customer-facing surface" axis —
// the two are orthogonal and both stay in place; kbSurface.js is untouched.

/** Domains tag every item kbAccess() returns, regardless of which underlying store it came from. */
export const KB_DOMAINS = Object.freeze([
  "customer_qa",       // trainingKB.js Q&A correction pairs
  "policy",            // brainKB.js learned policies
  "historical_quote",  // rag.js quote_embeddings similarity
  "security_finding",  // docs/team/knowledge/Security.md
  "pricing_decision",  // docs/team/knowledge/Calc.md, MATRIZ-CALCULADORA.md
  "project_state",     // docs/team/PROJECT-STATE.md "Cambios recientes" entries
]);

/** Maps a docs/team/knowledge/<file>.md basename to its team_kb_embeddings domain tag. */
export const KNOWLEDGE_FILE_DOMAINS = Object.freeze({
  "Security.md": "security_finding",
  "Calc.md": "pricing_decision",
  "MATRIZ-CALCULADORA.md": "pricing_decision",
  "CALCULATOR-ENGINE-MATH-SPEC.md": "pricing_decision",
  "Fiscal.md": "pricing_decision",
});

const DEFAULT_KNOWLEDGE_DOMAIN = "project_state";

/** Resolves the domain for a docs/team/knowledge/*.md file; unmapped files fall back to project_state. */
export function domainForKnowledgeFile(basename) {
  return KNOWLEDGE_FILE_DOMAINS[basename] || DEFAULT_KNOWLEDGE_DOMAIN;
}

/**
 * Per-role access profile: which underlying sources kbAccess() queries, and how
 * much of the result budget (characters) each role gets — mirrors kbSurface.js's
 * SURFACE_LIMITS idea but keyed by role instead of customer-facing surface.
 */
export const ROLE_PROFILES = Object.freeze({
  // Customer-facing surfaces keep today's exact behavior (training KB + brain,
  // no team docs) — kbAccess() must not change existing chat/ML/WA output.
  panelin_chat: { trainingKB: true, brain: true, historicalQuotes: false, teamDomains: [], budget: 4000 },
  mercado_libre: { trainingKB: true, brain: true, historicalQuotes: false, teamDomains: [], budget: 350 },
  whatsapp: { trainingKB: true, brain: true, historicalQuotes: false, teamDomains: [], budget: 700 },
  email: { trainingKB: true, brain: true, historicalQuotes: false, teamDomains: [], budget: 2000 },
  wolfboard: { trainingKB: true, brain: true, historicalQuotes: false, teamDomains: [], budget: 4000 },

  // Internal dev-agent roles: no customer Q&A/brain noise, scoped team-doc domains
  // plus project_state for historical/goal-oriented alignment.
  "bmc-security": {
    trainingKB: false,
    brain: false,
    historicalQuotes: false,
    teamDomains: ["security_finding", "project_state"],
    budget: 6000,
  },
  "bmc-calc-specialist": {
    trainingKB: false,
    brain: false,
    historicalQuotes: true,
    teamDomains: ["pricing_decision", "project_state"],
    budget: 6000,
  },
});

const DEFAULT_ROLE_PROFILE = ROLE_PROFILES.panelin_chat;

/** Resolves a role to its access profile; unknown roles fall back to the panelin_chat default. */
export function resolveRoleProfile(role) {
  if (typeof role !== "string" || !role) return DEFAULT_ROLE_PROFILE;
  return ROLE_PROFILES[role] || DEFAULT_ROLE_PROFILE;
}
