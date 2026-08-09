# Role

PEA **M2c executor** — Ratchet gate on Accept (partial IMP-PEA-13). Accept fails closed without ≥1 manual ratchet link. Flags default OFF. No auto-writer, no L3.

# Context

[CONFIRMED: M2b closed — console, grants, `pea_explain_gap`, `npm run test:pea` green.]

[CONFIRMED: Module 9 — ratchet obligatorio al cerrar gap: golden | fitness_sensor | rule_provenance.]

[CONFIRMED: M2c = manual operator attestation on Accept; auto ratchet writer deferred to M4 full IMP-13.]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Block `POST /api/pea/packets/:id/accept` unless body includes ≥1 valid ratchet link; persist links; console collects links before Approve.

# Scope

**IN:** `002_pea_ratchet_links.sql`, `ratchetGate.js`, `acceptPeaPacket` gate, console UX, tests, migrate script multi-file, PROJECT-STATE.

**OUT:** Auto golden writer, PAOS bridge-only ratchet, L3 implement, prod flags.

# Success Criteria

- `npm run test:pea` green
- Accept without `ratchet_links` → `ratchet_required`
- Accept with valid link → gap `resolved` + rows in `pea.ratchet_links`

# Stop rule

Do not enable prod `PEA_ENABLED=1`. Do not skip gate in default config.
