# MATPROMT — Bundle RUN 2026-03-24 / run53

**Generado por:** MATPROMT (`matprompt`)
**Run:** 53 — Full team run (Invoque full team 0→9)
**Fecha:** 2026-03-24
**CI:** `npm audit` 0 · `npm test` 119 passed · ESLint 0 errores
**Git:** `main` ahead ~5 vs `origin/main` (push pendiente)
**Equipo:** 21 roles §2 (incl. SIM, SIM-REV añadidos en run52/53)

---

## Resumen ejecutivo

Run 53 consolida el trabajo masivo de PANELSIM (scripts sesión, email multi-cuenta, arranque-capacidades), la nueva skill transversal `bmc-mercadolibre-api`, la tooling de full-team inspection (gate, pre-deploy, verify-artifacts) y las actualizaciones de knowledge Calc (IVA, marca, trazabilidad, criterios). SIM-REV aplica en paso 5h dado el foco PANELSIM. Pendientes operativos honestos: Go-live (tabs/triggers Matias), E2E Cloud Run, kpi-report prod, git push, Repo Sync hermanos, SKUs MATRIZ col.D.

- **Objetivos:** pasos 0→0a→0b→1→…→5h→6→7→8→9; artefactos REPORT, JUDGE, REPO-SYNC; PROJECT-STATE y PROMPT actualizados para run 54.
- **Roles N/A profundo este run:** Sheets Structure (manual Matias); GPT/Cloud (sin cambios OpenAPI este ciclo).
- **Objetivo SIM:** Sí — PANELSIM muy activo; paso 5h (SIM-REV) incluido.
- **Transversales §2.2:** Project Team Sync ✓ activo; BMC Mercado Libre API ✓ aplicable (ML OAuth docs + scripts nuevos); AI Interactive Team N/A (sin conflictos entre agentes).
- **Orden:** Serie (ver Parallel/Serial plan).

---

## Orchestrator — Prompt orientador

- **Objetivo:** Coordinar run 53 completo; verificar §2 (21 roles); paso 5h activo.
- **Leer antes:** `PROJECT-STATE.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md` (próximos prompts run 53), `IMPROVEMENT-BACKLOG-BY-AGENT.md`, `RUN-ROADMAP-FORWARD-2026.md` §5.2.
- **Hacer:**
  1. Contar roles §2 = 21; confirmar SIM y SIM-REV incluidos.
  2. Marcar transversales: Project Team Sync ✓, BMC ML API ✓, AI Interactive Team N/A.
  3. Verificar gate: `npm run gate:local` → 119 passed.
  4. Declarar objetivo SIM en paso 0; activar paso 5h.
  5. Al final (paso 8): actualizar PROJECT-STATE; paso 9: actualizar PROMPT y backlog.
- **Entregables:** bundle paso 0a; actualización PROJECT-STATE (paso 8); PROMPT próximos prompts run 54 (paso 9).
- **No hacer:** No omitir SIM/SIM-REV; no saltar paso 5h.
- **Handoff a:** MATPROMT → Parallel/Serial → Mapping → … → SIM-REV → Judge → Repo Sync.

---

## MATPROMT — Autoprompt

- Mantener bundle actualizado durante el run.
- Si surge tarea nueva (p. ej. decisión ML OAuth o PR Repo Sync hermanos), emitir DELTA para roles afectados.
- Coordinar con Parallel/Serial si el orden cambia.

---

## Mapping — Prompt orientador

- **Objetivo:** Verificar vigencia planilla-inventory y DASHBOARD-INTERFACE-MAP respecto a cambios recientes (nuevos endpoints ML, PANELSIM session).
- **Leer:** `docs/google-sheets-module/README.md` (hub), `planilla-inventory.md`, `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md`.
- **Hacer:**
  1. Confirmar que no hay drift en CRM_Operativo / Pagos_Pendientes.
  2. Verificar si `/ml/questions` y `/auth/ml/*` están documentados en DASHBOARD-INTERFACE-MAP como endpoints disponibles.
  3. Anotar pendientes (tabs CONTACTOS, Ventas_Consolidado — manual Matias).
