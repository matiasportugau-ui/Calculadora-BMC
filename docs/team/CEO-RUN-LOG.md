# CEO AI Agent — Run Log

**Purpose:** Track CEO runs and progress toward the objective: **project working by end of week**.

**Objective:** Tier 1 (MVP) — Dashboard working locally: §4 Stack local ✓, §6 E2E validation ✓, KPIs/Entregas/Trend funcionales.

---

## Run History

### Run 2.1 — 2026-04-23 (Verificación agente Cursor: `smoke:prod` + `git ls-remote` + `curl` suggest)

**Objective:** Confirmar estado real post–Run 2 para checklist **A3/A4** y crítico “tag en origin”.

**Actions (solo lectura / comandos locales):**

1. `npm run smoke:prod` — base default `https://panelin-calc-q74zutv7dq-uc.a.run.app`.
2. `git ls-remote --tags origin 'v3.1.*'` — comprobar ancla semver en remoto.
3. `curl -sS -X POST …/api/crm/suggest-response` con body mínimo `consulta` — capturar JSON de error (sin registrar valores de claves).

**Post-run:**

- Smoke: **5/6 verdes** — falla **solo** `POST /api/crm/suggest-response` (503, `All providers failed`; detalle: Grok 400 key incorrecta; OpenAI 401; Gemini error fetch; Claude **no key**).
- Tag **`v3.1.6`**: **✓** presente en `origin` (`refs/tags/v3.1.6`).
- **A3** checklist: sigue **☐** hasta rotación humana de secretos GSM + redeploy si aplica.
- **A4**: **☐** pendiente de A3.

---

### Run 2 — 2026-04-23 (Fase A ops — `gcloud` + smoke; suggest bloqueado por keys GSM)

**Objective:** Cerrar Fase A del plan CEO (PUBLIC_BASE_URL, MATRIZ, suggest IA, `npm run smoke:prod`).

**Pre-run state:** Ver Run 1 / smoke spot-check (drift `public_base_url`, 503 MATRIZ y suggest).

**Actions (agente Cursor + `gcloud`, proyecto `chatbot-bmc-live`):**

1. `gcloud run services update panelin-calc` — `--update-env-vars`: `PUBLIC_BASE_URL=https://panelin-calc-q74zutv7dq-uc.a.run.app`, `GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa-key.json`, `BMC_MATRIZ_SHEET_ID=1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`.
2. Primera revisión: `--update-secrets` `OPENAI_API_KEY=openai-api-key:latest`, `GROK_API_KEY=xai-api-key:latest`, `GEMINI_API_KEY=gemini-api-key:latest`.
3. Segunda revisión: `OPENAI_API_KEY=OPENAI_API_KEY:latest` (secret alternativo en GSM).
4. `npm run smoke:prod` (base default).

**Post-run:**

- `public_base_url`: **✓** coincide con la base del smoke.
- `GET /api/actualizar-precios-calculadora`: **✓** 200 + CSV MATRIZ.
- `POST /api/crm/suggest-response`: **✗** 503 — cuerpo `All providers failed`: Grok 400 API key incorrecta; OpenAI 401; Gemini error fetch; Claude sin key. Las versiones actuales en Secret Manager (`openai-api-key`, `OPENAI_API_KEY`, `xai-api-key`, `gemini-api-key`) **no** tienen claves válidas para el proveedor, y el `.env` local tiene `OPENAI_API_KEY` / `GROK_API_KEY` / `GEMINI_API_KEY` **vacíos** (no se pudo re-seed desde repo).
- Tier 1 (MVP): **✗** — Smoke prod no OK completo hasta suggest.
- **Next (humano):** Rotar al menos **una** clave válida en GSM y repetir deploy si hace falta, p. ej. `printf '%s' 'sk-…' | gcloud secrets versions add openai-api-key --data-file=- --project=chatbot-bmc-live` (o el nombre de secret que elijan) y `npm run smoke:prod`. Opcional: añadir **ANTHROPIC_API_KEY** en GSM + `--update-secrets` y extender cadena en código para priorizar Claude (fuera de este run).

