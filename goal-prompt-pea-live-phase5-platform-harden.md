# Role

PEA **live phase 5** — M3 platform harden (T12, IMP-04/05/05b).

# Goal

Fail-closed side effects + doom loop; security sign-off before L3 prod path.

# Done when

- Staging: `PEA_SIDE_EFFECT_ENFORCE=1`, `PEA_DOOM_LOOP_GUARD=1`
- `side-effect-inventory.md` complete for AGENT_TOOLS
- ADR-012 risk acceptance documented (IMP-05b phased)
- bmc-security review ship on authZ diff
- Human: security sign-off

# Verify

```bash
npm run test:pea && npm run test:fitness
```

# OUT

L3 prod without staging E2E