- **Entregables:** comentario de estado (sin cambio si todo OK).
- **No hacer:** No editar tabs directamente; solo documentar.
- **Handoff a:** Dependencies, Design.

---

## Design — Prompt orientador

- **Objetivo:** Estado UI sin cambios nuevos en este run; confirmar que `npm run start:api` + puerto 3001 siguen como canónicos.
- **Leer:** `DASHBOARD-INTERFACE-MAP.md`.
- **Hacer:** Confirmar que no hay regresiones UI derivadas de cambios `server/index.js` (ML OAuth routes).
- **Entregables:** Estado OK o nota de drift.
- **No hacer:** No proponer rediseño sin pedido explícito.
- **Handoff a:** Reporter.

---

## Sheets Structure — Prompt orientador

- **Objetivo:** N/A ejecución — manual Matias (tabs CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO).
- **Leer:** `AUTOMATIONS-BY-WORKBOOK.md`, `IMPLEMENTATION-PLAN-POST-GO-LIVE.md` §A1–A2.
- **Hacer:** Confirmar que instrucciones siguen vigentes; no ejecutar sin Matias.
- **Entregables:** Nota de estado (pendiente manual).
- **Handoff a:** Mapping (cuando Matias ejecute).

---

## Networks — Prompt orientador

- **Objetivo:** Estado infra post-PANELSIM scripts (ngrok, puertos, Cloud Run).
- **Leer:** `HOSTING-EN-MI-SERVIDOR.md`, `service-map.md`, `docs/ML-OAUTH-SETUP.md`.
- **Hacer:**
  1. Confirmar que ngrok port 4040 sigue correcto para ML OAuth.
  2. Confirmar que Cloud Run panelin-calc sigue live (no hay cambios de infra en este ciclo).
  3. Anotar que `/finanzas/` y `/calculadora/` SPAs en Cloud Run siguen pendientes (run34 halló 404).
- **Entregables:** Estado infra OK / pendientes honestos.
- **Handoff a:** Reporter, Integrations.

---

## Dependencies — Prompt orientador

- **Objetivo:** Actualizar service-map si aplica (nuevos scripts npm, `panelsim-full-session.sh`, `ml-local-stack.sh`).
- **Leer:** `service-map.md`, `dependencies.md`.
- **Hacer:** Anotar nuevos scripts como nodos si cambia el grafo; confirmar `npm audit` 0.
- **Entregables:** Estado OK o diff en service-map.
- **Handoff a:** Reporter.

---

## Integrations — Prompt orientador

- **Objetivo:** Estado ML OAuth (skill transversal `bmc-mercadolibre-api` nueva); Shopify sin cambios.
- **Leer:** `docs/ML-OAUTH-SETUP.md`, `.cursor/skills/bmc-mercadolibre-api/SKILL.md`.
- **Hacer:**
  1. Confirmar que flujo OAuth `/auth/ml/start` está documentado y scripts `ml:verify` / `ml:local` existen.
  2. Anotar que OAuth en navegador sigue pendiente (Matias).
  3. Shopify: sin cambios este ciclo.
- **Entregables:** Estado integrations; recordatorio OAuth Matias.
- **Handoff a:** Reporter, Security.

---

## GPT/Cloud — Prompt orientador

- **Objetivo:** N/A profundo — sin cambios OpenAPI este run.
- **Leer:** `docs/openapi-calc.yaml` (solo si hay cambios).
- **Hacer:** Confirmar que Cloud Run panelin-calc sigue live; sin drift en GPT Builder.
- **Entregables:** Estado OK.
- **Handoff a:** Reporter.

---

## Fiscal — Prompt orientador

- **Objetivo:** Verificar protocolo PROJECT-STATE cumplido en cambios 2026-03-23/24; sin incumplimientos.
- **Leer:** `PROJECT-STATE.md` cambios recientes; `FISCAL-PROTOCOL-STATE-RANKING`.
- **Hacer:**
  1. Confirmar que cada cambio PANELSIM tiene "Afecta a:" documentado.
  2. Confirmar que bmc-mercadolibre-api skill fue alta §2.2 (✓ ya hecho).
  3. Sin errores IVA/CFE este ciclo.
