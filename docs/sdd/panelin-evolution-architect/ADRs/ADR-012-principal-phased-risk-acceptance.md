# ADR-012: Platform Principal rewrite phased — risk acceptance for L3–L5

**Status:** Accepted (phased)  
**Date:** 2026-08-09  
**Context:** IMP-PEA-05b (full header-role Principal platform-wide) is large; PEA MVP ships PEA-scoped auth first (`requirePeaAction` on `/api/pea/*`).

## Decision

1. **PEA routes** use JWT + `pea:*` actions fail-closed (`server/lib/pea/principal.js`).
2. **Platform-wide** header-role rewrite remains a parallel track (IMP-05b).
3. **L5 merge** in prod requires either IMP-05b complete **or** explicit superadmin human merge (no auto-merge).
4. Document risk in SDD §11 until 05b lands.

## Consequences

- L3 staging E2E allowed with PEA principal only.
- L5 prod blocked for autonomous agents until 05b or human merge.
- Security review (oleada 5) must cite this ADR.

**Related:** IMP-PEA-05, IMP-PEA-05b, SDD §9 AuthZ
