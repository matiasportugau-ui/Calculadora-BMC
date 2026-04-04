# LIVE-DEVTOOLS-NARRATIVE-REPORT — local full stack ready

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `http://localhost:5173` |
| Entorno | local |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Usuario (Matias) + agente Cursor |

## 2. Objetivo de la sesión

- **Goal (una frase):** Levantar dependencias para que el entorno siga corriendo full en local.
- **Criterios de éxito del usuario:** API local arriba + frontend local arriba + UI navegable sin errores críticos.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | Paso 1 | Solicita levantar dependencias necesarias para full local | Stack local operativo continuo |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Pre-check | `curl http://localhost:3001/health` | Inicialmente API caída (no conectaba) |
| E-02 | Arranque | `npm run dev:full` | Levanta `start:api` + `dev` (Vite 5173 y API 3001) |
| E-03 | Verificación backend | `curl http://localhost:3001/health` | `ok:true`, `hasSheets:true`, `missingConfig:[]` |
| E-04 | Verificación frontend | `curl -I http://localhost:5173` | `HTTP/1.1 200 OK` |
| E-05 | UI local | `take_snapshot` | Calculadora renderizada en `localhost:5173` (shell completa visible) |
| E-06 | Consola | `list_console_messages` | Solo warnings React Router v7 future flags; sin errores críticos |
| E-07 | Red | `list_network_requests` | Carga de módulos Vite/React 200/304 y assets Shopify 200 |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-03, E-04, E-05, E-06, E-07 | sí | Quedó full local operativo; se detectaron warnings no bloqueantes de React Router |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-04-03 | P2 | Stack local inicialmente caído | API y Vite no respondían antes de relanzar `dev:full` | local runtime |
| LDN-2026-04-04-04 | P3 | Warnings de migración React Router | Advertencias `v7_startTransition` / `v7_relativeSplatPath` no bloquean operación | `src/` |

## 7. Recomendaciones y siguientes pasos

1. Mantener `npm run dev:full` como comando base de sesión local.
2. Si se cae algún servicio, relanzar `dev:full` en lugar de API/Vite por separado.
3. (Opcional) planificar actualización de flags React Router para limpiar warnings.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada
- [x] Consola limpia de errores P0 / o documentado
- [x] Red: sin 4xx/5xx inesperados en flujo principal
- [x] Criterios de éxito del usuario (§2) cubiertos o ticket abierto

## 9. Anexos (opcional)

- Endpoint salud local: `http://localhost:3001/health`
- Front local: `http://localhost:5173`
