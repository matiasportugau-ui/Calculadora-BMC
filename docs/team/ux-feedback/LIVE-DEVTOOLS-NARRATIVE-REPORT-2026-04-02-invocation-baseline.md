# LIVE-DEVTOOLS-NARRATIVE-REPORT — 2026-04-02 (invocación baseline)

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`. Invocación: **Live DevTools narrative** / **Narrativa en vivo DevTools** (`/live-devtools-narrative-mcp`).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-02 |
| Base URL | `https://calculadora-bmc.vercel.app` |
| Entorno | prod |
| Navegador / MCP | **chrome-devtools MCP:** `navigate_page` falló (perfil Chrome ya en uso — ver §4). **cursor-ide-browser MCP:** navegación + snapshot + consola + red completados. |
| Participantes | Matias (invocación); agente (evidencia) |

## 2. Objetivo de la sesión

- **Goal (una frase):** Ejecutar el protocolo **Narrativa en vivo DevTools** tras invocación explícita de la skill, sin transcripción de usuario adicional.
- **Criterios de éxito del usuario:** Carga de la calculadora en producción verificable; consola y red sin errores de aplicación obvios en el arranque.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

_No hubo dictado ni transcripción pegada; solo la invocación del comando._

| ID | Orden / tiempo | ACTION (hecho) | EXPECT (esperado) |
|----|----------------|----------------|-------------------|
| U-01 | t0 | Invocar **Live DevTools narrative** (`/live-devtools-narrative-mcp`) sin texto extra | Baseline de prod: página carga, shell de calculadora visible, sin 5xx en carga inicial |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Momento (relativo) | Tool / fuente | Hallazgo |
|----|--------------------|-----------------|----------|
| E-01 | t0 | `project-0-Calculadora-BMC-chrome-devtools` → `navigate_page` | Error: *"The browser is already running for …/chrome-devtools-mcp/chrome-profile. Use --isolated…"* — no se obtuvo sesión DevTools canónica en esta corrida. |
| E-02 | t1 | `cursor-ide-browser` → `browser_navigate` → `https://calculadora-bmc.vercel.app` | **200**, título **Calculadora BMC**; snapshot inicial con enlaces Wolfboard / Calculadora / Logística. |
| E-03 | t2 | `cursor-ide-browser` → `browser_wait_for` (3 s) | Espera fija post-carga para estabilizar JS. |
| E-04 | t3 | `cursor-ide-browser` → `browser_snapshot` (compact) | Shell interactivo: botones **Vendedor**, **Cliente**, **Config**, **Drive**, **Presupuestos**, **Limpiar**, **Imprimir**, **Siguiente**; nav **Módulos BMC**. |
| E-05 | t3 | `cursor-ide-browser` → `browser_console_messages` | Solo **warning** de instrumentación **`[CursorBrowser] Native dialog overrides installed`** (origen del contenedor de prueba), **sin** `error` de la app en esta URL. |
| E-06 | t3 | `cursor-ide-browser` → `browser_network_requests` | **GET** documento y chunks **`index-ByS8gHOR.js`**, **`App-BLFjGbGf.js`**, **`calcApiBase-CdzGBlsj.js`**, **`OrbitControls-CZIZOx4J.js`**, **`PanelinCalculadoraV3_backup-DmGw8zL1.js`** → **200**. Script **`https://accounts.google.com/gsi/client`** → **200**. |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide expectativa? | Brecha / notas |
|---------|--------------|-------------------------|----------------|
| U-01 | E-02, E-04, E-05, E-06 | **Sí** (carga y shell OK; red 200) | **E-01:** para usar estrictamente **chrome-devtools MCP**, cerrar o aislar la instancia que bloquea el `userDataDir` o ajustar args (`--isolated` / otro perfil). |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen | Área probable (`src/` / `server/` / env / deploy) |
|----|-----------|--------|---------|-----------------------------------------------------|
| LDN-2026-04-02-06 | P2 | chrome-devtools MCP bloqueado por perfil en uso | `navigate_page` no ejecutó: Chrome ya asociado al perfil default de `chrome-devtools-mcp`. | Entorno Cursor / configuración MCP (`.cursor/mcp.json`) — no bug de app |
| LDN-2026-04-02-07 | P3 | Sin narrativa de usuario en el hilo | No hay `U-02+` ni EXPECT de flujo (techo, ML, etc.); informe = **baseline** de arranque. | Proceso UX — pegar ACTION/EXPECT o transcripción en el mismo mensaje |

## 7. Recomendaciones y siguientes pasos

1. Si necesitás **solo** evidencia reproducible desde Cursor sin pelear con el perfil de Chrome: **cursor-ide-browser** ya cubre navegación, snapshot, consola y red para esta URL.
2. Si querés **obligatoriamente** chrome-devtools MCP: cerrar procesos Chrome ligados a `~/.cache/chrome-devtools-mcp/chrome-profile` o documentar en el equipo un segundo servidor MCP con `--isolated` / `userDataDir` distinto.
3. Para un informe con cruce **U-xx ↔ E-xx** útil: en el mismo chat, pegá transcripción o bullets con **ACTION / EXPECT** (skill sugiere formato explícito).

## 8. Verificación (checklist)

- [x] Reproducible en URL indicada (vía cursor-ide-browser en esta sesión)
- [x] Consola: sin errores P0 de aplicación en carga inicial (solo warnings de Cursor Browser)
- [x] Red: sin 4xx/5xx en recursos listados para esta carga
- [ ] Criterios de éxito ampliados del usuario (flujos específicos) — pendiente de narrativa o siguiente sesión

## 9. Anexos (opcional)

- JSON evidencia máquina: no generado (poca densidad de ítems; se puede añadir si se amplía la sesión).
- Informe narrativo previo mismo día (flujo techo multizona): [`LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-sesion-chat.md`](./LIVE-DEVTOOLS-NARRATIVE-REPORT-2026-04-02-sesion-chat.md).
