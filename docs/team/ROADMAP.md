# Calculadora BMC — Roadmap & Estado del Proyecto

**Generado:** 2026-04-24 | **Versión:** 3.1.5 | **Branch activo:** `main` *(baseline canónica)*
**Fuente:** git log, PROJECT-STATE.md, CEO-RUN-LOG.md, AGENTS.md, CLAUDE.md, estructura del repo.

---

## Misión

> Automatizar y profesionalizar el proceso comercial de BMC Uruguay (METALOG SAS) para paneles Panelin — desde la cotización técnica hasta el cierre de venta — integrando todos los canales de contacto (WhatsApp, MercadoLibre, email) con una calculadora precisa y un CRM operativo unificado.

## Visión

> Ser la plataforma omnicanal de referencia para la venta de paneles de aislación en Uruguay, donde cualquier vendedor o cliente obtenga una cotización precisa en minutos, y cada consulta quede registrada, respondida y trazada hasta el cierre de la venta — con mínima intervención manual.

## Objetivo medible (exit criteria del 100%)

Un deploy es **100% limpio** cuando:
- [ ] `npm run gate:local:full` → 0 errores, 0 warnings nuevos
- [x] `npm run smoke:prod` → **todos** los checks verdes. **2026-04-24 ✅:** `/health`, `/capabilities`, `public_base_url`, MATRIZ CSV, `POST /api/crm/suggest-response` (provider: claude). CI jobs: validate ✅ lint ✅ smoke ✅ channels_pipeline ✅ knowledge_antenna ✅.
- [ ] `npm run test:contracts` → contrato API sin drift
- [ ] Vercel producción sirve la versión correcta del chunk (semver en badge)
- [ ] Cloud Run responde `hasSheets: true`, `hasTokens: true` en `/health`
- [ ] Rama mergeada a `main` con git tag `vX.Y.Z` *(tag `v3.1.6` verificado en `origin` al 2026-04-23 — ver [`PROJECT-STATE.md`](./PROJECT-STATE.md); repetir en el próximo bump semver)*
- [x] Gates humanos cm-0 / cm-1 / cm-2 verificados y documentados en PROJECT-STATE *(2026-04-23; ingest email prod OK — ver PROJECT-STATE)*

---

## Áreas activas y scores

| Área | Calidad | Completitud | Estado |
|------|---------|-------------|--------|
| Calculator (BOM / pricing / wizard) | 🟢 8/10 | 🟡 7/10 | Estable, mejoras activas |
| 2D Roof Plan (RoofPreview / SVG / cotas) | 🟢 9/10 | 🟢 8/10 | Producción — sólido |
| AI Chat (Panelin Chat / agentChat SSE) | 🟡 6/10 | 🟡 5/10 | Funcional, sin KPI de uso |
| CRM / Dashboard (WolfBoard / Sheets) | 🟢 8/10 | 🟡 7/10 | Wolfboard prod OK; `suggest-response` ✅ verde (claude, 2026-04-24); QA visual `/hub/canales` `/hub/admin` `/hub/ml` OK |
| MercadoLibre Integration | 🟢 8/10 | 🟡 7/10 | OAuth OK; ciclo publicación humana (cm-1) sigue como mejora continua |
| WhatsApp / Meta (omnicanal) | 🟢 7/10 | 🟡 6/10 | cm-0 documentado DONE en PROJECT-STATE; mantener verificación periódica |
| Email Ingest / Parse | 🟢 7/10 | 🟢 7/10 | cm-2 prod verificado (crmRow=32); ver PROJECT-STATE |
| Google Sheets / Data | 🟢 8/10 | 🟢 8/10 | Estable, credenciales via Secret Manager |
| Deploy / CI/CD | 🟢 8/10 | 🟢 8/10 | CI todos los jobs ✅ (2026-04-24); smoke job ya existía y cubre suggest-response; Cloud Run rev-00210 |
| Tests (unit + API + contrato) | 🟢 8/10 | 🟡 7/10 | **370 pass** (2026-04-24); 17 API route; sin E2E browser |
| Docs / Agents / Tooling | 🟢 9/10 | 🟢 8/10 | AUTOTRACE, dev-trace, 11 agentes, skills |
| Panelin Internal RBAC | 🟢 8/10 | 🟢 8/10 | En prod; 29 E2E API tests ✅ (2026-04-24 commit 9c89f74) |
| Hub Canales (WA+ML+Email) | 🟢 8/10 | 🟡 7/10 | `BmcCanalesUnificadosModule` en prod; QA visual ✅ filtros ML/WA/IG/FB |
| Fiscal / Compliance | 🟡 6/10 | 🔴 5/10 | IVA en quotes OK; BPS/IRAE no trazado |

**Score global estimado:** 🟢 **75 / 100** *(2026-04-24 — RBAC E2E 29 tests ✅, ESLint 0 warnings, AI Chat metrics existentes. Sube a 80+ con encuentros multizona + PDF QA + CORS.)*

**Historial de scores:**
| Fecha | Score | Evento |
|-------|-------|--------|
| 2026-04-18 | 60/100 | cm-0/cm-1 done; cm-2 dry-run OK |
| 2026-04-23 | 68/100 | smoke ámbar (suggest 503); gates cm-0/1/2 DONE |
| 2026-04-24 | 73/100 | suggest-response verde, CI smoke ✅, RBAC + hub canales en prod |
| 2026-04-24 | 75/100 | RBAC 29 E2E tests, ESLint 0w, items 7/7b/7c DONE |

---

## Próximos pasos — ordenados por impacto × criticidad

---

### ✅ RESUELTO | 1. Smoke:prod 100% verde — suggest-response IA