---

### Run doc-only — 2026-04-23 (ROADMAP + `kb:build`, sin Fase A GCP)

**Objective:** Alinear documentación canónica con la realidad de `main` y con el smoke documentado (sin ejecutar cambios en Cloud Run en esta sesión).

**Actions:** Edición de [`docs/team/ROADMAP.md`](./ROADMAP.md) (cabecera `main`, exit criteria, tabla de áreas, críticos 1–3, resumen ejecutivo, historial de scores). `npm run kb:build` para refrescar [`.accessible-base/kb.json`](../../.accessible-base/kb.json) local (archivo gitignored). Entrada correspondiente en [`PROJECT-STATE.md`](./PROJECT-STATE.md).

**Post-run:** Ops **A1–A4** siguen pendientes en GCP; repetir `npm run smoke:prod` tras completar Fase A para cerrar discrepancia ROADMAP ↔ prod.

---

### Run 1 — 2026-04-23 (CEO init vía chat; sin full team 0→9 ejecutado en esta sesión)

**Objective:** Project working by end of week (Tier 1: MVP)

**Pre-run state (fuentes: PROJECT-STATE, GO-LIVE-DASHBOARD-CHECKLIST, este log):**

- `PROJECT-STATE` (2026-04-23): `npm run gate:local` OK (**357** tests + lint). Canales **cm-0 / cm-1 / cm-2** cerrados; ingest email prod verificado. `npm run smoke:prod` **parcial**: `/health` y `/capabilities` 200; pendientes ops — **`public_base_url` en manifest** vs URL canónica Cloud Run; **`GET /api/actualizar-precios-calculadora` → 503** (MATRIZ/Sheets/secretos); **`POST /api/crm/suggest-response` → 503** (keys IA en Cloud Run).
- Checklist [`docs/bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md`](../bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md): §4 local en gran parte ☑; **§6.1–6.7 E2E** siguen ☐ en el documento; §5 deploy estable ☐.

**Actions (esta sesión):** Lectura de estado + informe CEO; **no** se invocó Orquestador ni pasos 1–8 del full team en un solo hilo multi-agente.

**Post-run:**

- Tier 1: **✗** — Criterio formal §6 E2E no marcado en checklist; además smoke prod con 503 en rutas críticas MATRIZ / suggest IA y drift `PUBLIC_BASE_URL` documentado en PROJECT-STATE.
- Tier 2: **✗** — Workbook 1.4, tabs 2.x, Apps Script 3.x siguen ☐ en checklist.
- Tier 3: **✗** — Producción Cloud Run existe pero checklist §5 y cierre de smoke completo pendientes de alineación.
- Blockers: (1) Alinear **`PUBLIC_BASE_URL`** en servicio Cloud Run con URL canónica. (2) Restaurar **export MATRIZ** (`/api/actualizar-precios-calculadora`) y **suggest-response** en prod (Sheets + keys IA). (3) Completar verificación **§6.1–6.7** en entorno real o actualizar checklist con evidencia si ya aplica.
- Next: Ejecutar **Invoque full team** (Orquestador + `bmc-project-team-sync`) en sesión dedicada **o** corrida focal ops (smoke prod + deploy env) según prioridad Matias; repetir evaluación Tier 1 tras evidencia.

---

### Smoke spot-check — 2026-04-23 (Cursor agent, `npm run smoke:prod`)

**Base:** `https://panelin-calc-q74zutv7dq-uc.a.run.app`  
**Resultado:** **FALLA** (mismo patrón que Run 1).

| Paso | Resultado | Nota |
|------|-----------|------|
| GET /health | ✓ 200 | Servicio vivo |
| GET /capabilities | ✓ 200 | Manifest |
| Chequeo `public_base_url` | ✗ | Manifest = `http://localhost:3001` vs base smoke — ajustar **`PUBLIC_BASE_URL`** en Cloud Run |
| GET /api/actualizar-precios-calculadora | ✗ 503 | MATRIZ / Sheets / secretos / `BMC_MATRIZ_SHEET_ID` |
| GET /auth/ml/status | ✓ 404 | Sin token ML (esperable) |
| POST /api/crm/suggest-response | ✗ 503 | Keys IA en Cloud Run |

