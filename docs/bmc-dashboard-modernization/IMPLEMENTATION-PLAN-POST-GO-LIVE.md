# Implementation Plan — Post Go-Live
## (Solution & Coding — Features & Hardening)

**Fecha:** 2026-03-16
**Objetivo:** Features y hardening post go-live. Dashboard ya operativo localmente; próximas fases: deploy productivo, guía vendedores, E2E, automations, seguridad deps.

---

## Contexto del estado actual

- Dashboard en 3001 operativo con Phase 1 GET + Phase 2 PUSH implementados.
- KPI Report en #inicio implementado.
- Notifications bell implementado.
- 4 tabs manuales pendientes en Sheets (bloquean Apps Script automations).
- Deploy productivo (Cloud Run / VPS Netuy) aún no ejecutado.
- npm audit: 7 vulns (5 low, 2 moderate).
- Repo Sync: repos externos no configurados.

---

## Fase A — Hardening local (sin deploy)

### A1 — Tabs manuales en Sheets (BLOQUEANTE para automations)

**Owner:** Matias (manual)
**Urgencia:** Alta — bloquea Apps Script

| Tab | Workbook | Columnas requeridas | Script afectado |
|-----|----------|---------------------|-----------------|
| CONTACTOS | Pagos Pendientes 2026 | NOMBRE \| EMAIL | PagosPendientes.gs `alertarPagosVencidos` |
| Ventas_Consolidado | 2.0 - Ventas | COTIZACION_ID \| PROVEEDOR \| CLIENTE_NOMBRE \| FECHA_ENTREGA \| COSTO \| GANANCIA \| SALDO_CLIENTE \| PAGO_PROVEEDOR \| FACTURADO \| NUM_FACTURA \| FECHA_INGRESO | VentasConsolidar.gs |
| SHOPIFY_SYNC_AT (columna) | Stock E-Commerce | columna nueva al final | StockAlertas.gs |
| PAGADO (columna) | Calendario vencimientos | columna nueva al final | CalendarioRecordatorio.gs |

**Aceptación:** Apps Script puede ejecutarse sin errores de "tab not found".

---

### A2 — Triggers Apps Script

**Owner:** Matias (manual) — después de A1
**Urgencia:** Alta — automations no activas sin triggers

| Trigger | Función | Workbook | Schedule |
|---------|---------|----------|----------|
| Time-driven daily 8:00 AM | `alertarPagosVencidos` | Pagos Pendientes 2026 | Diario |
| On edit | `onEdit` | Pagos Pendientes 2026 | Al editar |
| Time-driven daily 7:00 AM | `consolidarVentasDiario` | 2.0 - Ventas | Diario |
| Time-driven weekly Mon 9:00 AM | `alertarVentasSinFacturar` | 2.0 - Ventas | Semanal |
| Time-driven daily 8:30 AM | `alertarBajoStock` | Stock E-Commerce | Diario |
| Time-driven weekly Mon 9:00 AM | `sendWeeklyAlarmDigest` | BMC crm_automatizado | Semanal |

**Ver guía completa:** `docs/google-sheets-module/AUTOMATIONS-BY-WORKBOOK.md`

---

### A3 — Verificar kpi-report en runtime

**Owner:** Coding
**Urgencia:** Alta

1. Reiniciar servidor: `npm run start:api`
2. Ejecutar: `curl http://localhost:3001/api/kpi-report`
3. Verificar respuesta 200 (o 503 si Sheets no configurado — no 404).
4. Si 404: verificar que `router.get('/kpi-report', ...)` está en `server/routes/bmcDashboard.js` y que el router se importa en `server/index.js`.
5. Actualizar `service-map.md` con status "✓ OK" en ruta kpi-report.

---

### A4 — npm audit fix (esbuild/vite)

**Owner:** Coding + Matias (decisión breaking change)
**Urgencia:** Media

- `npm audit fix` resuelve 5 low (teeny-request).
- `npm audit fix --force` resuelve 2 moderate (esbuild/vite → vite@8). Esto es breaking change.
- **Recomendación:** Ejecutar `npm audit fix` primero; evaluar con Matias el upgrade a vite@8 en branch separado.

---

## Fase B — Deploy a producción

### B1 — Deploy a Cloud Run

