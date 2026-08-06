# ADR-001 — Non-break BMC hot path

## Status
Accepted (2026-08-06)

## Decision
1. Knowledge writes only via `/api/workspace/change-requests*` + `trainingKB.addTrainingEntry`.
2. Deny-list: pricing tools in `agentTools.js`, calc routes, SSE contract of `/api/agent/chat`.
3. UI deploys independently (`panelin-workspace` Vercel).
4. Fail-soft: workspace/DB down must not break calculadora chat/calc.

## Consequences
No system-prompt rewrite in MVP; skill mute-tools out of scope.
