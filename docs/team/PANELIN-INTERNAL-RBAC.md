# Panelin interno — RBAC y rutas `/api/internal/panelin`

**Estado:** Fase 0 (políticas puras + discovery HTTP). El dashboard `/finanzas` sigue llamando a `/api/*` **sin** Bearer; el enforcement global en `bmcDashboard.js` es **futuro** (activar con cuidado para no romper la SPA).

## Roles

| Rol | Uso típico |
|-----|------------|
| `ventas` | Cotizaciones, stock, ventas (lectura amplia comercial) |
| `logistica` | Entregas, coordinación, marcar entregado |
| `admin` | Pagos, KPI financiero, audit, email interno, push MATRIZ no |
| `director` | Todo; incluye `POST /api/matriz/push-pricing-overrides` |

Jerarquía numérica (implementación): `ventas` < `logistica` < `admin` < `director`.

## Autenticación servicio → API interna

- Mismo secreto que cockpit: **`Authorization: Bearer <API_AUTH_TOKEN>`** o **`X-Api-Key`** (ver `server/lib/panelinInternalRbac.js` → `extractApiToken`).
- Rol efectivo: header **`X-Panelin-Role: ventas|logistica|admin|director`**. Si falta: env **`PANELIN_SERVICE_DEFAULT_ROLE`** o default **`director`**.

## Endpoints discovery

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/internal/panelin/whoami` | Rol + muestra de acceso a rutas dashboard |
| GET | `/api/internal/panelin/tools` | Catálogo HTTP mínimo para orquestador |
| GET | `/api/internal/panelin/policies` | Lista `method + path → min_role` |
| POST | `/api/internal/panelin/invoke` | Ejecuta un **tool_id** del catálogo (`GET /tools`); body JSON: `{ tool_id, body?, query? }`; proxy HTTP a `127.0.0.1:PORT` (mismo proceso) |

## Código

- Políticas dashboard: `server/lib/panelinInternalRbac.js` (`DASHBOARD_POLICIES`).
- Router: `server/routes/panelinInternal.js`.
- Invocación: `server/lib/panelinInternalInvoke.js` (`mayInvokeTool`, `getInternalToolById`).
- Catálogo tools: `server/lib/panelinInternalToolCatalog.js`.
- Tests: `tests/validation.js` — suite `panelinInternalRbac`.

## Siguientes pasos (Fase 1–2)

- Tool-calling desde chat interno o UI hacia estos contratos.
- Cola de aprobación + políticas horarias (`runbook`).
