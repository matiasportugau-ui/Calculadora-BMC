# Role

PEA **M3 executor** — SideEffectRegistry + Principal authorize() + doom-loop guard (IMP-PEA-04, 04b, 05 partial). Flags default OFF.

# Context

[CONFIRMED: M0→M2c shipped; `npm run test:pea` green.]

[CONFIRMED: M3 = platform harden before L3; PEA routes JWT-only; fail-closed authorize for PEA actions.]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Add PEA Principal + SideEffectRegistry + doom-loop guard; wire PEA API authz; inventory doc; tests.

# Scope

**IN:** `principal.js`, `sideEffectRegistry.js`, `doomLoopGuard.js`, `requirePeaAuth.js`, pea route wiring, `evidence/side-effect-inventory.md`, tests, PROJECT-STATE.

**OUT:** Full Panelin RBAC rewrite (05b), prod flags, L3 implement (M4).

# Success Criteria

- `npm run test:pea` green including principal/registry/doom tests
- Unauthorized PEA action → 403
- Repeat tool spam triggers doom-loop block when guard enabled
