# AI Interactive Team — Reference

## Handoff Locations

| Artifact | Location |
|----------|----------|
| Planilla map / inventory | `docs/google-sheets-module/planilla-inventory.md` |
| Dashboard interface map | `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` |
| Cross-reference | Same folder as PLAN-PROPOSAL or DASHBOARD-INTERFACE-MAP |
| Plan & proposal | `docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md` |
| Visual map | `docs/bmc-dashboard-modernization/MAPA-VISUAL-ESTRUCTURA-POR-ESTACION.md` |

## Related Skills

| Skill | Role |
|-------|------|
| `bmc-planilla-dashboard-mapper` | Maps sheets + dashboard; produces planilla map, interface map, cross-reference |
| `bmc-dashboard-design-best-practices` | Designs UX/UI; consumes canonical payloads; implements dashboard sections |
| `networks-development-agent` | Hosting, storage, migration, endpoints, email inbound; evaluates infra changes |
| `google-sheets-mapping-agent` | Maps sheet structure, columns, GET/PUSH |
| `bmc-dependencies-service-mapper` | Connects dependencies, service map |
| `bmc-dashboard-team-orchestrator` | Orchestrates full team run |

## Escalation Triggers

- No agreement after 2 exchanges
- Schema vs UI contract mismatch
- Missing canonical fields for a new dataset
- Conflicting placement or hierarchy proposals
- User explicitly requests review before proceeding
