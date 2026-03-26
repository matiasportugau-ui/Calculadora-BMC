# Plan de ejecución maestro — cm-0 → cm-2 + cierre + resto del programa

**Propósito:** Un solo documento **paso a paso** con **dónde encontrar** cada instrucción, script o código en el repo. Ejecutar **en orden** salvo que se indique paralelo.

**Mapa rápido de documentos (no duplicar texto largo aquí):**

| Necesitás… | Archivo en el repo |
|------------|-------------------|
| Orden canónico WhatsApp → ML → Correo | [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) |
| **Humano: URL + menú + “listo cuando” (cm-0…cm-2)** | [`../HUMAN-GATES-ONE-BY-ONE.md`](../HUMAN-GATES-ONE-BY-ONE.md) |
| Runbook asíncrono (H0 / A / H) | [`ASYNC-RUNBOOK-UNATTENDED.md`](./ASYNC-RUNBOOK-UNATTENDED.md) |
| Panel + comandos (`project:compass`, smoke, ingest) | [`../PROJECT-SCHEDULE.md`](../PROJECT-SCHEDULE.md) |
| Estado y cambios recientes | [`../PROJECT-STATE.md`](../PROJECT-STATE.md) |
| WhatsApp Meta + E2E | [`../WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md) |
| ML OAuth / GCS | [`../../ML-OAUTH-SETUP.md`](../../ML-OAUTH-SETUP.md) |
| E2E / smoke checklist | [`../E2E-VALIDATION-CHECKLIST.md`](../E2E-VALIDATION-CHECKLIST.md) |
| Programa (tareas, fases) | [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) |
| Variables de entorno (nombres) | [`.env.example`](../../../.env.example) (raíz del repo) |
| Skill ML | [`.cursor/skills/bmc-mercadolibre-api/SKILL.md`](../../../.cursor/skills/bmc-mercadolibre-api/SKILL.md) |

**Código relevante (referencia técnica):**

| Qué | Dónde |
|-----|--------|
| Webhook WhatsApp (`GET/POST /webhooks/whatsapp`) | [`server/index.js`](../../../server/index.js) |
| CRM parse / suggest / ingest email | [`server/routes/bmcDashboard.js`](../../../server/routes/bmcDashboard.js) |
| Layout CRM columnas AH–AK | [`server/lib/crmOperativoLayout.js`](../../../server/lib/crmOperativoLayout.js) |
| Ingest snapshot correo | [`server/lib/emailSnapshotIngest.js`](../../../server/lib/emailSnapshotIngest.js), [`scripts/email-snapshot-ingest.mjs`](../../../scripts/email-snapshot-ingest.mjs) |
| Smoke producción | [`scripts/smoke-prod-api.mjs`](../../../scripts/smoke-prod-api.mjs) |
| Estado del programa (`program:status`) | [`scripts/program-status.mjs`](../../../scripts/program-status.mjs) |
| Brújula (`project:compass`) | [`scripts/project-compass.mjs`](../../../scripts/project-compass.mjs) |
| Pipeline máquina (smoke + follow-ups + JSON + “human gate”) | [`scripts/channels-automated-pipeline.mjs`](../../../scripts/channels-automated-pipeline.mjs) |
| Onboarding smoke + compass | [`scripts/channels-onboarding.mjs`](../../../scripts/channels-onboarding.mjs) |

---

## Fase 0 — Comprobaciones que puede hacer la máquina (sin Meta ni teléfono)

**Objetivo:** confirmar prod + programa + recordatorio de la primera tarea humana.

1. En la raíz del repo:
   ```bash
   npm run channels:automated
   ```
   Opcional: `npm run channels:automated -- --write` → escribe [`.channels/last-pipeline.json`](../../../.channels/last-pipeline.json) (carpeta **gitignored**).

2. O por partes:
   ```bash
   npm run smoke:prod
   npm run program:status
   npm run project:compass
   ```
   **Dónde está la lógica:** tabla de scripts arriba; smoke por defecto usa la URL canónica de Cloud Run (ver `smoke-prod-api.mjs`).

3. **Criterio:** `channels:automated` termina con **exit 0** y en JSON `smoke.ok === true`. Si falla, no avanzar a verificación humana de canales hasta corregir prod o red.

**Estado ejecutado desde agente (referencia):** corrida OK de `channels:automated` con `suggest-response` (IA) y `humanGate` apuntando a **cm-0** mientras esa tarea siga en `doing` en el JSON maestro.

---

## Fase 1 — Tarea **cm-0** (E2E WhatsApp → fila en planilla)

**Tipo:** humano (Meta + teléfono) + verificación en Sheets; el servidor ya responde 200 rápido a Meta (asíncrono).

| Paso | Acción | Dónde leer |
|------|--------|------------|
| 1.1 | Webhook URL, verify token, campo `messages` | [`../WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md), [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) §Fase 1 |
| 1.2 | Vars `WHATSAPP_*` en Cloud Run | [`.env.example`](../../../.env.example), consola Google Cloud Run |
| 1.3 | Probar GET de verificación (`curl`) | [`../WHATSAPP-META-E2E.md`](../WHATSAPP-META-E2E.md) §3 |
| 1.4 | Mensaje de prueba; 5 min inactividad o 🚀 | Mismo doc; código buffer en [`server/index.js`](../../../server/index.js) |
| 1.5 | Confirmar fila **WA-Auto** en **CRM_Operativo** / **Form responses 1** | Planilla Google (2.0 Administrador) |
| 1.6 | Cerrar tarea en JSON: **cm-0** → `done`, `updatedAt` | [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) |
| 1.7 | Entrada breve en **Cambios recientes** | [`../PROJECT-STATE.md`](../PROJECT-STATE.md) |

