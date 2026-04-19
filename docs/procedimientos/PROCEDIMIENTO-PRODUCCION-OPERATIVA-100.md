# Procedimiento producción operativa BMC — mapa al 100%

Este documento **ordena** el cierre operativo (calculadora + API + canales + cockpit) y enlaza los runbooks largos. **No sustituye** [`CANONICAL-PRODUCTION.md`](../calculadora/CANONICAL-PRODUCTION.md), el checklist de deploy ni los procedimientos detallados citados abajo.

---

## Leyenda de participación

- **[H0]**: humano una vez (secretos, Meta webhook, OAuth ML/Drive en consola, compartir planillas con service account).
- **[H]**: humano ocasional (revisar fila CRM, aprobar envío, decidir si un fallo es aceptable).
- **[A]**: automatizable (CLI, CI, sin credenciales nuevas).
- **[A|H]**: automático solo si **[H0]** ya cumplido.

---

## BASE oficial (fuente única)

**No** copiar URLs de ejemplos antiguos en MD si difieren. Obtener la URL real:

```bash
gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)'
```

| Campo | Valor vigente (última verificación documental: 2026-04-18) |
|-------|------------------------------------------------------------|
| **BASE** | `https://panelin-calc-q74zutv7dq-uc.a.run.app` |
| **Calculadora** | `{BASE}/calculadora/` |
| **Health** | `{BASE}/health` |
| **MATRIZ CSV** | `{BASE}/api/actualizar-precios-calculadora` |

**Modo de tráfico:** según [`CANONICAL-PRODUCTION.md`](../calculadora/CANONICAL-PRODUCTION.md) — **Modo B (recomendado):** Cloud Run unificado (SPA + API mismo origen). **Modo A:** Vercel frontend + `VITE_API_URL` = `BASE` — [`VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md), [`scripts/deploy-vercel.sh`](../../scripts/deploy-vercel.sh).

**Criterio listo (Fase 0):** `BASE` anotada aquí y en [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md); smoke y Meta/Vercel usan la misma base.

---

## Fase 1 — Bootstrap infra y Sheets [H0]

Alineado a [`CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](./CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md) (Fases 1–2) y Bloque A de [`ASYNC-RUNBOOK-UNATTENDED.md`](../team/orientation/ASYNC-RUNBOOK-UNATTENDED.md).

- **[H0]** Service account: JSON en Secret Manager + volumen en Cloud Run; `GOOGLE_APPLICATION_CREDENTIALS` = ruta dentro del contenedor que coincida con el mount.
- **[H0]** Compartir con el email `…@…gserviceaccount.com`: MATRIZ (`BMC_MATRIZ_SHEET_ID`), workbook CRM (`BMC_SHEET_ID`) y pestañas usadas por [`server/routes/bmcDashboard.js`](../../server/routes/bmcDashboard.js).
- **[H0]** Variables mínimas en Cloud Run: `NODE_ENV=production`, MATRIZ + CRM según [`.env.example`](../../.env.example); `API_AUTH_TOKEN` o `API_KEY` si se usan cockpit / rutas protegidas ([`CRM-OPERATIVO-COCKPIT.md`](../team/panelsim/CRM-OPERATIVO-COCKPIT.md)).
- **[A]** Verificación CSV: `curl -sS "$BASE/api/actualizar-precios-calculadora" | head` debe ser CSV, no JSON de error.

**Criterio listo:** health + CSV MATRIZ + `/calculadora/` + “Cargar desde MATRIZ” en navegador con `BASE` actual.

---

## Fase 2 — Build y deploy Cloud Run [A|H0]

