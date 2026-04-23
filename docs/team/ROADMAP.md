# Calculadora BMC — Roadmap & Estado del Proyecto

**Generado:** 2026-04-23 | **Versión:** 3.1.5 | **Branch activo:** `feature/wolfboard-crm`
**Fuente:** git log, PROJECT-STATE.md, AGENTS.md, CLAUDE.md, estructura del repo.

---

## Misión

> Automatizar y profesionalizar el proceso comercial de BMC Uruguay (METALOG SAS) para paneles Panelin — desde la cotización técnica hasta el cierre de venta — integrando todos los canales de contacto (WhatsApp, MercadoLibre, email) con una calculadora precisa y un CRM operativo unificado.

## Visión

> Ser la plataforma omnicanal de referencia para la venta de paneles de aislación en Uruguay, donde cualquier vendedor o cliente obtenga una cotización precisa en minutos, y cada consulta quede registrada, respondida y trazada hasta el cierre de la venta — con mínima intervención manual.

## Objetivo medible (exit criteria del 100%)

Un deploy es **100% limpio** cuando:
- [ ] `npm run gate:local:full` → 0 errores, 0 warnings nuevos
- [ ] `npm run smoke:prod` → todos los checks verdes (MATRIZ CSV, `/health`, `/capabilities`, ML OAuth, CRM suggest)
- [ ] `npm run test:contracts` → contrato API sin drift
- [ ] Vercel producción sirve la versión correcta del chunk (semver en badge)
- [ ] Cloud Run responde `hasSheets: true`, `hasTokens: true` en `/health`
- [ ] Rama mergeada a `main` con git tag `vX.Y.Z`
- [ ] Gates humanos cm-0 / cm-1 / cm-2 verificados y documentados en PROJECT-STATE

---

## Áreas activas y scores

| Área | Calidad | Completitud | Estado |
|------|---------|-------------|--------|
| Calculator (BOM / pricing / wizard) | 🟢 8/10 | 🟡 7/10 | Estable, mejoras activas |
| 2D Roof Plan (RoofPreview / SVG / cotas) | 🟢 9/10 | 🟢 8/10 | Producción — sólido |
| AI Chat (Panelin Chat / agentChat SSE) | 🟡 6/10 | 🟡 5/10 | Funcional, sin KPI de uso |
| CRM / Dashboard (WolfBoard / Sheets) | 🟡 7/10 | 🟡 6/10 | Admin 2.0 en branch, no en prod |
| MercadoLibre Integration | 🟢 8/10 | 🟡 7/10 | OAuth OK, cm-1 pendiente humano |
| WhatsApp / Meta (omnicanal) | 🟡 6/10 | 🟡 5/10 | Webhook wired, cm-0 sin E2E humano |
| Email Ingest / Parse | 🟡 6/10 | 🟡 6/10 | Dry-run OK, cm-2 sin prod full |
| Google Sheets / Data | 🟢 8/10 | 🟢 8/10 | Estable, credenciales via Secret Manager |
| Deploy / CI/CD | 🟢 8/10 | 🟡 7/10 | Sin tags git, sin smoke post-deploy en CI |
| Tests (unit + API + contrato) | 🟢 8/10 | 🟡 7/10 | 335+ unit, 17 API route; sin E2E browser |
| Docs / Agents / Tooling | 🟢 9/10 | 🟢 8/10 | AUTOTRACE, dev-trace, 11 agentes, skills |
| Fiscal / Compliance | 🟡 6/10 | 🟡 5/10 | IVA en quotes OK; BPS/IRAE no trazado |

**Score global estimado:** 🟡 **71 / 100**

---

## Próximos pasos — ordenados por impacto × criticidad

---

### 🔴 CRÍTICO | 1. Mergear `feature/wolfboard-crm` a `main` y deployar

- **Situación:** La rama tiene 3 commits sobre `main` incluyendo WolfBoard Admin 2.0 ↔ CRM. No está en producción. Cada día que pasa aumenta el riesgo de conflicto y la deuda de integración.
- **Área:** `.` (raíz del repo), `src/`, `server/`
- **Acción "get it live":**
  1. `npm run gate:local:full` en la rama actual
  2. Abrir PR `feature/wolfboard-crm` → `main`
  3. Revisar diff, mergear
  4. `git tag v3.1.6` (o la versión que corresponda)
  5. `bash scripts/deploy-vercel.sh --prod`
  6. `npm run smoke:prod` → verificar en Vercel
