# AGENTS.md — Calculadora BMC / Panelin Dashboard

Instrucciones para agentes de IA (Codex, Claude Code, Cursor) que trabajen en este repositorio.
Lee este archivo antes de cualquier tarea.

---

## Comandos disponibles

| Comando | Cuándo usarlo |
|---------|---------------|
| `npm run lint` | Después de editar cualquier archivo en `src/` |
| `npm test` | Después de cambios en lógica de negocio o helpers |
| `npm run test:contracts` | Requiere servidor corriendo (`npm run start:api`); valida contrato API |
| `npm run build` | Antes de hacer commit de cambios en `src/` |
| `npm run start:api` | Para iniciar la API en puerto 3001 |
| `npm run pre-deploy` | Checklist completo pre-deploy |

**Loops de validación:**
1. Editar código → `npm run lint` → corregir errores → `npm test` → commit
2. Cambiar rutas API → `npm run start:api` en background → `npm run test:contracts`

---

## Estructura del proyecto

```
server/
  index.js                  # Entry point — monta rutas en /api, sirve /finanzas
  routes/
    bmcDashboard.js         # Todas las rutas del dashboard BMC (/api/*)
    calc.js                 # Rutas de la calculadora
    shopify.js              # Integración Shopify
scripts/
  validate-api-contracts.js # Validador de contrato API (requiere servidor)
  run_audit.sh              # Audit completo del sistema
tests/
  validation.js             # Tests unitarios — corren sin servidor (CI)
src/                        # Frontend React (Vite)
docs/
  team/                     # Equipo de agentes — PROJECT-STATE, knowledge, judge
  google-sheets-module/     # planilla-inventory.md, SHEETS-MAPPING
  bmc-dashboard-modernization/ # DASHBOARD-INTERFACE-MAP, implementation plans
.cursor/
  agents/                   # Definiciones de agentes del equipo
  skills/                   # Skills por rol
```

---

## Convenciones de código

- **Módulos:** ES modules (`import`/`export`). No usar `require()`.
- **Rutas API:** Siempre en `server/routes/bmcDashboard.js`, montadas en `/api`.
- **Error semantics:** `503` = Sheets no disponible. `200 + data vacía` = sin datos. Nunca `500` para errores de Sheets.
- **Sheet IDs:** Nunca hardcoded. Siempre desde `config.*` o `process.env.*`.
- **Credenciales:** Nunca en código. Solo en `.env` (no commitear).
- **CORS:** En desarrollo puede ser abierto. En producción debe restringirse a dominios conocidos.
- **Logging:** Usar `pino` / `pino-http`. No usar `console.log` en producción.

---

## Contexto del equipo de agentes

Este proyecto usa un equipo de **agentes IA coordinados** cuyo listado canónico es **`docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2** (N roles) más **§2.2** (skills transversales consideradas en full team). Antes de trabajar:

1. Leer `docs/team/PROJECT-STATE.md` — estado actual, pendientes, cambios recientes.
2. Leer `docs/team/knowledge/<TuRol>.md` si existe.
3. Consultar `docs/google-sheets-module/planilla-inventory.md` para estructura de Sheets.
4. Consultar `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` para estructura del dashboard.

En **full team run** («Invoque full team» / «Equipo completo»): tras el paso 0 del Orquestador, el rol **MATPROMT** (`matprompt`) ejecuta el **paso 0a** y publica prompts por rol en `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` (o `docs/team/matprompt/MATPROMT-RUN-*.md`). Cada agente debe leer **su** subsección del bundle antes de su paso.

Al terminar una tarea:
- Actualizar `docs/team/PROJECT-STATE.md` (sección "Cambios recientes" y "Pendientes").
- Si el cambio afecta a otros agentes, consultar tabla de propagación en `docs/team/PROJECT-TEAM-FULL-COVERAGE.md §4`.

---

## Lo que NO hacer

- No hardcodear sheet IDs, tokens, ni URLs de producción.
- No commitear `.env` ni archivos con credenciales.
- No usar `npm audit fix --force` sin aprobación de Matias (puede romper vite).
- No modificar `docs/team/PROJECT-STATE.md` sin agregar entrada en "Cambios recientes".
- No saltear `npm run lint` antes de commit en `src/`.
