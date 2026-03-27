# AGENTS.md — Calculadora BMC / Panelin Dashboard

Instrucciones para agentes de IA (Codex, Claude Code, Cursor) que trabajen en este repositorio.
Lee este archivo antes de cualquier tarea.

**Intervención humana (un paso por vez):** cuando un bloqueo sea **cm-0 / cm-1 / cm-2** (Meta, OAuth ML, ingest correo), seguí [`docs/team/HUMAN-GATES-ONE-BY-ONE.md`](docs/team/HUMAN-GATES-ONE-BY-ONE.md) — enlaces concretos, opciones de menú y “listo cuando”. Regla Cursor opcional: [`.cursor/rules/human-gates-bmc.mdc`](.cursor/rules/human-gates-bmc.mdc).

---

## Comandos disponibles

| Comando | Cuándo usarlo |
|---------|---------------|
| `npm run lint` | Después de editar cualquier archivo en `src/` |
| `npm test` | Después de cambios en lógica de negocio o helpers |
| `npm run gate:local` | Una pasada local: `lint` → `test` (antes de PR) |
| `npm run gate:local:full` | `lint` → `test` → `build` (antes de commit con cambios en `src/`) |
| `npm run check` | Igual que `npm run gate:local` |
| `npm run test:contracts` | Requiere servidor corriendo (`npm run start:api`); valida contrato API (`/api/*`, `/calc/*`, `GET /capabilities`) |
| `npm run mcp:panelin` | Servidor MCP (stdio) proxy HTTP — requiere API corriendo; `BMC_API_BASE` opcional |
| `npm run build` | Antes de hacer commit de cambios en `src/` |
| `npm run start:api` | Para iniciar la API en puerto 3001 |
| `npm run followup` | Follow-ups / recordatorios (CLI `scripts/followup.mjs`; almacén local `.followup/` o `FOLLOWUP_STORE_PATH`); API `GET/POST /api/followups` |
| `npm run program:status` | Programa maestro multi-área: fase actual, progreso ~%, próximos pasos (`docs/team/orientation/programs/bmc-panelin-master.json`) |
| `npm run project:compass` | **Seguimiento unificado:** `program:status` + follow-ups vencidos (`followup due`). Índice: `docs/team/PROJECT-SCHEDULE.md`. Alias: `npm run schedule` |
| `npm run channels:onboarding` | **Arranque canales (orden WA → ML → Correo):** ejecuta `smoke:prod` + `project:compass` e indica el doc [`docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md). `-- --skip-smoke` / `--skip-compass` |
| `npm run channels:automated` | **Solo máquina, máximo paralelo:** smoke prod + follow-ups + snapshot programa + `humanGate` (cm-0/1/2). JSON en stdout; `-- --write` → `.channels/last-pipeline.json`. Ver [`docs/team/orientation/ASYNC-RUNBOOK-UNATTENDED.md`](docs/team/orientation/ASYNC-RUNBOOK-UNATTENDED.md). **CI:** job `channels_pipeline` en [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (push/PR `main`). |
| `npm run smoke:prod` | Smoke contra API pública (URL canónica en script): `GET /health`, `/capabilities`, chequeo `public_base_url`, **`GET /api/actualizar-precios-calculadora` (CSV MATRIZ, crítico)**, `GET /auth/ml/status`, `POST /api/crm/suggest-response` (IA). `BMC_API_BASE` / `SMOKE_BASE_URL`; `-- --json`; omitir solo MATRIZ: `SMOKE_SKIP_MATRIZ=1` o `-- --skip-matriz` |
| `npm run capabilities:snapshot` | Regenera `docs/api/AGENT-CAPABILITIES.json` desde `server/agentCapabilitiesManifest.js` (base: `CAPABILITIES_SNAPSHOT_BASE` → `PUBLIC_BASE_URL` → host canónico Cloud Run). |
| `npm run email:ingest-snapshot` | Bridge correo: lee `snapshot-latest.json` (repo IMAP hermano) y POST `/api/crm/ingest-email`. `--dry-run`, `--limit`, `--file`, `BMC_EMAIL_SNAPSHOT_PATH`. Dedupe `.email-ingest/` |
| `GET /api/email/panelsim-summary` | Con API arriba y **`API_AUTH_TOKEN`**: lee `PANELSIM-STATUS.json` + `PANELSIM-ULTIMO-REPORTE.md` del repo IMAP (`BMC_EMAIL_INBOX_REPO`). Query opcional `reportMaxChars`. Ver [`docs/team/panelsim/EMAIL-GPT-THUNDERBIRD-WORKFLOW.md`](docs/team/panelsim/EMAIL-GPT-THUNDERBIRD-WORKFLOW.md) |
| `POST /api/email/draft-outbound` | Borrador saliente proveedor/cliente (JSON `role`, `hechos`, opcional `tono`, `asunto_contexto`). **No envía** mail — copiar a Thunderbird. Misma auth Bearer que cockpit |
| Custom GPT **solo correo** | OpenAPI mínimo [`docs/openapi-email-gpt.yaml`](docs/openapi-email-gpt.yaml); guía Builder [`docs/team/panelsim/GPT-EMAIL-AGENT-BUILDER.md`](docs/team/panelsim/GPT-EMAIL-AGENT-BUILDER.md) — 2 Actions, sin `/calc` ni ML |
| `npm run panelsim:session` | **PANELSIM sesión completa:** `env:ensure` + `panelsim:env` + `panelsim:email-ready` + API en background (opc.) + `ml:verify` + `project:compass` + `channels:automated` (smoke prod + humanGate) + `panelsim-ml-crm-sync` + informe `docs/team/panelsim/reports/PANELSIM-SESSION-STATUS-*.md`. **Default = todo lo anterior.** `-- --quick` = sin compass/canales/env-ensure ni `ml:verify`. `-- --days N`, `--no-start-api`, `--skip-email`, `--skip-sheets`, `--skip-channels`, `--skip-compass`, `--skip-ml-verify`, `--skip-env-ensure`. Ver `docs/team/panelsim/AGENT-SIMULATOR-SIM.md` §5.1 |
| `npm run panelsim:env` | Chequeo credenciales Google + IDs de planillas (MATRIZ); `scripts/ensure-panelsim-sheets-env.sh` |
| `npm run panelsim:email-ready` | Sync IMAP + reporte en repo hermano; `scripts/panelsim-email-ready.sh` |
| `npm run env:ensure` | Crea `.env` desde `.env.example` si falta (`scripts/ensure-env.sh`) |
| `npm run open:email-env` | Abre `.env` del repo de correo en el editor |
| `npm run ml:verify` | Con API arriba: comprueba `/health` y OAuth ML (`/auth/ml/start?mode=json`); ver `docs/ML-OAUTH-SETUP.md` |
| `npm run ml:sim-batch` | Exporta una tanda de preguntas ML para simulación en ciego o con respuestas humanas (`--mode blind\|gold`, `--offset`, `--size`); ver `docs/team/panelsim/reports/ML-SIM-ITERATIVE-BLIND-IMPROVEMENT.md` |
| `npm run ml:ai-audit` | Descarga **todas** las preguntas y órdenes ML vía API local, agrega estadísticas y genera informe Markdown con IA (misma cadena de modelos que `suggest-response`). `--dry-run` = solo JSON agregado. Requiere API + keys en `.env` |
| `npm run ml:corpus-export` | Exporta **todo** el historial de preguntas/respuestas ML a JSON (`docs/team/panelsim/reports/ml-corpus/exports/`; gitignored). `--minimal` trunca textos. Ver `docs/team/panelsim/knowledge/ML-TRAINING-SYSTEM.md` |
| `npm run ml:pending-workup` | Preguntas ML **UNANSWERED**: checklist de puntos faltantes, precio ML vs Matriz, borrador sugerido (no publica en ML). `--json` |
| `npm run ml:cloud-run` | Sincroniza vars a Cloud Run desde `.env`: ML OAuth, `PUBLIC_BASE_URL`, GCS tokens, y si están definidas: `WEBHOOK_VERIFY_TOKEN`, `BMC_SHEET_ID`, `API_AUTH_TOKEN` / `API_KEY`. Ver [`docs/ML-OAUTH-SETUP.md`](docs/ML-OAUTH-SETUP.md) §6–8 |
| `./scripts/cloud-run-matriz-sheets-secret.sh` | Cloud Run **`panelin-calc`**: monta el JSON de Sheets desde Secret Manager (default secret `GOOGLE_APPLICATION_CREDENTIALS` → `/secrets/sa-key.json`) y setea `BMC_MATRIZ_SHEET_ID`; otorga `secretAccessor` al runtime SA. `SECRET_NAME=…` / `BMC_MATRIZ_SHEET_ID=…` opcionales. Checklist: [`docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md) (Fase 2b). |
| `npm run pre-deploy` | Checklist pre-deploy: health, contratos (API en 3001 o `BMC_API_BASE`), **paso 2** carga `.env` para comprobar `BMC_SHEET_ID` / `GOOGLE_APPLICATION_CREDENTIALS`, **paso 4** cuenta ítems abiertos `- [ ]` en `docs/team/PROJECT-STATE.md` (canónico; `docs/PROJECT-STATE.md` es solo redirección) |