- **Resuelto 2026-04-24:** `ANTHROPIC_API_KEY` creada en Secret Manager y mapeada a Cloud Run (rev-00210). Créditos Anthropic cargados. Clave rotada. `npm run smoke:prod` → `ok: true, provider: claude`. CI todos los jobs verdes. Ver [PROJECT-STATE.md](./PROJECT-STATE.md) entrada 2026-04-24.

---

### 🟡 MEDIO | 2. Git tag `v3.1.6` (verificado en `origin`; siguiente semver al bump)

- **Situación (2026-04-23):** `git ls-remote --tags origin 'v3.1.*'` confirma **`refs/tags/v3.1.6`** en remoto — ancla AUTOTRACE/CI **OK** para esta versión. Tras el próximo bump de `package.json`, repetir tag semver + push.
- **Área:** git, [`tools/release-traceability/`](../../tools/release-traceability/), [`.github/workflows/dev-trace.yml`](../../.github/workflows/dev-trace.yml)
- **Acción "get it live":** En releases futuras: `git tag vX.Y.Z -m "..."` → `git push origin vX.Y.Z` → confirmar workflow en GitHub Actions.
- **Impacto:** Rollbacks y comunicación de versión a clientes/soporte.

---

### ✅ RESUELTO | 3. WIP commiteado en batch (2026-04-24)

- **Resuelto 2026-04-24:** 48 archivos commiteados en 4 bloques lógicos: `feat(panelin-internal)`, `feat(wolfboard)`, `chore(tooling)`, `docs(team+agents)`. Todos pusheados a `main`. CI verde.

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

### 🟡 MEDIO | 5. Regresión canales (cm-0 / cm-2) — verificación periódica

- **Situación:** cm-0 y cm-2 figuran como **DONE** en [`PROJECT-STATE.md`](./PROJECT-STATE.md) (2026-04-23). Mantener chequeos puntuales (WhatsApp → fila CRM; email ingest prod) en cada release mayor o mensualmente.
- **Área:** `docs/team/HUMAN-GATES-ONE-BY-ONE.md`, scripts ingest / omni
- **Acción "get it live":** Checklist corto + evidencia en PROJECT-STATE si algo cambia en Meta o credenciales.

---

### ✅ RESUELTO | 6. Smoke post-deploy en CI

- **Resuelto (ya existía):** El job `smoke` en `.github/workflows/ci.yml` ya corría `npm run smoke:prod` en push a `main`. Verificado 2026-04-24: detectó correctamente el 503 de suggest-response en los 4 runs previos y pasó verde tras el fix.

---

### ✅ RESUELTO | 7. ESLint warning en `SpecManagementSandbox.jsx`

- **Resuelto commit `1966b38`:** `fix(lint): resolve all ESLint warnings in new and existing components`. `npm run lint` → 0 warnings.

---

### ✅ RESUELTO | 7b. E2E API tests — Panelin Internal RBAC

- **Resuelto 2026-04-24 commit `9c89f74`:** `tests/panelinInternalApi.test.js` — 29 tests cubriendo `/whoami`, `/tools`, `/policies`, `/invoke` con RBAC enforcement. Wired en `test:api`. PDF url assertion también corregida (GCS vs local proxy).

---

### ✅ RESUELTO | 7c. AI Chat — métricas de uso

- **Resuelto (ya existía):** `server/lib/conversationLog.js` + `server/routes/agentConversations.js` implementan logging completo (meta, turns, actions, hedge count, latency) y endpoints `GET /api/agent/conversations`, `/weekly-digest`, `/analyze-batch`, `/:id/analysis`. Montado en `server/index.js`. UI en `PanelinDevPanel.jsx`.

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
PRODUCCIÓN HOY (2026-04-23) — alineado a PROJECT-STATE + smoke:
  Frontend (Vercel):     ✅ v3.1.5 — calculadora-bmc.vercel.app
  API (Cloud Run):     ⚠️  rev 00170-5jb — /health OK; smoke: MATRIZ + suggest 503;
                         public_base_url en /capabilities = http://localhost:3001 (drift)
  Google Sheets:       ✅ credenciales Secret Manager (rutas que fallan: revisar MATRIZ ID/share)
  ML OAuth:            ✅ histórico hasTokens; /auth/ml/status 404 sin sesión = OK en smoke
  WhatsApp / cm-0:     ✅ documentado DONE (verificar regresión según ítem MEDIO 5)
  Email ingest / cm-2: ✅ prod verificado (crmRow=32)
  WolfBoard:           ✅ en main; GET /api/wolfboard/pendientes 200 en prod

EN DESARROLLO (local / próximos PRs):
  + Posible WIP sin commit en main (server, dashboard, skills) — ver git status

BLOQUEANTES PARA 100% EXIT DEPLOY:
  🔴 Fase A CEO-RUN: PUBLIC_BASE_URL + MATRIZ CSV + suggest IA + smoke:prod OK
  🔴 Tag git vX.Y.Z en remoto + trazabilidad
  🟠 cm-1 ciclo ML humano (mejora continua)
  🟠 Smoke post-deploy en CI
  🟠 ESLint warning SpecManagementSandbox (si aún aplica en gate:local)
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
| 2026-04-23 | 🟢 84/100 | cm-2 ✅ email ingest prod (crmRow=32) — gates humanos completos |
| 2026-04-23 | 🟡 68/100 | Reconciliación ROADMAP: merge Wolfboard en `main`; smoke prod aún rojo (503 MATRIZ/suggest, drift PUBLIC_BASE_URL) — ver CEO-RUN Fase A |
| 2026-04-24 | 🟢 73/100 | suggest-response ✅ (claude), CI smoke passing, RBAC + hub canales en prod, 370 tests |
| 2026-04-24 | 🟢 75/100 | RBAC 29 E2E API tests + PDF url assertion fix; items 7/7b/7c DONE; ESLint 0w confirmado |
