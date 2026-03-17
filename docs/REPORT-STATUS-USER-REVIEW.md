# BMC Dashboard — Full Status Report & User Review Link

**Fecha:** 2026-03-16  
**Origen:** Full Team status + shareable link for user review  
**Última actualización:** Full team run 2026-03-16 (Audit, Contract, Judge, GO-LIVE checklist)

---

## Shareable link (revisar como usuario)

| URL | Descripción |
|-----|-------------|
| **https://freewill-kaleidoscopically-jacalyn.ngrok-free.dev/finanzas** | Dashboard BMC Finanzas & Operaciones (completo) |
| **https://freewill-kaleidoscopically-jacalyn.ngrok-free.dev/** | Redirige a /finanzas |
| **https://freewill-kaleidoscopically-jacalyn.ngrok-free.dev/health** | Estado de la API (JSON) |

**Nota:** La URL de ngrok es temporal. Si reiniciás ngrok, se genera una nueva URL. Para mantener el dashboard accesible, ejecutá:

```bash
ngrok http 3001
```

---

## Estado actual del stack

| Servicio | Puerto | Estado | URL local |
|----------|--------|--------|-----------|
| **API** | 3001 | ✅ Running | http://localhost:3001 |
| **Vite (Calculadora)** | 5173 | ✅ Running | http://localhost:5173 |
| **ngrok** | 4040 (inspector) | ✅ Running | https://freewill-kaleidoscopically-jacalyn.ngrok-free.dev |

**Health check:** `GET /health` → `ok: true`, `hasSheets: true`, `missingConfig: []`

---

## Componentes operativos

| Componente | Estado | Notas |
|------------|--------|-------|
| **Dashboard Finanzas/Operaciones** | ✅ OK | KPIs, Trend, Breakdown, Entregas, Metas, Audit |
| **UX Opción A (C1–C5)** | ✅ Implementado | Loading skeleton, filtros Esta semana/Vencidos, sticky headers, toast |
| **API /api/\*** | ✅ OK | kpi-financiero, proximas-entregas, audit, marcar-entregado, coordinacion-logistica |
| **Planillas mapeadas** | ✅ OK | CRM_Operativo, Pagos_Pendientes, Metas_Ventas, AUDIT_LOG |
| **Calculadora** | ✅ OK | Puerto 5173, link desde shell del dashboard |
| **Integraciones** | Parcial | Sheets, Drive, ML OAuth, Shopify |

---

## Secciones del dashboard (revisar)

1. **Resumen financiero** — KPIs por moneda (Total, Esta semana, Próxima semana, Este mes)
2. **Trend** — Vencimientos próximos (gráfico de barras)
3. **Breakdown** — Pagos pendientes con filtros "Esta semana" | "Vencidos" | "Todos"
4. **Calendario de vencimientos** — Datos de la hoja
5. **Entregas y logística** — Próximas entregas, WhatsApp, Marcar entregado
6. **Metas de ventas** — Objetivos por período
7. **Audit log** — Registro de cambios, export CSV
8. **Ventas 2.0** — Placeholder
9. **Invoque Panelin** — Placeholder

---

## Pendientes (no bloquean revisión)

| Componente | Estado |
|------------|--------|
| Ventas 2.0 | Placeholder |
| Invoque Panelin | Placeholder |
| Judge report | Sin runs |

---

## Comandos útiles

```bash
# Reiniciar stack (si hace falta)
npm run dev:full

# Exponer con ngrok (en otra terminal)
ngrok http 3001

# Ver inspector de tráfico ngrok
open http://127.0.0.1:4040
```

---

---

## Documentos creados (Full team run 2026-03-16)

| Documento | Propósito |
|-----------|-----------|
| [GO-LIVE-DASHBOARD-CHECKLIST.md](bmc-dashboard-modernization/GO-LIVE-DASHBOARD-CHECKLIST.md) | Checklist operativo para vendedores/admin |
| [GUIA-RAPIDA-DASHBOARD-BMC.md](GUIA-RAPIDA-DASHBOARD-BMC.md) | Guía rápida para vendedores y administradivos |
| [JUDGE-REPORT-RUN-2026-03-16.md](team/judge/JUDGE-REPORT-RUN-2026-03-16.md) | Reporte del Juez (primer run) |
| [DEBUG-REPORT.md](../.cursor/bmc-audit/DEBUG-REPORT.md) | Debug Reviewer (post Audit) |

---

**Referencias:** [PROJECT-STATE.md](team/PROJECT-STATE.md), [FULL-PROJECT-STATUS-AND-TASK-PLAN.md](team/FULL-PROJECT-STATUS-AND-TASK-PLAN.md), [SHARE-LOCALHOST-DASHBOARD.md](SHARE-LOCALHOST-DASHBOARD.md)