- **Impacto:** Admin 2.0 CRM sigue invisible para el equipo. Sin merge, cualquier fix futuro genera conflictos.

---

### 🔴 CRÍTICO | 2. Verificar human gate cm-0 (WhatsApp E2E → fila CRM)

- **Situación:** cm-0 está documentado como `doing` desde 2026-04-17. Es el gate que valida que un mensaje real de WhatsApp llegue al webhook, sea procesado, y aparezca en la planilla CRM_Operativo. Sin esto, la integración omnicanal no está validada en producción.
- **Área:** `server/lib/omniRuntime.js`, `server/routes/bmcDashboard.js`, `docs/team/WHATSAPP-META-E2E.md`
- **Acción "get it live":**
  1. Seguir `docs/team/HUMAN-GATES-ONE-BY-ONE.md` → sección cm-0
  2. Enviar mensaje de prueba al número WA Business
  3. Verificar fila nueva en CRM_Operativo (Google Sheets)
  4. Documentar evidencia en PROJECT-STATE.md
- **Impacto:** Sin cm-0 validado, WhatsApp Business no puede considerarse canal operativo. Riesgo de pérdida de consultas.

---

### 🔴 CRÍTICO | 3. Crear git tag de versión (`v3.1.5` o superior)

- **Situación:** No hay ningún tag en el repo. El sistema de versiones semver existe en `package.json` y se embebe en el badge del frontend, pero el historial de git no tiene puntos de referencia. La trazabilidad AUTOTRACE y los checkpoints expert no pueden anclar versiones a deploys.
- **Área:** git, `tools/release-traceability/`
- **Acción "get it live":**
  1. Después de mergear `feature/wolfboard-crm`:
  2. `git tag v3.1.6 -m "WolfBoard Admin 2.0 + contribut/nxt skills"`
  3. `git push origin v3.1.6`
  4. CI `dev-trace.yml` corre automáticamente en tag `v*`
- **Impacto:** Sin tags, el historial es plano. Imposible hacer rollback preciso o comunicar changelog a clientes.

---

### 🟠 ALTO | 4. Completar y verificar cm-1 (MercadoLibre OAuth full cycle)

- **Situación:** OAuth ML funciona (`hasTokens: true` en Cloud Run). Falta verificación humana del ciclo completo: ver pregunta UNANSWERED → redactar respuesta → publicar en ML → confirmar llegada. El `ml:pending-workup` muestra ítems sin responder.
- **Área:** `server/routes/bmcDashboard.js` (rutas `/ml/*`), `server/lib/mlAnswerText.js`, `docs/team/panelsim/`
- **Acción "get it live":**
  1. `npm run ml:pending-workup` — ver preguntas pendientes
  2. Redactar respuesta con precio desde MATRIZ
  3. Publicar vía `POST /api/crm/cockpit/send-approved` con canal ML
  4. Verificar en ML que llegó la respuesta
  5. Documentar en PROJECT-STATE como cm-1 `done`
- **Impacto:** Cada pregunta ML sin respuesta es una venta potencial perdida. BMC tiene 41 publicaciones activas.

---

### 🟠 ALTO | 5. Verificar cm-2 (Email ingest en producción, no solo dry-run)

- **Situación:** `npm run email:ingest-snapshot -- --limit 1` en dry-run devolvió `crmRow=31`. Falta confirmar que el flujo real (no dry-run) inserte en CRM sin duplicados y que `POST /api/crm/ingest-email` en Cloud Run prod funcione con el timeout de 300s configurado.
- **Área:** `scripts/panelsim-email-ready.sh`, `server/routes/bmcDashboard.js` (`/api/crm/ingest-email`), repo IMAP hermano
- **Acción "get it live":**
  1. `npm run email:ingest-snapshot -- --limit 1` (sin `--dry-run`) con `BMC_API_BASE` apuntando a Cloud Run prod
  2. Verificar nueva fila en Master_Cotizaciones / CRM
  3. Marcar cm-2 `done` en PROJECT-STATE
