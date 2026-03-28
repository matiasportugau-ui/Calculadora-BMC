# MATPROMT — Bundle RUN 2026-03-28 / run56

**Generado por:** MATPROMT (`matprompt`) — paso **0a** Invoque full team  
**Fecha:** 2026-03-28  
**Run:** **56** — modo **R2** (sync documental + síntesis; no exige implementación nueva en todos los roles)

---

## Power prompt (reformulación canónica del objetivo)

> **Make this a power prompt:** Consolidar un **informe actualizado de modificaciones** del repo y del estado documental (post–run 55 y cierres 2026-03-28 en `PROJECT-STATE`), y una **evaluación explícita** de **mejoras** frente a **riesgos de pérdida o dilución de información** (duplicación SESSION vs STATE, drift entre PROMPT y checklist operador, artefactos sin commit). Cada rol §2 declara **Profundo / Ligero / N/A**, entrega breve o N/A según matriz, y deja **handoff** al Judge y al Orquestador.

---

## Run Scope Matrix (obligatoria)

| Rol §2 | Modo | Justificación breve |
|--------|------|---------------------|
| **Orchestrator** | Ligero | Confirmar secuencia 0→0a→0b→…→9; enlazar artefactos run56. |
| **MATPROMT** | Profundo | Este bundle + mantener `MATPROMT-FULL-RUN-PROMPTS.md` alineado. |
| **Mapping** | Ligero | Verificar coherencia `matrizPreciosMapping.js` / planilla post-duplicados; sin editar Sheets. |
| **Design** | N/A | Sin cambio UI en el objetivo de este run. |
| **Sheets Structure** | N/A | Solo Matias; sin tarea estructural en run56. |
| **Networks** | Ligero | Estado Cloud Run `00041-t8x` / `00042-2mn`; smoke opcional `npm run smoke:prod`. |
| **Dependencies** | Ligero | Notar cambios locales en `package.json` / lock si afectan grafo de servicios. |
| **Integrations** | Ligero | Gates **cm-0 / cm-1 / cm-2**: estado honesto según `HUMAN-GATES-ONE-BY-ONE.md` (no marcar done sin evidencia). |
| **GPT/Cloud** | Ligero | `docs/api/AGENT-CAPABILITIES.json` vs manifest si hubo deploy; sin forzar Builder. |
| **Fiscal** | N/A | Fuera del objetivo salvo línea en Judge si hay riesgo compliance doc. |
| **Billing** | N/A | — |
| **Audit/Debug** | Ligero | Opcional: `tests/e2e-browser.mjs` untracked — decidir si entra scope CI o backlog. |
| **Reporter** | Profundo | Contribuir al informe [`reports/REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md`](../reports/REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md) o sección equivalente en REPORT-SOLUTION-CODING si se genera. |
| **Contract** | Ligero | Solo si este run toca rutas `server/routes/` → `npm run test:contracts` con API. |
| **Calc** | Ligero | Confirmar narrativa MATRIZ: `npm run matriz:reconcile` contra CSV prod si hay duda. |
| **Security** | Ligero | Sin secretos en docs nuevos; revisar untracked paths. |
| **Judge** | Profundo | Puntuar run56; dimensionar **mejora documental** vs **riesgo de pérdida de señal** (ruido, duplicados, promesas no verificadas). |
| **Parallel/Serial** | Ligero | Plan: **serie documental**; paralelo solo si dos agentes editan archivos distintos sin solapamiento. |
| **Repo Sync** | Ligero | Estado sync `bmc-dashboard-2.0` / `bmc-development-team` según último report o N/A con causa. |
| **Docs & Repos Organizer** | Profundo | Revisar índices `docs/team/README.md`, enlaces rotos, solapamiento SESSION vs PROJECT-STATE; proponir 1–2 acciones de higiene. |
| **SIM** | Ligero | Punteros: `SESSION-WORKSPACE-CRM.md` §5, `npm run project:compass`; sin `panelsim:session` obligatorio. |
| **SIM-REV** | Ligero | Contraste `IMPROVEMENT-BACKLOG-BY-AGENT.md` vs cierres 2026-03-28 en STATE. |

---

