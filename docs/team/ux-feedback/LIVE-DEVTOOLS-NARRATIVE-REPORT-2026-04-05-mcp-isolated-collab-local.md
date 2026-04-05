# LIVE-DEVTOOLS-NARRATIVE-REPORT — modo colaborativo local + MCP aislado

Skill: `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-05 |
| Base URL colaborativa | `http://localhost:5173/` (Vite; `npm run dev` o `npm run dev:full`) |
| Cambio de entorno | [`.cursor/mcp.json`](../../.cursor/mcp.json): añadido **`--isolated`** a `chrome-devtools-mcp` |

## 2. Objetivo (Matías)

- **Goal:** Trabajar en modo **Live DevTools narrative**: vos navegás en la calculadora local y el agente **observa** (consola / red / snapshot) y cruza con lo que contás, para **modificar el repo** en paralelo cuando haga falta.
- **EXPECT:** El MCP puede lanzar Chrome sin chocar con otra instancia que ya usa `~/.cache/chrome-devtools-mcp/chrome-profile`.

## 3. Narrativa usuario (`U-xx`)

| ID | ACTION | EXPECT |
|----|--------|--------|
| U-01 | Abrir sesión “live” mientras navego | MCP conecta a local y registra evidencia en cada bloque |

## 4. Evidencia (`E-xx`)

| ID | Fuente | Hallazgo |
|----|--------|----------|
| E-01 | `navigate_page` → `http://localhost:5173/` **antes** del cambio de config | Error: *browser is already running … chrome-profile* — bloquea narrativa MCP. |
| E-02 | Repo | Se agregó `--isolated` en `.cursor/mcp.json` (CLI oficial: perfil temporal, limpieza al cerrar). |
| E-03 | `curl` local | `http://127.0.0.1:5173/` → **200** cuando Vite está arriba (no sustituye DevTools). |

## 5. Cruce

| User ID | Evidence | ¿Coincide? |
|---------|----------|------------|
| U-01 | E-01 → E-02 | parcial hasta **reiniciar** el servidor MCP en Cursor |

## 6. Cómo usar el modo colaborativo (checklist humano)

1. **Levantar la app:** `npm run dev` (solo front) o `npm run dev:full` (API + front si necesitás `/api/*` sin 404).
2. **Reiniciar MCP** en Cursor tras el cambio de `mcp.json`: *Command Palette* → **“MCP: Restart Servers”** o **Developer: Reload Window** (según tu versión).
3. **Abrís** [http://localhost:5173/](http://localhost:5173/) en **tu** Chrome si querés; el MCP usará **otra** ventana/perfil aislado para inspeccionar la misma URL.
4. En el chat, por cada bloque que quieras cruzar, escribí **`ACTION:`** / **`EXPECT:`** (o pasos numerados). El agente ejecutará `navigate_page` → `list_console_messages` → `list_network_requests` → `take_snapshot` y actualizará el informe o el código según el hallazgo.

## 7. Hallazgos

| ID | Severidad | Título |
|----|-----------|--------|
| LDN-2026-04-05-01 | P1 | Perfil MCP compartido bloqueaba `navigate_page` |
| LDN-2026-04-05-02 | P3 | Sin reinicio de MCP, `--isolated` no aplica |

## 8. Verificación

- [ ] MCP reiniciado en Cursor
- [ ] `navigate_page` a `http://localhost:5173/` OK
- [ ] Consola/red/snapshot capturados en el hilo siguiente