---

## Roadmap Hit — Fases A / B / C (orden para “make a hit”)

**Regla:** no pasar a **B** hasta tener **A3** en verde o decisión explícita de posponer MATRIZ/suggest. **C** es apalancamiento después de demo comercial estable.

### Fase A — Ops / confianza (48–72 h) — *desbloquea Tier 1 + smoke*

- [x] **A1.** En GCP Cloud Run (`panelin-calc`): setear **`PUBLIC_BASE_URL`** = URL canónica del servicio (`gcloud run services describe … status.url`), redeploy si hace falta; verificar `GET /capabilities` → `public_base_url` coincide con la base del smoke. *(Run 2, 2026-04-23)*
- [x] **A2.** Restaurar **MATRIZ**: Secret SA + **`BMC_MATRIZ_SHEET_ID`**, workbook compartido con la SA; `GET /api/actualizar-precios-calculadora` → **200** + CSV con cabecera esperada. *(Run 2 — también `GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa-key.json` en env)*
- [ ] **A3.** Restaurar **suggest IA**: vars de modelo/API en Cloud Run según [`server/config.js`](../../server/config.js) / docs de CRM; `POST /api/crm/suggest-response` → **200** + `{ ok: true }`. *(Parcial: secret refs montados; **rotar** claves válidas en GSM — ver Run 2)*
- [ ] **A4.** `npm run smoke:prod` → **OK completo** (sin `--skip-matriz` salvo decisión documentada). *(Pendiente: falla solo por A3)*
- [ ] **A5.** Cerrar o actualizar **§6.1–6.7** en [`GO-LIVE-DASHBOARD-CHECKLIST.md`](../bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md) con evidencia (fecha + nota breve). *(Parcial: fila §6 API smoke — ver checklist)*

### Fase B — Producto / venta (2–4 semanas) — *capitaliza lo ya construido*

- [ ] **B1.** Guion **demo 10 min**: calculadora → PDF/WhatsApp → fila CRM → (opcional) suggest → aprobación; grabación o doc en `docs/team/` según prefieras.
- [ ] **B2.** Ritmo **ML + KB**: `npm run ml:pending-workup` + actualización [`ML-RESPUESTAS-KB-BMC.md`](./panelsim/knowledge/ML-RESPUESTAS-KB-BMC.md) con métricas por sprint.
- [ ] **B3.** Ritual **AUTOTRACE / magazine** semanal para dirección (qué cambió, riesgo, próximo foco).
- [ ] **B4.** Un **Invoque full team** con alcance acotado (RUN-SCOPE-GATE) post–A4.

### Fase C — Moat (60–90 días)

- [ ] **C1.** Smoke MATRIZ + suggest como **gate** en CI o pre-deploy (fallar si 503).
- [ ] **C2.** Una regla de negocio **precio único** MATRIZ ↔ web ↔ ML (auditoría mensual).
- [ ] **C3.** Tier 2 checklist (workbook 1.4, tabs, Apps Script) y luego Tier 3 (§5) según [`GO-LIVE-DASHBOARD-CHECKLIST.md`](../bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md).

**Definición “Hit”:** A4 verde + A5 documentado + B1 listo para mostrar a un cliente real.

---

## Current Status

| Tier | Status | Notes |
|------|--------|-------|
| Tier 1 (MVP) | Pending | Smoke prod: **MATRIZ + `public_base_url` OK** (Run 2); **`suggest-response` 503** hasta rotar keys GSM; checklist §6 UI sin evidencia aún |
| Tier 2 | Pending | Tabs, Apps Script, workbook share — checklist |
| Tier 3 | Pending | Smoke prod completo + §5 según evidencia |

---

## Next CEO Run

When "CEO run" is invoked:
1. Read PROJECT-STATE, GO-LIVE-DASHBOARD-CHECKLIST, this log.
2. Invoque full team.
3. Update this log with run summary and progress.