## Resumen ejecutivo (4 líneas)

1. **Objetivo central:** Un solo **informe de modificaciones** + **evaluación** (ganancias vs riesgo de pérdida de información).  
2. **Contexto:** Post–run 55 documental; en prod se cerraron **503 `/api/cotizaciones`** (CRM_Operativo) y **duplicados MATRIZ** (planilla + mapping + deploy `00042-2mn`).  
3. **Trabajo humano aún abierto:** Gates **cm-0 / cm-1 / cm-2** y checklist [`RUN55-OPERATOR-CHECKLIST.md`](../RUN55-OPERATOR-CHECKLIST.md) donde siga pendiente evidencia.  
4. **Salida canónica:** Este archivo + [`REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md`](../reports/REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md); Judge y STATE actualizados por quien cierre el run.

---

## Preguntas para Matias / Orquestador (cerrar antes de pasos caros)

1. ¿Se commitea en este ciclo el **WIP** (`package.json`, `package-lock.json`, `tests/e2e-browser.mjs`, assets `docs/team/image/…`) o queda explícitamente fuera?  
2. ¿El próximo run numerado será **57** con foco **E2E** / **Pista 3** / **gates humanos**, u otro objetivo?

---

## Orchestrator — Prompt orientador

- **Objetivo del rol en este run:** Dirigir run56 como **R2**; asegurar que existan **informe de modificaciones** + **evaluación Judge** (o criterios en reporte) y enlace en `PROMPT-FOR-EQUIPO-COMPLETO.md` / `MATPROMT-FULL-RUN-PROMPTS.md`.
- **Leer antes de actuar:** `PROJECT-STATE.md`, `SESSION-WORKSPACE-CRM.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, `FULL-TEAM-RUN-DEFINITION.md`, `RUN-SCOPE-GATE.md`.
- **Hacer (máx. 5 bullets):** (1) Fijar DoD del run56. (2) Invocar lectura de artefactos run56. (3) Paso 9: próximos prompts run57. (4) Actualizar backlog si aplica. (5) No declarar gates humanos cerrados sin evidencia.
- **Restricciones:** Tabla de handoffs en prosa breve; rutas repo completas.
- **Entregables:** Línea en `PROJECT-STATE` “Cambios recientes”; sección “Próximos prompts” coherente.
- **No hacer:** Refactor grande no pedido; no editar planillas.
- **Handoff a:** MATPROMT (mantener bundle), Judge, Docs & Repos Organizer.

---

## MATPROMT — Prompt orientador

- **Objetivo del rol en este run:** Bundle run56 publicado; DELTA solo si cambia prioridad a mitad de run.
- **Leer antes de actuar:** `matprompt/SKILL.md`, `MATPROMT-FULL-RUN-PROMPTS.md`.
- **Hacer:** Mantener histórico tabla run56; alinear con `PROJECT-TEAM-FULL-COVERAGE.md` §2.
- **Entregables:** Este archivo + entrada en guía canónica.
- **No hacer:** Inventar IDs o tokens.
- **Handoff a:** Orchestrator, todos los roles (subsecciones abajo).

---

## Mapping — Prompt orientador

- **Objetivo del rol en este run:** Confirmar que la narrativa **SKU / path** post–`00042` y `matrizPreciosMapping.js` coincide con `PROJECT-STATE` (ICR040, CUMROOF3C, ISPxxxEPSF, ISD techo).
- **Leer antes de actuar:** `docs/google-sheets-module/planilla-inventory.md`, `src/data/matrizPreciosMapping.js`, entradas 2026-03-28 en `PROJECT-STATE`.
- **Hacer (máx. 5 bullets):** (1) Lista corta de SKUs tocados vs mapping. (2) Señalar si queda drift doc vs código. (3) Handoff Contract/Calc si hay discrepancia.
- **Restricciones:** No editar Google Sheets desde agente.
- **Entregables:** Párrafo en informe run56 o en REPORT-SOLUTION-CODING.
- **No hacer:** Cambiar columnas sin Matias.
- **Handoff a:** Calc, Contract.

---

## Design — Prompt orientador

- **Objetivo del rol en este run:** N/A profundo — marcar leído §2 run56.
- **Leer antes de actuar:** `DASHBOARD-INTERFACE-MAP.md` solo si el informe menciona UI.
- **Hacer:** Una línea “N/A run56” en entrega de Judge o informe.
- **Entregables:** N/A.
- **No hacer:** Rediseños.
- **Handoff a:** Orchestrator.

---

## Sheets Structure — Prompt orientador

- **Objetivo del rol en este run:** N/A — estructura manual Matias; Pista 3 sigue en [`plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md`](../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md).
- **Leer:** `SESSION-WORKSPACE-CRM.md` §3.
- **Entregables:** N/A.
- **Handoff a:** Matias.

---

## Networks — Prompt orientador

- **Objetivo del rol en este run:** Resumir revisiones **panelin-calc** relevantes (`00041-t8x`, `00042-2mn`) y variables `BMC_SHEET_SCHEMA`, `BMC_MATRIZ_SHEET_ID` a nivel conceptual.
- **Leer:** `PROJECT-STATE` 2026-03-28, `AGENTS.md` smoke, `RUN55-OPERATOR-CHECKLIST.md`.
- **Hacer:** Opcional `npm run smoke:prod` si hay red; pegar resultado JSON o “OK” en informe.
- **Entregables:** Bullets en informe run56.
- **No hacer:** Publicar URLs con tokens.
- **Handoff a:** Integrations, Security.

---

## Dependencies — Prompt orientador

- **Objetivo del rol en este run:** Detectar si `package.json` / lock local divergen de `main` y si añade dependencia con impacto (CI, browser E2E).
- **Leer:** Diff local git; `service-map` o `dependencies.md` si existen bajo `docs/`.
- **Entregables:** Nota breve en informe run56.
- **Handoff a:** Audit/Debug, Contract.

---

## Integrations — Prompt orientador

- **Objetivo del rol en este run:** Estado **honesto** de WA / ML / correo respecto a **cm-0, cm-1, cm-2**; citar solo docs canónicos.
- **Leer:** `HUMAN-GATES-ONE-BY-ONE.md`, `PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`.
- **Hacer:** Tabla corta: gate | evidencia presente Sí/No | siguiente paso físico.
- **Entregables:** Sección en informe run56.
- **No hacer:** Simular OAuth completado.
- **Handoff a:** Networks, SIM.

---

## GPT/Cloud — Prompt orientador

- **Objetivo del rol en este run:** Comprobar si hubo cambios en `server/agentCapabilitiesManifest.js` o OpenAPI que requieran `npm run capabilities:snapshot`.
- **Leer:** `docs/openapi-email-gpt.yaml` si el run toca correo-only GPT.
- **Entregables:** Una línea “snapshot al día / pendiente”.
- **Handoff a:** Contract.

---

## Fiscal — Prompt orientador

- **Objetivo del rol en este run:** N/A salvo que el informe incorpore riesgo fiscal de datos — entonces una línea en Judge.
- **Entregables:** N/A.
- **Handoff a:** Judge.

---

## Billing — Prompt orientador

- **Objetivo del rol en este run:** N/A.
- **Entregables:** N/A.

---

## Audit/Debug — Prompt orientador

- **Objetivo del rol en este run:** Decidir si `tests/e2e-browser.mjs` se documenta como experimental o se integra a `npm test` / CI en run futuro; no bloquear run56.
- **Leer:** `.github/workflows/ci.yml`, `tests/e2e-browser.mjs` si existe.
- **Entregables:** Recomendación en informe run56.
- **Handoff a:** Contract, Orchestrator.

---

## Reporter — Prompt orientador

- **Objetivo del rol en este run:** Redactar o fusionar el **informe consolidado** de modificaciones (repo + docs) con secciones: Alcance, Delta técnico, Delta documental, Riesgos.
- **Leer:** `REPORT-FULL-TEAM-MODIFICATIONS-2026-03-28-run56.md`, últimos commits `git log`.
- **Entregables:** Markdown listo para `docs/team/reports/` o ampliación del archivo canónico run56.
- **No hacer:** Inventar métricas de negocio.
- **Handoff a:** Judge, Repo Sync.

---

## Contract — Prompt orientador

- **Objetivo del rol en este run:** Si no hubo cambio de rutas en este run, declarar **N/A test:contracts** con causa.
- **Hacer:** Tras cualquier cambio en `bmcDashboard.js`, `npm run start:api` + `npm run test:contracts`.
- **Entregables:** Línea en informe.
- **Handoff a:** Integrations.

---

## Calc — Prompt orientador

- **Objetivo del rol en este run:** Validar narrativa de precios MATRIZ y `matriz:reconcile` alineada a prod.
- **Leer:** `src/data/matrizPreciosMapping.js`, skill `actualizar-precios-calculadora`.
- **Entregables:** Confirmación o lista de follow-ups en informe run56.
- **Handoff a:** Mapping.

---

## Security — Prompt orientador

- **Objetivo del rol en este run:** Asegurar que docs nuevos no contienen secretos; revisar que `.env` no se commitea.
- **Leer:** `.gitignore`, diff de archivos nuevos.
- **Entregables:** Checklist corta en informe o Judge.
- **Handoff a:** Networks.

---

## Judge — Prompt orientador

- **Objetivo del rol en este run:** Evaluar **mejoras** (documentación, cierres prod, proceso full team) vs **pérdida de información** (duplicación, contradicciones SESSION/STATE/PROMPT, WIP sin versionar).
- **Leer:** `JUDGE-CRITERIA-POR-AGENTE.md`, informe run56, `JUDGE-REPORT-RUN-2026-03-27-run55.md` como referencia de tono.
- **Hacer:** Puntuación por rol o global; dimensión explícita “information integrity”.
- **Entregables:** `docs/team/judge/JUDGE-REPORT-RUN-2026-03-28-run56.md` (opcional si se ejecuta Judge completo).
- **Handoff a:** Orchestrator, MATPROMT.

---

## Parallel/Serial — Prompt orientador

- **Objetivo del rol en este run:** Documentar orden **serie** para run56 (informe antes de Judge); paralelo solo lecturas.
- **Entregables:** Párrafo corto o N/A.
- **Handoff a:** Orchestrator.

---

## Repo Sync — Prompt orientador

- **Objetivo del rol en este run:** Estado de espejo en repos hermanos; si no hay acceso, declarar pendiente.
- **Leer:** Último `REPO-SYNC-REPORT-2026-03-27-run55.md`.
- **Entregables:** Bullet en informe run56.
- **Handoff a:** Docs & Repos Organizer.

---

## Docs & Repos Organizer — Prompt orientador

- **Objetivo del rol en este run:** Proponer **1–2** mejoras de higiene: índice, README, reducir duplicación entre `SESSION-WORKSPACE-CRM` y `PROJECT-STATE` (sin borrar historia).
- **Leer:** `docs/team/README.md`, `IMPROVEMENT-BACKLOG-BY-AGENT.md`.
- **Entregables:** Sección “Recomendaciones docs” en informe run56.
- **Handoff a:** MATPROMT, Repo Sync.

---

## SIM — Prompt orientador

- **Objetivo del rol en este run:** Punteros operativos para siguiente bloque: `panelsim:env`, `start:api`, `smoke:prod` — sin sesión completa obligatoria.
- **Leer:** `panelsim/AGENT-SIMULATOR-SIM.md` §5.1.
- **Entregables:** Bullets cortos en informe o N/A.
- **Handoff a:** SIM-REV.

---

## SIM-REV — Prompt orientador

- **Objetivo del rol en este run:** Contraste backlog vs estado: ¿qué quedó obsoleto en `PROMPT` tras cierres 2026-03-28 (503, MATRIZ)?
- **Leer:** `IMPROVEMENT-BACKLOG-BY-AGENT.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md` §Run 55 trabajo abierto.
- **Entregables:** Lista “obsoleto / vigente” en informe run56 o delta SIM-REV.
- **Handoff a:** Reporter, Orchestrator.

---

### DELTA — (reservado)

- **Disparador:** Cambio de prioridad Matias o hallazgo crítico en medio del run.
- **Roles afectados:** (rellenar)
- **Instrucciones ajustadas:** (rellenar)
