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

- [ ] ContextGroup UI: ≥2 tabs (email + admin/calc); keyboard tablist works
- [ ] Ask from Calc tab → agent lists/summarizes email without switching tab
- [ ] `email_listar_hilos` / `email_leer_hilo` with JWT
- [ ] `email_borrador_saliente` then `email_enviar` only after explicit confirm phrase
- [ ] `email_clasificar_mensaje` → `consulta_cliente` or `alerta_admin` (+ optional Admin lead path)
- [ ] Never claims send success without tool OK
- [ ] SDD SCORECARD `pass: true` (≥90)

## Out of scope

Chrome extension automation · unattended send · Chatwoot infra standup · dual SoT writes
