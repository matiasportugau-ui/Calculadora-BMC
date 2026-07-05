# BMC Dashboard — Go-Live Checklist

**Propósito:** Lista de verificación para dejar el dashboard operativo para vendedores y administradivos de BMC.

**Última actualización:** 2026-07-04 (**6.0 CERRADO**: `npm run smoke:prod` = 9/9 verde incluyendo `POST /api/crm/suggest-response` 200 — `ASSISTANTS_ACTIVE=canales;ml` renderizada por el deploy workflow tras PRs #560/#561. `npm run verify-tabs` también verde con credencial real de Doppler + schema `CRM_Operativo`: los 5 workbooks accesibles.)

---

## 1. Credenciales y configuración

| # | Requisito | Estado | Notas |
|---|-----------|--------|-------|
| 1.1 | `.env` con `BMC_SHEET_ID` | ☑ | Verificado run_dashboard_setup.sh 2026-03-16 |
| 1.2 | `.env` con `GOOGLE_APPLICATION_CREDENTIALS` | ☑ | Verificado run_dashboard_setup.sh |
| 1.3 | `service-account.json` en `docs/bmc-dashboard-modernization/` | ☑ | Service account JSON valid |
| 1.4 | Workbook compartido con email de la service account (Editor) | ☑ verificado 2026-07-04 | Probado indirectamente con `npm run verify-tabs` verde: la SA `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` accede a los 5 workbooks (principal + pagos + ventas + stock + calendario) |

---

## 2. Planillas (tabs en el workbook)

| # | Tab | Estado | API que consume |
|---|-----|--------|-----------------|
| 2.1 | CRM_Operativo | ☐ verificar | cotizaciones, proximas-entregas, coordinacion-logistica · creado vía `npm run setup-sheets-tabs` (2026-03-19); confirmar con `npm run verify-tabs` post-1.4 — ver [`runbook §2.x`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-2x--tabs-probable--ya-ejecutar-verify-tabs-despu%C3%A9s-de-14) |
| 2.2 | Pagos_Pendientes | ☐ verificar | kpi-financiero · ídem 2.1 |
| 2.3 | Metas_Ventas | ☐ verificar | kpi-financiero (metas) · ídem 2.1 |
| 2.4 | AUDIT_LOG | ☐ verificar | audit · ídem 2.1 |

---

## 3. Apps Script (Marcar entregado)

| # | Requisito | Estado |
|---|-----------|--------|
| 3.1 | Code.gs en proyecto Apps Script del workbook | ☐ pendiente acción Matías — [`runbook §3.1`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-31--pegar-codegs-en-el-apps-script-del-workbook-crm_automatizado) |
| 3.2 | DialogEntregas.html | ☐ pendiente acción Matías — [`runbook §3.2`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-32--pegar-dialogentregashtml) |
| 3.3 | runInitialSetup ejecutado | ☐ pendiente acción Matías — [`runbook §3.3`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-33--ejecutar-runinitialsetup) |
| 3.4 | Triggers configurados (onEdit, etc.) | ☐ pendiente acción Matías — [`runbook §3.4`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-34--configurar-triggers) |

---

## 4. Stack local (desarrollo)

| # | Requisito | Comando | Estado |
|---|-----------|---------|--------|
| 4.1 | API en 3001 | `npm run start:api` | ☑ Verificado 2026-03-16 |
| 4.2 | Vite/Calculadora en 5173 | `npm run dev` | ☑ ejercitado en runs autónomas top-10/20/30 (2026-05-11/12, commits `a94d7bc`–`0e45956`); `npm run dev:full` arranca API :3001 + Vite :5173 vía concurrently |
| 4.3 | Dashboard en /finanzas | <http://localhost:3001/finanzas> | ☑ |
| 4.4 | GET /health → ok, hasSheets | `curl http://localhost:3001/health` | ☑ hasSheets: true |

---

## 5. Deploy estable (producción)

| # | Opción | Estado |
|---|--------|--------|
| 5.1 | Cloud Run (panelin-calc) | ☑ live · revisión `panelin-calc-00371-j97` (2026-05-13 unblock); URL canónica `https://panelin-calc-q74zutv7dq-uc.a.run.app`. Frontend SPA + `/finanzas` se sirven desde Vercel (`calculadora-bmc.vercel.app`); Cloud Run hospeda sólo la API. Ver PROJECT-STATE 2026-05-13. |
| 5.2 | VPS Netuy | ☐ skipped — Cloud Run elegido como superficie productiva |
| 5.3 | ngrok (temporal) | ☐ n/a — Cloud Run es la URL pública estable |

---

## 6. Verificación end-to-end

| # | Prueba | Estado |
|---|--------|--------|
| 6.0 | **API prod** (`panelin-calc`): `npm run smoke:prod` — `/health`, `/capabilities`, `public_base_url`, `GET /api/actualizar-precios-calculadora` (CSV MATRIZ), `/auth/ml/status`, `GET /webhooks/whatsapp`, `GET /api/wa/health`, `POST /api/crm/suggest-response` | ☑ **2026-07-04 — 9/9 VERDE** (tres corridas consecutivas, la última contra la revisión `panelin-calc-00693` renderizada por el propio workflow de deploy, sin puentes manuales). `POST /api/crm/suggest-response` responde **200 (IA ok, gemini)**: la repo Variable quedó **`ASSISTANTS_ACTIVE=canales;ml`** (separador `;` porque el action deploy-cloudrun parte `env_vars` por comas — fix del parser en `server/config.js`, PR #561) y el wiring del deploy (PR #560) la propaga a Cloud Run. |
| 6.1 | KPIs cargan con datos reales | ☐ pendiente UAT Matías — [`runbook §6.1`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-61--kpis-cargan-con-datos-reales) |
| 6.2 | Trend muestra vencimientos | ☐ pendiente UAT — [`runbook §6.2`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-62--trend-muestra-vencimientos) |
| 6.3 | Breakdown con filtros Esta semana/Vencidos | ☐ pendiente UAT — [`runbook §6.3`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-63--breakdown-con-filtros) |
| 6.4 | Entregas listadas | ☐ pendiente UAT — [`runbook §6.4`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-64--entregas-listadas) |
| 6.5 | Copiar WhatsApp funciona | ☐ pendiente UAT — [`runbook §6.5`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-65--copiar-whatsapp-funciona) |
| 6.6 | Marcar entregado actualiza sheet | ☐ pendiente UAT — [`runbook §6.6`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-66--marcar-entregado-actualiza-sheet) |
| 6.7 | Toast visible tras acciones | ☐ pendiente UAT — [`runbook §6.7`](./GO-LIVE-MANUAL-RUNBOOK-2026-05-13.md#secci%C3%B3n-67--toast-visible-tras-acciones) |

---

## 7. Documentación para usuarios

| # | Documento | Estado |
|---|-----------|--------|
| 7.1 | Guía rápida vendedores | ☑ docs/GUIA-RAPIDA-DASHBOARD-BMC.md |
| 7.2 | Guía administradivos | ☑ extendida en [`docs/GUIA-RAPIDA-DASHBOARD-BMC.md`](../GUIA-RAPIDA-DASHBOARD-BMC.md) con sección "Para administradivos" (AUDIT_LOG, KPI Report, escalación entregas, triggers Apps Script, troubleshooting) — 2026-05-13 |

---

## Comandos útiles

```bash
# Automatización go-live (todo lo que se puede)
npm run go-live
# o con API y ngrok:
./scripts/go-live-automation.sh --start-api --ngrok

# Setup completo
./run_dashboard_setup.sh

# Solo verificar (sin iniciar)
./run_dashboard_setup.sh --check-only

# Verificar tabs en Sheets (requiere workbook compartido)
npm run verify-tabs

# Obtener email de service account (para Atlas Browser)
node scripts/get-service-account-email.js

# Validar contratos API
BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js

# Auditoría completa
bash .cursor/skills/super-agente-bmc-dashboard/scripts/run_audit.sh --output=.cursor/bmc-audit/latest-report.md
```

## Pasos manuales (Atlas Browser)

Para los pasos que requieren navegador (compartir workbook, Apps Script), usar el prompt:
**docs/ATLAS-BROWSER-PROMPT-GO-LIVE.md** — ejecutar en OpenAI Atlas Browser (agent mode).

---

**Referencias:** [HOSTING-EN-MI-SERVIDOR.md](./HOSTING-EN-MI-SERVIDOR.md), [run_dashboard_setup.sh](../../run_dashboard_setup.sh), [PROJECT-STATE.md](../team/PROJECT-STATE.md)
