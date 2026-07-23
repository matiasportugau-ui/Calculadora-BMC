# GAP-PLAN — panelin-email-admin

**SCORECARD:** pass (composite 92). Remaining gaps are non-blocking.

| Sev | Gap | Action |
|-----|-----|--------|
| P2 | Omni async orchestrator still flag-off for deep classify | Enable `OMNI_AI_ORCHESTRATOR_ENABLED` in staging after budget review |
| P2 | Chat history not yet keyed by `groupId` in useChat persistence | Follow-up: store messages per ContextGroup |
| P2 | Live UAT with JWT + real Omni DB | Operator login on Vercel; exercise list→read→send dry-run |
| P3 | Merge path docs for Chatwoot Email Agent vs PMCA tools | Keep surfaces separate; add runbook cross-link |

No P0/P1 open for recreation.
