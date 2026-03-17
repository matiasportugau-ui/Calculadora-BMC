# Puertos 3849 vs 3001 — Cuándo usar cada uno

**Última actualización:** 2025-03-15

---

## Resumen

| Puerto | Servidor | Uso recomendado |
|-------|----------|------------------|
| **3001** | `server/index.js` (app principal) | **Canónico** — API + Dashboard integrado + ML + Shopify + Calc |
| **3849** | `sheets-api-server.js` (standalone) | Alternativa solo Sheets — útil para pruebas aisladas |

---

## Puerto 3001 (canónico)

- **Comando:** `npm run dev:full` o `npm run start:api`
- **Archivo:** `server/index.js`
- **URL dashboard:** http://localhost:3001/finanzas
- **API:** `/api/*` (cotizaciones, proximas-entregas, kpi-financiero, audit, marcar-entregado, coordinacion-logistica)
- **Health:** GET http://localhost:3001/health → `{ ok, hasSheets, hasTokens, ... }`
- **Incluye:** Mercado Libre OAuth, Shopify, rutas legacy, Calculadora (Vite en 5173)

**Usar cuando:** Desarrollo normal, integración completa, deploy producción.

---

## Puerto 3849 (standalone)

- **Comando:** `npm run bmc-dashboard` o `node docs/bmc-dashboard-modernization/sheets-api-server.js`
- **Archivo:** `docs/bmc-dashboard-modernization/sheets-api-server.js`
- **URL dashboard:** http://localhost:3849/
- **API:** `/api/*` (mismo contrato que 3001 para endpoints de Sheets)
- **Variable:** `BMC_SHEETS_API_PORT` (default 3849)

**Usar cuando:** Probar solo el módulo Sheets sin levantar ML/Shopify/Calc; debugging aislado.

---

## Diferencias prácticas

| Aspecto | 3001 | 3849 |
|---------|------|------|
| ML OAuth | Sí | No |
| Shopify | Sí | No |
| Rutas legacy | Sí | No |
| Dashboard Finanzas | /finanzas | / |
| Origen datos | Mismo Sheets | Mismo Sheets |

---

## Setup recomendado

Para el equipo y agentes:

1. **Desarrollo diario:** `npm run dev:full` → API en 3001, Vite en 5173.
2. **Dashboard directo:** http://localhost:3001/finanzas
3. **Solo Sheets (opcional):** `npm run bmc-dashboard` → http://localhost:3849

---

**Referencias:** [README.md](./README.md), [LIVE-EDITING.md](./LIVE-EDITING.md), [docs/team/PROJECT-STATE.md](../team/PROJECT-STATE.md).