- **Entregables:** Estado OK / incumplimientos si los hay.
- **Handoff a:** Reporter.

---

## Billing — Prompt orientador

- **Objetivo:** Cierre mensual 2026-03 pendiente (Matias).
- **Leer:** Pagos_Pendientes workbook (si disponible).
- **Hacer:** Anotar como pendiente operativo; sin acceso directo a Sheets en este run.
- **Entregables:** Recordatorio pendiente billing.
- **Handoff a:** Reporter.

---

## Audit/Debug — Prompt orientador

- **Objetivo:** Verificar que `npm run gate:local` y `pre-deploy` funcionan tras inspection tooling.
- **Leer:** `scripts/pre-deploy-check.sh`, `AGENTS.md` sección comandos.
- **Hacer:**
  1. Confirmar `npm run gate:local` → 119 passed.
  2. Confirmar `scripts/verify-full-team-artifacts.mjs` existe.
  3. E2E validation sigue pendiente (Matias + agent).
- **Entregables:** Estado audit OK; E2E pendiente.
- **Handoff a:** Reporter.

---

## Reporter — Prompt orientador

- **Objetivo:** Producir `REPORT-SOLUTION-CODING-2026-03-24-run53.md`.
- **Leer:** Este bundle, todos los handoffs de pasos 2–5g.
- **Hacer:**
  1. Sintetizar cambios del ciclo (PANELSIM, ML OAuth, gate tooling, Calc KB).
  2. Pendientes honestos: Go-live, E2E, kpi-prod, push, Repo Sync hermanos, SKUs.
  3. Próximas acciones sugeridas.
- **Entregables:** `reports/REPORT-SOLUTION-CODING-2026-03-24-run53.md`.
- **No hacer:** No marcar como cerrado lo que sigue abierto.
- **Handoff a:** Judge, Repo Sync.

---

## Contract — Prompt orientador

- **Objetivo:** Sin cambios en contratos API este ciclo; test:contracts requiere API up.
- **Leer:** `scripts/validate-api-contracts.js`, `planilla-inventory.md`.
- **Hacer:** Confirmar que rutas `/auth/ml/*` y `/ml/*` no rompen contratos existentes.
- **Entregables:** Estado OK / pendiente test:contracts con API up.
- **Handoff a:** Reporter.

---

## Calc — Prompt orientador

- **Objetivo:** Confirmar knowledge actualizado (IVA, marca, trazabilidad, criterios de cotización).
- **Leer:** `docs/team/knowledge/Calc.md` (§4–§7 nuevos/actualizados), `.cursor/skills/bmc-calculadora-specialist/SKILL.md`.
- **Hacer:**
  1. Confirmar §4 (IVA presupuestos terceros), §5 (marca desconocida), §6 (trazabilidad), §7 (criterios cotización) vigentes.
  2. Confirmar 119 tests pasando.
  3. SKUs MATRIZ col.D sigue pendiente (Matias confirmar placeholders).
- **Entregables:** Estado Calc OK; SKUs pendiente.
- **Handoff a:** Reporter.

---

## Security — Prompt orientador

- **Objetivo:** Verificar que nuevos scripts (ml-local-stack, panelsim-full-session, resolve-email-inbox-repo) no exponen credenciales.
- **Leer:** Scripts nuevos en `scripts/`; `.env.example` actualizado.
- **Hacer:**
  1. Confirmar que `.ml-tokens.enc` está en `.gitignore`.
  2. Confirmar que `accounts.json` real (con contraseñas) no está en git.
  3. `npm audit` 0 (✓ confirmado).
- **Entregables:** Estado security OK / hallazgos.
- **Handoff a:** Reporter.

---

## SIM — Prompt orientador (Objetivo SIM activo)