- **[A]** Desde raíz: [`scripts/deploy-cloud-run.sh`](../../scripts/deploy-cloud-run.sh) ([`cloudbuild.yaml`](../../cloudbuild.yaml) + [`Dockerfile.bmc-dashboard`](../../Dockerfile.bmc-dashboard)).
- **[H]** Si falla build por cuota/credenciales: resolver en GCP; no commitear secretos.
- **Post-deploy [A]:** `BMC_API_BASE="$BASE" npm run smoke:prod` y opcionalmente `BMC_API_BASE="$BASE" npm run pre-deploy` ([`scripts/pre-deploy-check.sh`](../../scripts/pre-deploy-check.sh), [`scripts/validate-api-contracts.js`](../../scripts/validate-api-contracts.js)).
- **Rollback [H]:** revisión anterior en Cloud Console; tráfico 100% — [`RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md) §6.

---

## Fase 3 — Vercel (Modo A, opcional) [H0 + A]

Solo si el tráfico público sigue en Vercel.

- **[H0]** En proyecto Vercel: `VITE_API_URL` = `BASE` (sin `/` final), `VITE_BASE=/` — [`VERCEL-CALCULADORA-SETUP.md`](../VERCEL-CALCULADORA-SETUP.md).
- **[A]** `./scripts/deploy-vercel.sh --prod` tras cambios de front o de vars.

**Criterio listo:** desde `https://calculadora-bmc.vercel.app`, Config → Cargar desde MATRIZ y chat/API no apuntan a host obsoleto.

---

## Fase 4 — Google Drive (opcional v1) [H0]

- **[H]** Decisión in/out v1 — [`CALCULADORA-LAUNCH-GAPS.md`](../calculadora/CALCULADORA-LAUNCH-GAPS.md) §6, [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md).
- Si **in**: build con `VITE_GOOGLE_CLIENT_ID` + **Authorized JavaScript origins** = origen exacto de `BASE` (y Vercel si aplica) — [`CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](./CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md) Fase 5, [`PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](./PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md).

---

## Fase 5 — Cierre calculadora v1 (producto + QA) [A + H]

- **[A]** `npm run gate:local:full` antes de cada release que toque `src/`.
- **[H]** [`BROWSER-QA-CHECKLIST.md`](../calculadora/BROWSER-QA-CHECKLIST.md) contra `{BASE}/calculadora/` (y Vercel si es entrada).
- **[H]** Cerrar o documentar gaps — [`CALCULADORA-LAUNCH-GAPS.md`](../calculadora/CALCULADORA-LAUNCH-GAPS.md).
- **Go/No-Go:** [`RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md) §7.

---

## Fase 6 — Canales comerciales (cm-0 → cm-2) [H0 + A + H]

Orden global: `Bootstrap [H0] → Verificar prod [A] → WhatsApp E2E [H0]+[A]+[H] → ML [H0]+[A|H] → Correo [A|H]+[H] → Cierre JSON [H]` — [`ASYNC-RUNBOOK-UNATTENDED.md`](../team/orientation/ASYNC-RUNBOOK-UNATTENDED.md) §2.

Detalle: [`HUMAN-GATES-ONE-BY-ONE.md`](../team/HUMAN-GATES-ONE-BY-ONE.md).

**Automatización diaria [A]:** `npm run channels:automated` y opcional `--write` → `.channels/last-pipeline.json` ([`scripts/channels-automated-pipeline.mjs`](../../scripts/channels-automated-pipeline.mjs)).

**Criterio p2** (runbook §1): `smoke:prod` OK; evidencia CRM cm-0/cm-1/cm-2 según procedimiento de canales.

---

## Fase 7 — Cockpit CRM + ML operativo (Wolfboard) [H0 + H + A]

- **[H0]** Cabeceras fila 3 en `CRM_Operativo` AG–AK — [`CRM-OPERATIVO-COCKPIT.md`](../team/panelsim/CRM-OPERATIVO-COCKPIT.md).
- **[A]** Smoke HTTP cockpit con token: `GET /api/crm/cockpit/ml-queue` (contrato en [`scripts/validate-api-contracts.js`](../../scripts/validate-api-contracts.js) cuando `API_AUTH_TOKEN` está definido).
- **[H]** Cola ML → editar AF en Sheets o UI → Aprobar → `send-approved`.
- **UI:** ruta `/hub/ml` en [`src/App.jsx`](../../src/App.jsx) — en Modo A, token en sesión; en Modo B, API en `{BASE}` con token.

Runbook: [`CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md`](../team/panelsim/CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md).

---

## Fase 8 — Omnicanal Meta / Postgres (si está en alcance) [H0 + A]

Si el despliegue usa `DATABASE_URL` y tablas `omni_*` — [`PROJECT-STATE.md`](../team/PROJECT-STATE.md), [`OMNI-META-RUNBOOK.md`](../team/OMNI-META-RUNBOOK.md) cuando aplique.

**Criterio listo:** `GET /api/omni/health` y flujo documentado; sin `DATABASE_URL`, el repo documenta fallback a WhatsApp legacy — no marcar omnicanal 100% sin DB.

---

## Fase 9 — Documentación y estado del proyecto [H]

- Tras hitos: entrada en [`PROJECT-STATE.md`](../team/PROJECT-STATE.md) “Cambios recientes”.
- Actualizar tablas de URL en brief/checklist si `BASE` cambió — [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md), [`BROWSER-QA-CHECKLIST.md`](../calculadora/BROWSER-QA-CHECKLIST.md).

---

## Definición operativa de “100%”

| Nivel | Criterio mínimo |
|-------|-----------------|
| **100% API + calculador en prod** | Smoke prod + health + CSV MATRIZ + `/calculadora/` + Cargar MATRIZ + Go checklist release |
| **100% producto v1 cotizador** | Lo anterior + gaps launch + QA navegador |
| **100% canales comerciales (p2)** | Criterios §1 de [`ASYNC-RUNBOOK-UNATTENDED.md`](../team/orientation/ASYNC-RUNBOOK-UNATTENDED.md) + evidencia CRM |
| **100% cockpit ML/Wolfboard** | Headers AG–AK + prueba `ml-queue` / `sync-ml` / `send-approved` con token |

No hace falta completar Fases 6–8 para declarar **100% solo calculadora** — ver [`RELEASE-BRIEF-OFFICIAL.md`](../calculadora/RELEASE-BRIEF-OFFICIAL.md).

---

## Riesgos (resumen)

- **Drift de URL** entre Vercel, docs y Meta: mitigar con `gcloud describe` y esta tabla BASE.
- **Secretos en logs:** no pegar tokens; rotar si hubo exposición — nota en [`CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](./CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md).

---

## Orden recomendado de ejecución

1. Fase 0 (BASE + modo A/B).  
2. Fase 1 (Sheets + secrets + vars Cloud Run).  
3. Fase 2 (deploy Cloud Run + smoke + pre-deploy).  
4. Fase 3 (Vercel solo si Modo A).  
5. Fase 4 (Drive si v1).  
6. Fase 5 (gate + QA + gaps + Go/No-Go).  
7. Fase 6 (cm-0 → cm-2 + `channels:automated`).  
8. Fase 7 (cockpit + ML Wolfboard + planilla).  
9. Fase 8 (omni solo si en alcance).  
10. Fase 9 (PROJECT-STATE + docs URL).

---

## Fuentes canónicas enlazadas

- [`docs/calculadora/CANONICAL-PRODUCTION.md`](../calculadora/CANONICAL-PRODUCTION.md)
- [`docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`](./CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md)
- [`docs/procedimientos/PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md`](./PROCEDIMIENTO-CALCULADORA-Y-API-CLOUD-RUN-COMPLETO.md)
- [`docs/team/orientation/ASYNC-RUNBOOK-UNATTENDED.md`](../team/orientation/ASYNC-RUNBOOK-UNATTENDED.md)
- [`docs/team/HUMAN-GATES-ONE-BY-ONE.md`](../team/HUMAN-GATES-ONE-BY-ONE.md)
- [`docs/calculadora/RELEASE-CHECKLIST-CALCULADORA.md`](../calculadora/RELEASE-CHECKLIST-CALCULADORA.md)
- [`docs/calculadora/CALCULADORA-LAUNCH-GAPS.md`](../calculadora/CALCULADORA-LAUNCH-GAPS.md)
- [`docs/calculadora/BROWSER-QA-CHECKLIST.md`](../calculadora/BROWSER-QA-CHECKLIST.md)
- [`docs/team/panelsim/CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md`](../team/panelsim/CRM-COCKPIT-AUTONOMOUS-RUNBOOK.md)
- [`docs/team/panelsim/CRM-OPERATIVO-COCKPIT.md`](../team/panelsim/CRM-OPERATIVO-COCKPIT.md)
