# LIVE-DEVTOOLS-NARRATIVE-REPORT — Shopify catalog API review

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Usuario (Matias) + agente Cursor |

## 2. Objetivo de la sesión

- **Goal (una frase):** Definir cómo vincular Shopify con la app para extraer catálogo completo por API de forma reutilizable por etapas.
- **Criterios de éxito del usuario:** Validar estado real en app/deploy y dejar endpoints concretos para consumir productos completos desde backend.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 1 | Pide revisar vinculación Shopify ↔ app | Tener integración completa y consumible por API |
| U-02 | Paso 2 | Pide extraer toda info de productos disponibles | Poder usar datos por partes/módulos sin perder detalle |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras abrir prod | `take_snapshot` | Home carga correctamente; se ve visor con assets CDN Shopify y link a tienda |
| E-02 | Tras cargar `/` | `list_console_messages` (error/warn) | Sin errores ni warnings en consola para el flujo base |
| E-03 | Tras cargar `/` | `list_network_requests` | Requests app `200/304`; imagen Shopify CDN `200`; sin `4xx/5xx` |
| E-04 | Revisión repo | `server/routes/shopify.js` + `server/config.js` | Había OAuth/webhooks/admin, pero no endpoint de catálogo completo de productos |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-04 | parcial | Integración Shopify existe, pero orientada a preguntas/webhooks, no catálogo |
| U-02 | E-04 | no | Faltaban endpoints API para extracción completa de productos/variantes |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-04-01 | P1 | Falta de API catálogo Shopify | El backend no ofrecía `GET` paginado/full para productos Shopify, bloqueando consumo modular desde app | `server/routes/shopify.js` |
| LDN-2026-04-04-02 | P2 | Validación runtime prod OK | La app prod no presenta errores de consola/red en home; el gap era de backend API, no de rendering inicial | deploy + `server/` |

## 7. Recomendaciones y siguientes pasos

1. Usar `GET /api/shopify/products` para sync incremental (`cursor`) en UI/servicios internos.
2. Usar `GET /api/shopify/catalog/full` para bootstrap/reindexación completa (con `maxPages` controlado).
3. Guardar snapshot del catálogo en una tabla/cache interna para consultas rápidas de UI.
4. Si se requiere precio final de storefront por mercado, sumar endpoint complementario de publicaciones/precios por canal.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada
- [x] Consola limpia de errores P0 / o documentado
- [x] Red: sin 4xx/5xx inesperados en flujo principal
- [x] Criterios de éxito del usuario (§2) cubiertos o ticket abierto

## 9. Anexos (opcional)

- Endpoint implementado: `server/routes/shopify.js`
- Estado actualizado: `docs/team/PROJECT-STATE.md`
