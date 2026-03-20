# Agente IA: UI vs API (Calculadora + Dashboard)

Qué puede hacer un agente **solo con HTTP** (`/calc/*`, `/api/*`) y qué queda **atado al navegador** o a flujos sin endpoint.

## Superficie canónica para agentes (HTTP)

| Recurso | URL | Notas |
|--------|-----|--------|
| Índice unificado | `GET /capabilities` | Calculadora + Dashboard + punteros UI |
| GPT entry | `GET /calc/gpt-entry-point` | Acciones, `openapi_url`, flujo recomendado |
| OpenAPI calculadora | `GET /calc/openapi` | YAML para GPT Actions / clientes |
| Salud | `GET /health` | Tokens ML, credenciales Sheets (flags) |

**Disciplina:** mantener `docs/openapi-calc.yaml` y `server/gptActions.js` alineados con las rutas reales.

## Qué la API cubre bien

- Cotización estructurada: `POST /calc/cotizar` (escenarios `solo_techo`, `solo_fachada`, etc.).
- Presupuesto libre: `POST /calc/cotizar/presupuesto-libre`.
- PDF de cotización: `POST /calc/cotizar/pdf` + `GET /calc/pdf/:id`.
- Catálogo, escenarios, informe: `GET /calc/catalogo`, `/calc/escenarios`, `/calc/informe`.
- Dashboard financiero/operativo: `GET /api/*` (KPI, entregas, audit, etc.) — puede responder **503** si Sheets no está disponible (semántica acordada).

## UI solo (sin API equivalente o parcial)

| Área | Limitación para el agente |
|------|---------------------------|
| **Wizard / pasos** | El flujo por pasos en React no es expuesto como máquina de estados HTTP; el agente debe usar `POST /calc/cotizar` con el cuerpo completo o guiarse por `GET /calc/escenarios`. |
| **ConfigPanel / overrides locales** | Precios editados, fórmulas de dimensionamiento o MATRIZ cargada en memoria del **browser** no se reflejan automáticamente en el servidor salvo que se use la ruta de actualización de precios o el mismo criterio que el backend. |
| **localStorage / proyecto archivo** | Snapshots guardados en el cliente no son visibles para la API hasta export/import explícitos o integración documentada. |
| **Vista previa del techo (RoofPreview)** | Geometría visual y marcas de pendiente son UI; los números relevantes van en el body de `techo` en la API. |
| **OAuth ML / webhooks** | Flujos de login y callbacks son navegador o servidor con tokens; no son “cotizar” directo. |
| **Finanzas SPA (`/finanzas`)** | Lectura/escritura de datos vía **`/api/*`**; la UI es solo presentación. |

## MCP opcional (IDE)

- Script: `npm run mcp:panelin` (stdio), variable `BMC_API_BASE` (default `http://localhost:3001`).
- Herramientas: `panelin_capabilities`, `panelin_gpt_entry_point`, `panelin_http_request`.
- Requiere API levantada para llamadas HTTP reales.

## Referencias en repo

- Manifiesto estático: `docs/api/AGENT-CAPABILITIES.json` (snapshot; la fuente dinámica es `GET /capabilities`).
- Contratos: `scripts/validate-api-contracts.js` (`npm run test:contracts` con `npm run start:api`).