- **Impacto:** El bridge de correo es el tercer canal de ingreso de leads. Sin validación real, puede haber pérdida silenciosa de emails.

---

### 🟠 ALTO | 6. Agregar smoke post-deploy automático en CI

- **Situación:** `.github/workflows/ci.yml` corre lint + tests en push/PR a `main`, pero no ejecuta `smoke:prod` después de un deploy exitoso. Un deploy puede pasar CI y aun así tener problemas en Cloud Run (timeout, env vars, etc.).
- **Área:** `.github/workflows/ci.yml`, `scripts/smoke-prod-api.mjs`
- **Acción "get it live":**
  1. Agregar job `smoke` en `ci.yml` que corra `npm run smoke:prod` después de deploy a Cloud Run
  2. Notificar fallo por email si smoke falla
  3. Commit → merge → verificar en GitHub Actions
- **Impacto:** Actualmente el equipo descubre errores post-deploy manualmente. Un smoke automático cierra ese loop.

---

### 🟠 ALTO | 7. Resolver ESLint warning en `SpecManagementSandbox.jsx`

- **Situación:** Hay 1 warning ESLint preexistente en `src/components/SpecManagementSandbox.jsx` que aparece en todos los runs de `gate:local`. No rompe el build, pero ensucia el output y puede enmascarar warnings nuevos.
- **Área:** `src/components/SpecManagementSandbox.jsx`
- **Acción "get it live":**
  1. `npm run lint` → identificar el warning exacto
  2. Corregir (probablemente un `useEffect` dependency array o variable no usada)
  3. `npm run gate:local` → 0 warnings
  4. Commit `fix(lint): resolve preexisting ESLint warning in SpecManagementSandbox`
- **Impacto:** `gate:local:full` limpio es un exit criterion del deploy 100%.

---

### 🟡 MEDIO | 8. Completar UI de encuentros multizona por tramo

- **Situación:** El modelo de datos `encounterByPair[pk].segments[]` existe y tiene tests (SUITE 32b). La UI en `RoofPreview.jsx` muestra sub-líneas y panel de tramos, pero el flujo "perfil independiente en tramo sobresaliente" y el toggle BOM por tramo tienen gaps según el informe de UX 2026-04-15.
- **Área:** `src/components/RoofPreview.jsx`, `src/utils/roofEncounterModel.js`, `src/utils/scenarioOrchestrator.js`
- **Acción "get it live":**
  1. Leer `docs/team/ux-feedback/LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-15-transcript-encuentros-tramos-perfiles.md`
  2. Implementar perfil por tramo sobresaliente
  3. `npm run gate:local:full` + QA manual en `localhost:5173`
  4. Deploy Vercel
- **Impacto:** Feature solicitada explícitamente por el usuario. Completa el flujo de cotización para techos complejos.

---

### 🟡 MEDIO | 9. Wizard: toggle largo global/local sobre `techo.zonas`

- **Situación:** Listado en el backlog del doc `PROTOTIPO-V32-HTML-VS-CALCULADORA-BMC.md` (B1–B5). El toggle de largo global/local afecta cómo se calcula la longitud de los paneles por zona — actualmente se maneja globalmente.
- **Área:** `src/components/PanelinCalculadoraV3_backup.jsx`, `src/data/constants.js`, `src/utils/calculations.js`
- **Acción "get it live":**
  1. Leer spec en `docs/team/PROTOTIPO-V32-HTML-VS-CALCULADORA-BMC.md` §toggle largo
  2. Implementar toggle por zona en `techo.zonas[]`
  3. Tests + lint + build + deploy
- **Impacto:** Precisión de cotización para techos con zonas de largo diferente.

---

### 🟡 MEDIO | 10. Verificar PDF export post-wizard-updates

