# BMC Dashboard — Go-Live Checklist

**Propósito:** Lista de verificación para dejar el dashboard operativo para vendedores y administradivos de BMC.

**Última actualización:** 2026-03-16

---

## 1. Credenciales y configuración

| # | Requisito | Estado | Notas |
|---|-----------|--------|-------|
| 1.1 | `.env` con `BMC_SHEET_ID` | ☑ | Verificado run_dashboard_setup.sh 2026-03-16 |
| 1.2 | `.env` con `GOOGLE_APPLICATION_CREDENTIALS` | ☑ | Verificado run_dashboard_setup.sh |
| 1.3 | `service-account.json` en `docs/bmc-dashboard-modernization/` | ☑ | Service account JSON valid |
| 1.4 | Workbook compartido con email de la service account (Editor) | ☐ | Manual en Google Sheets |

---

## 2. Planillas (tabs en el workbook)

| # | Tab | Estado | API que consume |
|---|-----|--------|-----------------|
| 2.1 | CRM_Operativo | ☐ | cotizaciones, proximas-entregas, coordinacion-logistica |
| 2.2 | Pagos_Pendientes | ☐ | kpi-financiero |
| 2.3 | Metas_Ventas | ☐ | kpi-financiero (metas) |
| 2.4 | AUDIT_LOG | ☐ | audit |

---

## 3. Apps Script (Marcar entregado)

| # | Requisito | Estado |
|---|-----------|--------|
| 3.1 | Code.gs en proyecto Apps Script del workbook | ☐ |
| 3.2 | DialogEntregas.html | ☐ |
| 3.3 | runInitialSetup ejecutado | ☐ |
| 3.4 | Triggers configurados (onEdit, etc.) | ☐ |

---

## 4. Stack local (desarrollo)

| # | Requisito | Comando | Estado |
|---|-----------|---------|--------|
| 4.1 | API en 3001 | `npm run start:api` | ☑ Verificado 2026-03-16 |
| 4.2 | Vite/Calculadora en 5173 | `npm run dev` | ☐ |
| 4.3 | Dashboard en /finanzas | <http://localhost:3001/finanzas> | ☑ |
| 4.4 | GET /health → ok, hasSheets | `curl http://localhost:3001/health` | ☑ hasSheets: true |

---

## 5. Deploy estable (producción)

| # | Opción | Estado |
|---|--------|--------|
| 5.1 | Cloud Run (panelin-calc) | ☐ |
| 5.2 | VPS Netuy | ☐ Ver HOSTING-EN-MI-SERVIDOR.md |
| 5.3 | ngrok (temporal) | ☐ `ngrok http 3001` |

---

## 6. Verificación end-to-end

| # | Prueba | Estado |
|---|--------|--------|
| 6.1 | KPIs cargan con datos reales | ☐ |
| 6.2 | Trend muestra vencimientos | ☐ |
| 6.3 | Breakdown con filtros Esta semana/Vencidos | ☐ |
| 6.4 | Entregas listadas | ☐ |
| 6.5 | Copiar WhatsApp funciona | ☐ |
| 6.6 | Marcar entregado actualiza sheet | ☐ |
| 6.7 | Toast visible tras acciones | ☐ |

---

## 7. Documentación para usuarios

| # | Documento | Estado |
|---|-----------|--------|
| 7.1 | Guía rápida vendedores | ☑ docs/GUIA-RAPIDA-DASHBOARD-BMC.md |
| 7.2 | Guía administradivos | ☐ Por crear (o extender 7.1) |

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
