# LIVE-DEVTOOLS-NARRATIVE-REPORT — navegación + modificaciones (en curso)

Plantilla base: `docs/team/ux-feedback/TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`. Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` (chrome-devtools-mcp) — **sesión bloqueada al inicio** (ver E-01) |
| Participantes | Matías (usuario), agente Cursor |

## 2. Objetivo de la sesión

- **Goal (una frase):** Navegar la calculadora en vivo, documentar la experiencia con evidencia DevTools y enlazar modificaciones / backlog.
- **Criterios de éxito del usuario:** Flujo navegable en la URL acordada; consola y red capturadas por bloque; beats `U-xx` cruzados con `E-xx`; hallazgos accionables para cambios en repo o deploy.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | inicio | Invocar Live DevTools narrative: navegar la app e incluir modificaciones en el mismo hilo | Agente usa MCP, registra consola/red/snapshot por bloque y cruza con la narrativa |

_(Añadir U-02+ con `[mm:ss]` o **Paso N** y formato ACTION / EXPECT a medida que avances.)_

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | Tras `navigate_page` → prod | `navigate_page` (chrome-devtools MCP, servidor `project-0-Calculadora-BMC-chrome-devtools`) | Error: *The browser is already running for `/Users/matias/.cache/chrome-devtools-mcp/chrome-profile`. Use `--isolated` to run multiple browser instances.* — No se obtuvieron consola/red/snapshot en este bloque. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-01 | no | Desbloquear MCP (una sola instancia del perfil chrome-devtools-mcp) y repetir `navigate_page` + `list_console_messages` + `list_network_requests` + `take_snapshot`. |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-04-01 | P1 | MCP chrome-devtools no navega por perfil en uso | Segunda instancia del mismo `userDataDir` impide `navigate_page` | entorno local / configuración MCP |

## 7. Recomendaciones y siguientes pasos

1. **Desbloquear MCP:** cerrar la ventana/proceso de Chrome que esté usando el perfil `chrome-devtools-mcp` (`~/.cache/chrome-devtools-mcp/chrome-profile`), o ajustar el arranque del MCP con **`--isolated`** / otro `userDataDir` si tu setup lo permite (según documentación de `chrome-devtools-mcp`).
2. **Reanudar sesión en el chat:** pegar narrativa con **ACTION / EXPECT** por paso; el agente repetirá navegación + consola + red + snapshot y actualizará este informe (y opcionalmente el JSON de evidencia).
3. **Modificaciones en código:** cuando un hallazgo esté cerrado con evidencia, enlazar PR/commit o archivo tocado en la sección 7 u 8.

## 8. Verificación (checklist)

- [ ] Reproducible en URL indicada
- [ ] Consola limpia de errores P0 / o documentado
- [ ] Red: sin 4xx/5xx inesperados en flujo principal
- [ ] Criterios de éxito del usuario (sección 2) cubiertos o ticket abierto

## 9. Anexos (opcional)

- JSON hermano: pendiente — `LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-2026-04-04-nav-modifications-session.json` si se pide trazabilidad máquina-legible tras desbloqueo MCP.