- **Situación:** El wizard tuvo múltiples cambios (selladores cards, bordes 2D, estructura combinada, encuentros por tramo). No hay evidencia reciente de que el PDF generado (`quotationViews.js` + `captureDomToPng.js`) refleje todos los nuevos pasos correctamente.
- **Área:** `src/utils/quotationViews.js`, `src/utils/captureDomToPng.js`, `src/utils/helpers.js`
- **Acción "get it live":**
  1. Generar cotización completa en `localhost:5173` (techo + fachada)
  2. Descargar PDF → verificar que incluye planta 2D, BOM, precios, selladores, bordes
  3. Si hay gaps: corregir y deployar
- **Impacto:** El PDF es el entregable comercial principal. Un PDF incompleto afecta la credibilidad ante el cliente.

---

### 🔵 BAJO | 11. Instalar LaunchAgent del stack local

- **Situación:** `npm run local:stack:launchd:install` instala un LaunchAgent macOS que levanta API :3001 + Vite :5173 automáticamente al iniciar sesión. No está instalado actualmente (opcional pero mejora DX).
- **Área:** `scripts/install-local-stack-launchagent.sh`
- **Acción "get it live":** `npm run local:stack:launchd:install` → verificar con `curl localhost:3001/health`

---

### 🔵 BAJO | 12. Instalar digest diario por email

- **Situación:** `npm run magazine:schedule:install` instala un LaunchAgent macOS que envía el digest PROJECT-STATE a `matias.portugau@gmail.com` a las 08:00 Montevideo. Requiere `SMTP_USER` / `SMTP_PASS` en `.env`.
- **Área:** `scripts/install-magazine-daily-schedule.sh`
- **Acción "get it live":** Configurar SMTP en `.env` → `npm run magazine:schedule:install`

---

### 🔵 BAJO | 13. Lockear CORS a dominios conocidos en producción

- **Situación:** En `server/config.js` / `server/index.js`, CORS en desarrollo puede ser abierto. En producción debería estar restringido a `calculadora-bmc.vercel.app` y dominios internos conocidos.
- **Área:** `server/config.js`, `server/index.js`
- **Acción "get it live":** Revisar config CORS en Cloud Run → restringir origen → redeploy → smoke

---

## Resumen ejecutivo del estado

```
PRODUCCIÓN HOY (2026-04-23):
  Frontend (Vercel):   ✅ v3.1.5 — calculadora-bmc.vercel.app
  API (Cloud Run):     ✅ rev 00170-5jb — timeout 300s, PUBLIC_BASE_URL ok
  Google Sheets:       ✅ credenciales via Secret Manager
  ML OAuth:            ✅ hasTokens: true (verificado 2026-04-12)
  WhatsApp webhook:    ⚠️  wired pero cm-0 sin E2E humano
  Email ingest:        ⚠️  dry-run ok, prod no verificado
  WolfBoard Admin 2.0: ⚠️  en branch, no mergeado

EN DESARROLLO (branch feature/wolfboard-crm):
  + WolfBoard Admin 2.0 ↔ CRM
  + contribut / nxt skills

BLOQUEANTES PARA 100% EXIT DEPLOY:
  🔴 Merge branch → main + git tag
  🔴 cm-0 WhatsApp E2E humano
  🟠 cm-1 ML publicación humana
  🟠 cm-2 Email ingest producción real
  🟠 Smoke post-deploy en CI
  🟠 ESLint warning SpecManagementSandbox
```

---

*Este documento es la fuente de verdad del roadmap. Actualizar cada vez que un ítem cambie de estado.*
*El skill `/nxt` lo lee en cada invocación como baseline — scores y próximos pasos se ajustan desde aquí.*

---

## Historial de scores

| Fecha | Score | Evento |
|-------|-------|--------|
| 2026-04-23 | 🟡 71/100 | Baseline inicial (diagnóstico sesión) |
| 2026-04-23 | 🟢 76/100 | Merge v3.1.6 + deps fix (14→4 vulns) + ESLint 0 warnings |
| 2026-04-23 | 🟢 80/100 | cm-0 ✅ cm-1 ✅ confirmados + KB Accessible Base system live + WolfBoard en prod |
| 2026-04-23 | 🟢 84/100 | cm-2 ✅ email ingest prod (crmRow=32) + smoke CI — todos los gates completos |