**Loops de validación:**

1. Orden recomendado antes de commit en `src/`: **`lint` → `test` → `build`** (`npm run gate:local:full`).
2. Editar código → `npm run lint` → corregir errores → `npm test` → commit (o `npm run gate:local`).
3. Cambiar rutas API → `npm run start:api` en background → `npm run test:contracts`

**CRM cockpit (HTTP):** `GET/POST /api/crm/cockpit/*` — lectura de fila, `quote-link` (col AH), `approval` (AI), `mark-sent` (AJ), `send-approved` (ML o WhatsApp). Requiere **`API_AUTH_TOKEN`** en `.env` y header `Authorization: Bearer <token>` (o `X-Api-Key`). Doc: [`docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md`](docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md) §4.

---

## Estructura del proyecto

```
server/
  index.js                  # Entry point — monta rutas en /api, sirve /finanzas; GET /capabilities
  gptActions.js             # GPT_ACTIONS (compartido con /calc/gpt-entry-point y /capabilities)
  routes/
    bmcDashboard.js         # Todas las rutas del dashboard BMC (/api/*)
    calc.js                 # Rutas de la calculadora
    shopify.js              # Integración Shopify
scripts/
  validate-api-contracts.js # Validador de contrato API (requiere servidor)
  run_audit.sh              # Audit completo del sistema
tests/
  validation.js             # Tests unitarios — corren sin servidor (CI)
src/                        # Frontend React (Vite)
docs/
  team/                     # Equipo de agentes — PROJECT-STATE, knowledge, judge, panelsim/
  google-sheets-module/     # Hub: README.md — MAPPER-PRECISO, SYNC equipo, VARIABLES 1:1, inventory, planilla-map
  bmc-dashboard-modernization/ # DASHBOARD-INTERFACE-MAP, implementation plans
.cursor/
  agents/                   # Definiciones de agentes del equipo
  skills/                   # Skills por rol
```