**Owner:** Networks + Coding + Matias
**Urgencia:** Media (post hardening local)

| Task | Descripción |
|------|-------------|
| B1.1 | Preparar Dockerfile para servidor Express (puerto 3001) |
| B1.2 | Variables de entorno en Cloud Run secrets (BMC_SHEET_ID, GOOGLE_APPLICATION_CREDENTIALS, etc.) |
| B1.3 | Actualizar GOOGLE_REDIRECT_URI a la URL de Cloud Run |
| B1.4 | Buildear y hacer push a Artifact Registry: `gcloud builds submit` |
| B1.5 | Deploy: `gcloud run deploy panelin-dashboard` |
| B1.6 | Verificar /health en URL Cloud Run |
| B1.7 | Actualizar DASHBOARD-INTERFACE-MAP con URL producción |

**Referencias:** `docs/bmc-dashboard-modernization/HOSTING-EN-MI-SERVIDOR.md`

### B2 — Alternativa: VPS Netuy

**Owner:** Networks + Matias
**Urgencia:** Media

| Task | Descripción |
|------|-------------|
| B2.1 | SSH a VPS Netuy; clonar repo |
| B2.2 | npm install; configurar .env en servidor |
| B2.3 | PM2: `pm2 start npm --name bmc-dashboard -- run start:api` |
| B2.4 | Nginx reverse proxy (puerto 80/443 → 3001) |
| B2.5 | SSL con Certbot |
| B2.6 | Smoke test: /health, /api/kpi-financiero |

---

## Fase C — Guía usuarios vendedores

### C1 — Guía rápida para vendedores

**Owner:** Reporter + Matias
**Urgencia:** Media — post-deploy

| Contenido | Descripción |
|-----------|-------------|
| Acceso | URL + credenciales de acceso |
| Sección Inicio | Cómo leer KPI Report (#inicio) |
| Sección Operaciones | Cómo ver cotizaciones, marcar entregado |
| Sección Finanzas | Pagos pendientes, metas |
| Sección Ventas | Filtrar por proveedor, exportar CSV |
| FAQs | Qué hacer si la tabla muestra "sin datos" |

**Output:** `docs/GUIA-RAPIDA-VENDEDORES.md` (nueva guía orientada a usuarios finales)

---

## Fase D — E2E Validation

### D1 — Checklist E2E completo

**Owner:** Audit/Debug + Matias
**Urgencia:** Antes de presentar a usuarios finales

| Check | Descripción |
|-------|-------------|
| D1.1 | Compartir workbook principal con service account |
| D1.2 | Verificar /api/cotizaciones con datos reales |
| D1.3 | Verificar /api/kpi-financiero retorna monedas reales |
| D1.4 | Verificar /api/kpi-report 200 |
| D1.5 | Marcar entregado en UI → verificar en Sheet |
| D1.6 | Notificaciones bell → verificar datos |
| D1.7 | Calculadora 5173 → generar PDF → verificar Drive |
| D1.8 | Shopify webhook test |

---

## Repo Sync

### E1 — Configurar Repo Sync

**Owner:** Matias
**Urgencia:** Baja (mejora de flujo)

1. Añadir en `.env`:
   ```
   BMC_DASHBOARD_2_REPO=/path/to/bmc-dashboard-2.0
   BMC_DEVELOPMENT_TEAM_REPO=/path/to/bmc-development-team
   ```
2. Ver `docs/team/REPO-SYNC-SETUP.md` para crear repos si no existen.
3. En próximo full team run, paso 7 (Repo Sync) ejecutará automáticamente.

---

## Handoff table

| Artefacto | Destino | Urgencia |
|-----------|---------|----------|
| A1 tabs + A2 triggers (Matias) | Sheets → Apps Script automation | Alta |
| A3 kpi-report restart | Coding → verificar | Alta |
| A4 npm audit fix | Coding → evaluar vite@8 con Matias | Media |
| B1 Cloud Run deploy | Networks + Matias | Media |
| C1 Guía vendedores | Reporter | Media |
| D1 E2E checklist | Audit/Debug + Matias | Antes de go-live público |
| E1 Repo Sync | Matias | Baja |

---

**Última actualización:** 2026-03-16
**Handoff:** Solution aprueba fases → Coding implementa A3, A4 → Matias ejecuta A1, A2, B, E.
