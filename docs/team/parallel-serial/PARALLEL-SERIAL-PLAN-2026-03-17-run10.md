# Plan Paralelo/Serial — 2026-03-17 (run 10)

**Run:** Full team run (Invoque full team) + Sync
**Objetivo:** Sincronizar estado tras cambios 2026-03-19 (tabs/columns setup-sheets-tabs, kpi-report 200, Dockerfile.bmc-dashboard); ejecutar todos los 19 miembros; actualizar PROJECT-STATE y propagar.

---

## Contexto

- **Cambios recientes:** Tabs CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO creadas vía setup-sheets-tabs. kpi-report verificado 200. Dockerfile.bmc-dashboard creado.
- **Pendientes:** Triggers Apps Script (manual), deploy ejecución, npm audit --force (decisión), E2E checklist.

---

## Plan de ejecución

| Bloque | Acción |
|--------|--------|
| 0–1 | State, prompt, backlog leídos; plan y proposal confirmado |
| 2–8 | Estado vigente (19 miembros §2); Mapping, Dependencies, Contract (kpi-report 200), Networks, Design, Integrations, Reporter, Security, GPT/Cloud, Fiscal, Billing, Audit/Debug, Calc, Judge, Repo Sync |
| 9 | Ejecutar próximos prompts; actualizar backlog y "Próximos prompts" |

---

## Paralelo vs Serie

- **Serie:** 0 → 0b → 1 → 2 → 3 → 3b → 3c → 4 → 4b → 5 → 5b–5g → 6 → 7 → 8 → 9
- **Paralelo dentro de bloque:** 3b (Contract), 3c (Networks) pueden ejecutarse en paralelo tras Dependencies; 5b–5g (Security, GPT, Fiscal, Billing, Audit, Calc) en paralelo tras Reporter.
- **Sin clones:** Run de sync; no hay tareas paralelizables por carga.

---

## Combinación recomendada

Todos los 19 agentes en orden estándar. No se requiere clonación; estado vigente; sync y propagación de cambios.
