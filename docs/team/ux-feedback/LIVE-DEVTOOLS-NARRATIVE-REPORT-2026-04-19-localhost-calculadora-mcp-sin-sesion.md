# LIVE-DEVTOOLS-NARRATIVE-REPORT — localhost Calculadora (sesión parcial)

Plantilla base: [`TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md). Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-19 |
| Base URL | `http://localhost:5173/` |
| Entorno | local |
| Navegador / MCP | **MCP `chrome-devtools` no disponible en esta sesión del agente** (invocación `call_mcp_tool` → error: servidor MCP inexistente). Repo declara servidor en [`.cursor/mcp.json`](../../../.cursor/mcp.json). |
| Participantes | Usuario (comando Live DevTools narrative + localhost); agente Cursor. |

## 2. Objetivo de la sesión

- **Goal (una frase):** Ejecutar **Live DevTools narrative** contra la Calculadora BMC en **localhost** y registrar evidencia de consola/red/UI vía MCP.
- **Criterios de éxito del usuario:** Navegación local con captura de consola, red y anclajes visuales según protocolo MCP.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | 1 | Invocar narrativa MCP con base **localhost** (Calculadora). | Consola/red/snapshot reales desde DevTools enlazados a `E-xx`. |

_No hubo transcripción adicional ni pasos `ACTION:` / `EXPECT:` pegados en el hilo._

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|----------------|----------|
| E-01 | Inicio | Shell: `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:5173/` | Código HTTP **200** — el origen local responde (no es salida de DevTools; solo disponibilidad TCP/HTTP). |
| E-02 | Inicio | `call_mcp_tool` → servidor `chrome-devtools` | **Error:** «MCP server does not exist: chrome-devtools». Sin `list_console_messages`, `list_network_requests`, ni snapshot desde MCP en este hilo. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02 | parcial | E-01 confirma que **hay** app en `:5173`; E-02 impide el protocolo MCP completo (sin evidencia de consola/red del navegador en esta sesión). |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-19-01 | P1 | MCP `chrome-devtools` no enlazado al agente | El proyecto define el servidor en `.cursor/mcp.json`, pero en esta ejecución el host de herramientas no expone el servidor con id `chrome-devtools`. Sin MCP no se cumple el protocolo Live DevTools narrative. | Cursor / configuración MCP (no código app). |

## 7. Recomendaciones y siguientes pasos

1. En **Cursor → Settings → MCP**, verificar que el servidor **chrome-devtools** esté habilitado y arranque (depende de `npx chrome-devtools-mcp@latest`, Chrome y espacio en disco).
2. Re-ejecutar el comando con el mismo URL (`http://localhost:5173/`) y, si podés, pegar narrativa con **`ACTION:`** / **`EXPECT:`** o marcas de tiempo para poblar `U-02+`.
3. Si MCP sigue sin estar disponible en el agente: usar la skill **`navigation-user-feedback`** con URL + capturas + transcripción, o informe manual con la misma plantilla omitiendo columnas MCP.

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (HTTP 200 vía `curl` a `127.0.0.1:5173`)
- [ ] Consola limpia de errores P0 / o documentado — **no medido** (sin MCP)
- [ ] Red: sin 4xx/5xx inesperados en flujo principal — **no medido** (sin MCP)
- [ ] Criterios de éxito del usuario (§2) cubiertos o ticket abierto — **pendiente** hasta habilitar MCP o alternativa

## 9. Anexos (opcional)

- Comando HTTP comprobado: `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:5173/` → `200`.
- No se generó JSON hermano: pocos ítems y sin salida MCP estructurable.
