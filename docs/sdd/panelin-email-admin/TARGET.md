---
title: TARGET — Panelin Multi-Context Agent (PMCA)
slug: panelin-email-admin
date: 2026-07-22
status: Locked
glory_phase: G0
---

# TARGET — Panelin Multi-Context Agent

## G0 lock

| Field | Value |
|-------|--------|
| Repo | `/Users/matias/calculadora-bmc` |
| System | **Panelin Multi-Context Agent (PMCA)** |
| Type | Hybrid: architect target + evidence from Omni/PANELSIM/Wave 4 |
| Success | SDD ≥90 **and** usable agent: shared multi-tab workspace, agentic R/W, human-gated send |

## Architecture locks

1. **SharedWorkspace per ContextGroup** — any tab in the group is readable/writable via tools; focus tab = UI + OCR only.
2. **No Gmail DOM / Gemini sidebar control** — API + Omni + Co-Work OCR hint.
3. **R/W tiers** — read (JWT); propose_write; commit/send only with intent confirm + grant.
4. **One brain** — `agentCore` + `agentTools` (email tools in Panelin loop; Chatwoot Email Agent stays separate surface).
5. **Gemini for cheap triage/summarize** via provider chain — not Gmail Gemini UI.

## UAT checklist

- [x] ContextGroup UI shipped (`ContextGroupBar` + `useContextGroups`); ARIA tablist + arrows
- [x] SharedWorkspace bundled on every send (`operatorContext.workspace`)
- [x] Tools registered: list/read/classify/draft/send (contract tests)
- [x] `email_clasificar_mensaje` → `consulta_cliente` / `alerta_admin` (unit)
- [x] `email_enviar` blocked without intent / user_confirmed (contract)
- [x] SDD SCORECARD `pass: true` (composite 92)
- [ ] Live JWT on Vercel/local: list→read→HITL send on test casilla (post-deploy; see audit/GAP-PLAN P2)

## Out of scope

Chrome extension automation · unattended send · Chatwoot infra standup · dual SoT writes