- **Objetivo:** Confirmar que la infraestructura PANELSIM quedó completa: scripts npm, arranque-capacidades, email-ready, session-status.
- **Leer:** `panelsim/AGENT-SIMULATOR-SIM.md` §5.1, `panelsim/PANELSIM-ARRANQUE-CAPACIDADES.md`, `panelsim/EMAIL-WORKSPACE-SETUP.md`.
- **Hacer:**
  1. Verificar que `npm run panelsim:session` existe y genera informe.
  2. Verificar que `npm run panelsim:email-ready` existe.
  3. Anotar que SKILL ref KB (`⬜` en backlog) sigue pendiente.
- **Entregables:** Checklist arranque; pendiente SKILL ref KB.
- **Handoff a:** SIM-REV (paso 5h).

---

## SIM-REV — Prompt orientador (paso 5h — Objetivo SIM)

- **Objetivo:** Contrastar trabajo PANELSIM del ciclo 2026-03-23/24 vs backlog de mejoras y mejoras propuestas.
- **Leer:** `panelsim/AGENT-SIMULATOR-SIM.md`, `IMPROVEMENT-BACKLOG-BY-AGENT.md` (fila SIM, SIM-REV), `PROMPT-FOR-EQUIPO-COMPLETO.md`.
- **Hacer:**
  1. Listar qué quedó completo en PANELSIM este ciclo.
  2. Listar qué sigue pendiente (SKILL ref KB para SIM y SIM-REV, OAuth ML, E2E).
  3. Producir `panelsim/reports/SIM-REV-REVIEW-2026-03-24-run53.md`.
- **Entregables:** `panelsim/reports/SIM-REV-REVIEW-2026-03-24-run53.md`.
- **No hacer:** No sustituir al Judge; solo revisar trabajo SIM.
- **Handoff a:** Judge.

---

## Judge — Prompt orientador

- **Objetivo:** Evaluar run 53 (21 roles §2); actualizar JUDGE-REPORT-HISTORICO.
- **Leer:** Todos los artefactos del run; `judge/JUDGE-CRITERIA-POR-AGENTE.md`.
- **Hacer:**
  1. Nota 1–5 por rol (Judge = N/A).
  2. Calcular promedio.
  3. Actualizar `JUDGE-REPORT-HISTORICO.md`.
- **Entregables:** `judge/JUDGE-REPORT-RUN-2026-03-24-run53.md`; HISTORICO actualizado.
- **No hacer:** No auto-evaluar.
- **Handoff a:** Repo Sync.

---

## Parallel/Serial — Prompt orientador

- **Objetivo:** Producir plan serie para run 53.
- **Leer:** Este bundle.
- **Hacer:** Plan serie (sin paralelismo forzado; cambios no son interdependientes en código este run).
- **Entregables:** `parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-24-run53.md`.
- **Handoff a:** Orchestrator (confirmar orden).

---

## Repo Sync — Prompt orientador

- **Objetivo:** Evaluar qué actualizar en `bmc-dashboard-2.0` y `bmc-development-team` tras run 53.
- **Leer:** `REPO-SYNC-SETUP.md`, último `REPO-SYNC-REPORT-*.md`.
- **Hacer:**
  1. Listar artefactos equipo nuevos (matprompt, parallel-serial, reports, judge, panelsim docs).
  2. Código: `main` ahead ~5 commits — push pendiente Matias.
  3. Producir `reports/REPO-SYNC-REPORT-2026-03-24-run53.md`.
- **Entregables:** `reports/REPO-SYNC-REPORT-2026-03-24-run53.md`.
- **No hacer:** No push automático sin confirmación Matias.
- **Handoff a:** Orchestrator (paso 8).

---

## Handoff a SIM (cierre bundle)

**Para PANELSIM al arrancar después de este run:**

1. Leer `panelsim/PANELSIM-ARRANQUE-CAPACIDADES.md` §9 (qué activo vs manual).
2. Ejecutar `npm run panelsim:env` → `npm run start:api` → verificar `/health`.
3. Para correo: `npm run panelsim:email-ready` (requiere contraseñas en `.env` del repo hermano).
4. ML OAuth: `npm run ml:verify`; si `hasTokens: false` → flujo `/auth/ml/start` (Matias en navegador).
5. PROJECT-STATE: pendientes Go-live y E2E siguen abiertos.

---

*Fin bundle MATPROMT — RUN 2026-03-24 / run53*
