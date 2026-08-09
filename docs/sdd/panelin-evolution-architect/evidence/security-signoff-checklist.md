# PEA security sign-off checklist — oleada 5

Use before L3 prod path or `PEA_SIDE_EFFECT_ENFORCE=1` in prod.

- [ ] `requirePeaAction` on all mutating `/api/pea/*` routes
- [ ] JWT 401 without token (contract test)
- [ ] Grants durable in DB; chat text cannot escalate L4/L5
- [ ] `PEA_IMPLEMENT_ENABLED=0` in prod until ADR-006 staging E2E
- [ ] SideEffectRegistry covers AGENT_TOOLS (`evidence/side-effect-inventory.md`)
- [ ] Doom-loop guard tested (`tests/peaDoomLoop.test.js`)
- [ ] ADR-012 acknowledged (IMP-05b phased; L5 human merge)
- [ ] PII denylist on gap metadata (`piiDenylist.js`)
- [ ] bmc-security review on PR diff (authZ + side effects)

Sign-off: _________________ Date: _______
