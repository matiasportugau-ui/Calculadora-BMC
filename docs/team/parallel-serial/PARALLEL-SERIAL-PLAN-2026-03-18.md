# Plan Paralelo/Serial — 2026-03-18

**Run:** Invoque full team
**Objetivo:** Full team run con paso 9 = ejecutar agenda post-go-live (guía vendedores, estado por rol).

---

## Estrategia

| Bloque | Pasos | Modo | Nota |
|--------|-------|------|------|
| 0–1 | Orchestrator: state, prompt, backlog, plan | Serie | Input único |
| 2–3c | Mapping, Dependencies, Contract, Networks | Serie | Dependen de state vigente |
| 4–5g | Design, Integrations, Reporter, Security, GPT, Fiscal, Billing, Audit, Calc | Paralelo conceptual | Estado ya documentado en PROJECT-STATE 2026-03-17; este run enfocado en paso 9 |
| 6–8 | Judge, Repo Sync, Orchestrator update | Serie | Judge resume; Repo Sync ya configurado |
| 9 | Reporter: GUIA-RAPIDA-VENDEDORES; actualizar PROMPT y PROJECT-STATE | Serie | Entregable principal del run |

---

## Entregables esperados

- GUIA-RAPIDA-VENDEDORES.md (Reporter, C1 IMPLEMENTATION-PLAN-POST-GO-LIVE)
- PROJECT-STATE actualizado con este run
- PROMPT-FOR-EQUIPO-COMPLETO: "Próximos prompts" actualizado
