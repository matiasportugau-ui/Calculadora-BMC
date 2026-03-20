# MATPROMT — Bundle run: propagate & sync — 2026-03-20

**Paso 0a** — Prompts orientadores por rol §2 para **Invoque full team** con foco **propagación §4** y **sincronización de artefactos** (este repo + checklist repos hermanos).

**Objetivo del run:** Todos los roles leen `PROJECT-STATE`, confirman handoffs según [PROJECT-TEAM-FULL-COVERAGE.md §4](../PROJECT-TEAM-FULL-COVERAGE.md); se documenta estado sin asumir git push ejecutado salvo que Matias lo confirme.

---

## Transversales §2.2

| Skill | Este run |
|-------|----------|
| **ai-interactive-team** | Aplicable si hay disenso sobre qué copiar a bmc-dashboard-2.0 vs bmc-development-team — escalar a usuario. |
| **bmc-project-team-sync** | Driver del run; PROJECT-STATE + PROMPT al cierre. |
| **chat-equipo-interactivo** | N/A si no existe en repo. |

---

## Por rol (lecturas mínimas → entregable)

| Rol | Lecturas | Entregable / acción |
|-----|----------|---------------------|
| **Orchestrator** | PROJECT-STATE, PROMPT, BACKLOG, §4 | Run 0→9; entrada Cambios recientes. |
| **MATPROMT** | Este bundle | Opcional DELTA si cambia prioridad mid-run. |
| **Parallel/Serial** | JUDGE-REPORT-HISTORICO (contexto) | `PARALLEL-SERIAL-PLAN-2026-03-20-run22.md`. |
| **Mapping** | planilla-inventory, DASHBOARD-INTERFACE-MAP (vigente) | Declarar drift: ninguno / pendiente SKUs MATRIZ. |
| **Sheets Structure** | AUTOMATIONS-BY-WORKBOOK | N/A ejecución (Matias); recordatorio tabs/triggers. |
| **Dependencies** | dependencies.md, service-map.md | Confirmar nodos alineados a estado PROJECT-STATE. |
| **Contract** | planilla-inventory + rutas API | Estado: validar en runtime si servidor UP; si no, código-only OK documentado. |
| **Networks** | PROJECT-STATE Infra | URLs Cloud Run/Vercel vigentes en texto. |
| **Design** | DASHBOARD-INTERFACE-MAP | Sin cambio UI este run salvo backlog. |
| **Integrations** | service-map Shopify/ML | Estado vigente OAuth/webhooks. |
| **Reporter** | interactions/TEAM-INTERACTION-QUANTUM-DOC | REPORT-SOLUTION-CODING run22 con propagación. |
| **Security** | Pendiente OAuth Vercel en PROMPT | Recordatorio orígenes JS. |
| **GPT/Cloud** | openapi-calc.yaml | Sin drift nuevo declarado. |
| **Fiscal** | FISCAL-PROTOCOL-STATE-RANKING | Cumplimiento PROJECT-STATE post-run. |
| **Billing** | Pendiente cierre mensual | Sin cambio. |
| **Audit/Debug** | E2E-VALIDATION-CHECKLIST | Pendiente ejecución manual con URL prod. |
| **Calc** | PROJECT-STATE (sync unitarios, SKUs) | Pendiente: col.D MATRIZ, PRESUPUESTO_LIBRE_IDS en app canónica. |
| **Judge** | JUDGE-CRITERIA-POR-AGENTE | JUDGE-REPORT-RUN run22 + HISTORICO. |
| **Repo Sync** | REPO-SYNC-SETUP, .env | REPO-SYNC-REPORT run22 — lista archivos a copiar/push. |

---

## Anti-patrones

- No marcar «sync completado» en git remoto sin evidencia (`git push` o CI).
- No mezclar narrativa externa (p. ej. doc «quantum») con hechos de despliegue sin etiquetar *metáfora*.

## Handoff final

- **Orchestrator → todos:** `PROJECT-STATE.md` actualizado; **Repo Sync → Matias:** ejecutar push según `REPO-SYNC-REPORT-2026-03-20-run22.md`.