---

## Fase 2 — Tarea **cm-1** (ML OAuth + tokens en prod, GCS opcional)

| Paso | Acción | Dónde leer |
|------|--------|------------|
| 2.1 | OAuth en navegador, buckets/tokens si aplica | [`../../ML-OAUTH-SETUP.md`](../../ML-OAUTH-SETUP.md) |
| 2.2 | Verificación script | `npm run ml:verify` → [`scripts/verify-ml-oauth.sh`](../../../scripts/verify-ml-oauth.sh) |
| 2.3 | Estado token en API | `GET /auth/ml/status` (documentado en ML-OAUTH y skill ML) |
| 2.4 | Cerrar **cm-1** en JSON + PROJECT-STATE | Mismo criterio que 1.6–1.7 |

---

## Fase 3 — Tarea **cm-2** (correo snapshot → ingest → CRM)

| Paso | Acción | Dónde leer |
|------|--------|------------|
| 3.1 | Generar snapshot IMAP (repo correo / `panelsim:email-ready`) | [`../PROJECT-SCHEDULE.md`](../PROJECT-SCHEDULE.md), skill `panelsim-email-inbox`, [`../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md`](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) Fase 3 |
| 3.2 | Dry-run ingest | `npm run email:ingest-snapshot -- --dry-run --limit 5` |
| 3.3 | Ingest acotado real | `npm run email:ingest-snapshot -- --limit 1` |
| 3.4 | Revisar fila CRM | Planilla |
| 3.5 | Cerrar **cm-2** en JSON + PROJECT-STATE | [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) |

**Implementación:** [`scripts/email-snapshot-ingest.mjs`](../../../scripts/email-snapshot-ingest.mjs), [`server/lib/emailSnapshotIngest.js`](../../../server/lib/emailSnapshotIngest.js); dedupe en `.email-ingest/` (ver `.gitignore`).

---

## Fase 4 — Cierre de fase comercial (p2) y rutina

1. `npm run program:status` — confirmar porcentajes y que **cm-0**, **cm-1**, **cm-2** figuran `done` si el negocio validó.
2. Revisar criterios de salida de **p2** en [`programs/bmc-panelin-master.json`](./programs/bmc-panelin-master.json) (`phases` → `p2` → `exitCriteria`).
3. Ritual semanal documentado: [`../SESSION-WORKSPACE-CRM.md`](../SESSION-WORKSPACE-CRM.md); comandos `channels:automated`, `project:compass` (refs en JSON bajo `convergencePoints`).

---

## Fase 5 — Resto del programa maestro (paralelo o después)

| ID | Qué | Dónde |
|----|-----|--------|
| **pc-2** | SKUs MATRIZ vs calculadora | [`../reports/REPORT-RUN37-MATRIZ-SKUS-2026-03-20.md`](../reports/REPORT-RUN37-MATRIZ-SKUS-2026-03-20.md), skill calculadora |
| **in-2** | Rotación keys / Security | [`../PROJECT-STATE.md`](../PROJECT-STATE.md), skill `bmc-security-reviewer` |
| **fi-1** | Fiscal / expediente | [`../fiscal/DGI-DEFENSA-EQUIPO-Y-SISTEMA-METALOG.md`](../fiscal/DGI-DEFENSA-EQUIPO-Y-SISTEMA-METALOG.md) |

---

## Orden estricto recomendado (resumen)

`Fase 0` → `Fase 1 (cm-0)` → `Fase 2 (cm-1)` → `Fase 3 (cm-2)` → `Fase 4` → `Fase 5` según prioridad de negocio.

**No** bloquear Fase 0 por trabajo humano: correrla en cada deploy o al menos antes de una sesión de Meta/teléfono.