---

## Convenciones de código

- **Módulos:** ES modules (`import`/`export`). No usar `require()`.
- **Rutas API:** Siempre en `server/routes/bmcDashboard.js`, montadas en `/api`.
- **Error semantics:** `503` = Sheets no disponible. `200 + data vacía` = sin datos. Nunca `500` para errores de Sheets.
- **Sheet IDs:** Nunca hardcoded. Siempre desde `config.*` o `process.env.*`.
- **Credenciales:** Nunca en código. Solo en `.env` (no commitear).
- **CORS:** En desarrollo puede ser abierto. En producción debe restringirse a dominios conocidos.
- **Logging:** Usar `pino` / `pino-http`. No usar `console.log` en producción.

---

## Contexto del equipo de agentes

Este proyecto usa un equipo de **agentes IA coordinados** cuyo listado canónico es **`docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2** (N roles) más **§2.2** (skills transversales consideradas en full team). Antes de trabajar:

1. Leer `docs/team/PROJECT-STATE.md` — estado actual, pendientes, cambios recientes.
2. Si el usuario trabaja por sesiones o pide orientación de “qué sigue”: leer `docs/team/SESSION-WORKSPACE-CRM.md` (foco del día, próximos pasos, checklist auto-start).
3. Leer `docs/team/knowledge/<TuRol>.md` si existe. **SIM / PANELSIM:** `docs/team/panelsim/AGENT-SIMULATOR-SIM.md` e índice `docs/team/panelsim/knowledge/PANELSIM-FULL-PROJECT-KB.md` (hub `docs/team/panelsim/README.md`). **Correo / bandeja (repo aparte):** skill `.cursor/skills/panelsim-email-inbox/` — variable opcional `BMC_EMAIL_INBOX_REPO` en `.env` (ver `.env.example`).
4. Consultar `docs/google-sheets-module/README.md` (hub) y `planilla-inventory.md` para Sheets; mapeo canónico en `MAPPER-PRECISO-PLANILLAS-CODIGO.md` y sync de accesos en `SYNC-FULL-TEAM-SHEETS-ACCESS-MAP.md`.
5. Consultar `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` para estructura del dashboard.

En **full team run** («Invoque full team» / «Equipo completo»): tras el paso 0 del Orquestador, el rol **MATPROMT** (`matprompt`) ejecuta el **paso 0a** y publica prompts por rol en `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` (o `docs/team/matprompt/MATPROMT-RUN-*.md`). Cada agente debe leer **su** subsección del bundle antes de su paso.

Al terminar una tarea:

- Actualizar `docs/team/PROJECT-STATE.md` (sección "Cambios recientes" y "Pendientes").
- Si el cambio afecta a otros agentes, consultar tabla de propagación en `docs/team/PROJECT-TEAM-FULL-COVERAGE.md §4`.

---

## Lo que NO hacer

- No hardcodear sheet IDs, tokens, ni URLs de producción.
- No commitear `.env` ni archivos con credenciales.
- No usar `npm audit fix --force` sin aprobación de Matias (puede romper vite).
- No modificar `docs/team/PROJECT-STATE.md` sin agregar entrada en "Cambios recientes".
- No saltear `npm run lint` antes de commit en `src/`.
