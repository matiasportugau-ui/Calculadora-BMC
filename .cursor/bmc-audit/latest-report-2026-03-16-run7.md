# Audit Report — Run 7 (2026-03-16)

**Generado:** 2026-03-16
**Tipo:** Full team run audit + E2E validation checklist
**Auditor:** Audit/Debug (bmc-dashboard-audit-runner)

---

## 1. Hallazgos de logs previos

| Log | Hallazgo | Severidad | Acción |
|-----|----------|-----------|--------|
| console-2026-03-14 (3011) | 503 /api/kpi-financiero | Info | Servidor no activo en ese momento; OK |
| console-2026-03-14 (3861) | 404 /favicon.ico | Baja | Irrelevante; favicon no crítico |
| codebuddy-2026-03-11 | Memory 1935–1939MB (IDE agent) | Baja | Logs del IDE, no del servidor BMC |

**Síntesis:** Sin hallazgos críticos en logs actuales. El 503 en kpi-financiero fue transitorio (servidor apagado). El IDE (codebuddy) tenía alto consumo de memoria pero no afecta al servidor BMC.

---

## 2. npm audit (vigente desde 2026-03-16)

| Vulnerabilidad | Paquete | Severidad | Fix |
|----------------|---------|-----------|-----|
| GHSA-xxx | teeny-request (via @google-cloud) | Low (5) | `npm audit fix` |
| GHSA-xxx | esbuild/vite@6 | Moderate (2) | `npm audit fix --force` (vite@8 — breaking) |

**Acción recomendada:**
1. Ejecutar `npm audit fix` (no-force) — resuelve 5 low.
2. Evaluar con Matias: `npm audit fix --force` para moderate (vite@8 — possible breaking changes en Calculadora React).

---

## 3. E2E Validation Checklist

### 3.1 Stack local

| Check | Comando | Expected | Verificado |
|-------|---------|----------|-----------|
| API arranca | `npm run start:api` | Puerto 3001 | Pendiente Matias |
| Health | `curl http://localhost:3001/health` | `{"ok":true,"hasSheets":true/false}` | Pendiente |
| Calculadora | `npm run dev` | Puerto 5173 | Pendiente |
| Dashboard | http://localhost:3001/finanzas | Renderiza UI | Pendiente |

### 3.2 Endpoints críticos

| Endpoint | Método | Expected | Estado |
|----------|--------|----------|--------|
| /health | GET | ok:true | Pendiente runtime |
| /api/cotizaciones | GET | Array cotizaciones | Pendiente runtime |
| /api/kpi-financiero | GET | byCurrency, calendar, pendingPayments | Pendiente runtime |
| /api/kpi-report | GET | totalPendiente, estaSemana, bajoStock, equilibrio | Pendiente restart — ruta existe |
| /api/proximas-entregas | GET | Array entregas | Pendiente runtime |
| /api/ventas | GET | Array ventas (23 tabs) | Pendiente runtime |
| /api/stock-ecommerce | GET | Array stock | Pendiente runtime |
| /api/stock-kpi | GET | bajoStock, totalProductos, valorInventario | Pendiente runtime |
| /api/calendario-vencimientos?month=2026-03 | GET | Array vencimientos MARZO 2026 | Pendiente runtime |

### 3.3 Verificaciones manuales Sheets

| Check | Acción | Estado |
|-------|--------|--------|
| Workbook compartido con service account | Matias verifica permissions | Pendiente |
| Tab CONTACTOS existe | Matias crea | Pendiente |
| Tab Ventas_Consolidado existe | Matias crea | Pendiente |
| Columna SHOPIFY_SYNC_AT en Stock | Matias añade | Pendiente |
| Columna PAGADO en Calendario | Matias añade | Pendiente |
| Apps Script triggers activos | Matias configura | Pendiente |

### 3.4 Datos E2E

| Check | Criterio | Estado |
|-------|----------|--------|
| KPI Report visible en #inicio | 4 cards + equilibrio | Pendiente runtime |
| Marcar entregado | POST /api/marcar-entregado exitoso | Pendiente runtime |
| Stock bajo stock | Filtro <5 unidades | Pendiente runtime |
| Billing cierre mensual 2026-03 | Sin duplicados | Pendiente Billing |

---

## 4. Recomendaciones

1. **Inmediato:** Reiniciar servidor → verificar /api/kpi-report → 200 o 503 (no 404).
2. **Esta semana:** Crear 4 tabs/columnas manuales (Matias).
3. **Esta semana:** Configurar 6 triggers Apps Script (Matias).
4. **Antes de deploy:** npm audit fix (no-force); CORS restriction.
5. **Post-deploy:** E2E completo con datos reales.

---

*Handoff: Orchestrator, Reporter, Networks.*
