# Criterios de skip — Pasos del Full Team Run

**Propósito:** Documentar cuándo omitir cada paso del run. Evita ejecutar pasos innecesarios o saltar los que sí aplican.

**Fuente:** bmc-dashboard-team-orchestrator, INVOQUE-FULL-TEAM.

---

## Pasos condicionales

| Paso | Rol | Skip cuando | Ejecutar cuando |
|------|-----|-------------|------------------|
| **2b** | Sheets Structure | No hay cambios estructurales en sheets (tabs, dropdowns, columnas) | Matias añade tab, columna o validación |
| **4b** | Integrations | No hay cambios en Shopify, ML, OAuth, webhooks | Cambios en integraciones |
| **5c** | GPT/Cloud | No hay cambios en OpenAPI, GPT Builder, Cloud Run | Cambios en prompts, actions, OpenAPI |
| **5e** | Billing | No hay cambios en facturación, cierre mensual | Cambios en Pagos, facturación |
| **5g** | Calc | No hay cambios en Calculadora, 5173, BOM, PDF | Cambios en cotizador |

---

## Criterios por paso

### 2b — Sheets Structure
- **Skip:** planilla-inventory vigente; no se crearon tabs nuevas; no hay dropdowns por configurar
- **Ejecutar:** CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO pendientes; nueva validación

### 4b — Integrations
- **Skip:** Shopify/ML sin cambios; OAuth estable
- **Ejecutar:** Nuevo webhook; cambio redirect URI; nueva integración

### 5c — GPT/Cloud
- **Skip:** OpenAPI sin cambios; GPT Builder sin modificar
- **Ejecutar:** Nueva action; cambio operationId; drift detectado

### 5e — Billing
- **Skip:** Sin cierre mensual pendiente; sin cambios en formato facturación
- **Ejecutar:** Cierre 2026-03; nuevo formato export; reglas de negocio cambiaron

### 5g — Calc
- **Skip:** 5173 estable; sin cambios en BOM, precios, PDF
- **Ejecutar:** Nueva fórmula; cambio en flujo Cotizaciones → Sheets

---

## Regla general

Cuando hay duda: **ejecutar el paso**. Es preferible un paso redundante a omitir uno necesario.

---

## Referencias

- INVOQUE-FULL-TEAM.md — flujo completo
- bmc-dashboard-team-orchestrator — orden de pasos
