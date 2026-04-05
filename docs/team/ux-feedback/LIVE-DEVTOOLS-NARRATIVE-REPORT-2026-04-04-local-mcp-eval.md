# LIVE-DEVTOOLS-NARRATIVE-REPORT — evaluación local (MCP + stack)

Plantilla base: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`. Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `http://localhost:5173/` |
| Entorno | local (Vite); API `http://localhost:3001/health` respondió **200** en comprobación previa |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` — **`navigate_page` no ejecutado** (ver E-01) |
| Participantes | Matías (solicitud), agente Cursor |

## 2. Objetivo de la sesión

- **Goal (una frase):** Correr la calculadora en **local** y evaluar con **Live DevTools narrative** (consola, red, snapshot).
- **Criterios de éxito del usuario:** MCP operativo contra `localhost:5173`; evidencia real de consola/red/snapshot en el informe.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | inicio | Pedir evaluación en local con Live DevTools narrative | MCP navega a local, se registran consola + red + snapshot |

## 4. Evidencia del agente (`E-xx`)

_`E-02` no sustituye DevTools: es comprobación HTTP desde terminal (explícito para no confundir con pestaña Red del navegador)._

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Intento MCP | `navigate_page` → `http://localhost:5173/` (servidor `project-0-Calculadora-BMC-chrome-devtools`) | Error: *The browser is already running for `/Users/matias/.cache/chrome-devtools-mcp/chrome-profile`. Use `--isolated` to run multiple browser instances.* No hay salida de `list_console_messages` / `list_network_requests` / `take_snapshot` en esta corrida. |
| E-02 | Tras levantar Vite | `curl` terminal: `GET http://localhost:5173/` | `HTTP 200`, tiempo total ~**0,003 s** (máquina local). Primeros bytes del documento: `DOCTYPE html`, `<title>Calculadora BMC</title>`, entry `/src/main.jsx`. |
| E-03 | Arranque dev | Log proceso `npm run dev` (Vite 7.3.1) | `Local: http://localhost:5173/` — servidor listo. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01, E-02, E-03 | parcial | **Local OK** (E-02/E-03). **MCP DevTools no** hasta cerrar la otra instancia del perfil `chrome-devtools-mcp` o usar `--isolated` / otro `userDataDir`. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable |
|----|-----------|--------|---------|----------------|
| LDN-2026-04-04-16 | P1 | MCP chrome-devtools bloqueado (perfil en uso) | Impide `navigate_page` y el resto de tools hasta resolver instancia duplicada | entorno local / configuración MCP |
| LDN-2026-04-04-17 | P3 | Vite no estaba arriba al inicio | Se levantó `npm run dev` para la evaluación; antes solo respondía `:3001` | DX / autostart |

## 7. Recomendaciones y siguientes pasos

1. Cerrar el Chrome/controlador que mantiene ocupado `~/.cache/chrome-devtools-mcp/chrome-profile` y **repetir** en Cursor: `navigate_page` → `list_console_messages` (errors/warnings) → `list_network_requests` → `take_snapshot` en `http://localhost:5173/`.
2. Si necesitás **dos** automatizaciones a la vez, configurar **segunda** instancia MCP con perfil aislado (documentación `chrome-devtools-mcp`).
3. Con MCP funcionando, validar en wizard **Solo techo** los presets recientes (lista / familia / color) con **Enter** entre pasos.

## 8. Verificación (checklist)

- [x] URL local responde (curl 200)
- [ ] Consola navegador capturada por MCP (pendiente desbloqueo perfil)
- [ ] Red cliente capturada por MCP (pendiente)
- [ ] Snapshot a11y capturado por MCP (pendiente)

## 9. Anexos (opcional)

- Proceso dev en background: revisar salida del terminal donde corre `npm run dev` (puerto 5173).
