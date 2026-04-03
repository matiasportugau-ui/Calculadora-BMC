# UX feedback — informes de navegación (usuario → implementación)

Flujo para convertir **transcripción de audio**, **capturas** y **URL de la app desplegada** en un informe Markdown único que un agente de implementación pueda ejecutar paso a paso. Complemento: **sesiones en vídeo** y el método nombrado **Video-User-interactive-dev** (revisión completa + procedimiento de desarrollo en un solo informe) — ver [`METHOD-VIDEO-USER-INTERACTIVE-DEV.md`](./METHOD-VIDEO-USER-INTERACTIVE-DEV.md) y la skill **`user-session-video-to-backlog`**. **MCP en vivo:** **Live DevTools narrative** / **Narrativa en vivo DevTools** — el agente usa **chrome-devtools** en Cursor, navega (default **`https://calculadora-bmc.vercel.app`**), extrae consola/red/snapshots y cruza con la narrativa o transcripción pegada; informe `LIVE-DEVTOOLS-NARRATIVE-REPORT-*.md` — skill **`live-devtools-narrative-mcp`**, plantilla [`TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md`](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md).

## Contenido de esta carpeta

| Archivo | Uso |
|---------|-----|
| [TEMPLATE-USER-NAV-REPORT.md](./TEMPLATE-USER-NAV-REPORT.md) | Plantilla con secciones fijas; el agente la copia y rellena. |
| [TEMPLATE-SESSION-VIDEO-METADATA.json](./TEMPLATE-SESSION-VIDEO-METADATA.json) | Metadatos mínimos para acompañar un MP4 en el flujo vídeo → backlog. |
| [sessions/README.md](./sessions/README.md) | Dónde guardar vídeos locales y cómo extraer audio/frames (`npm run session:video-extract`). |
| [METHOD-VIDEO-USER-INTERACTIVE-DEV.md](./METHOD-VIDEO-USER-INTERACTIVE-DEV.md) | Método **Video-User-interactive-dev**: invocación (nombre + path), entregables canónicos. |
| [TEMPLATE-VIDEO-USER-INTERACTIVE-DEV-REPORT.md](./TEMPLATE-VIDEO-USER-INTERACTIVE-DEV-REPORT.md) | Plantilla Parte A (revisión del vídeo) + Parte B (procedimiento dev / ajustes). |
| [TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md](./TEMPLATE-LIVE-DEVTOOLS-NARRATIVE-REPORT.md) | Plantilla informe **Live DevTools narrative**: narrativa `U-xx` + evidencia MCP `E-xx` + cruce. |
| `USER-NAV-REPORT-YYYY-MM-DD.md` | Informes generados por sesión (crear al vuelo). |
| `LIVE-DEVTOOLS-NARRATIVE-REPORT-YYYY-MM-DD-<slug>.md` | Informe sesión MCP + narrativa/transcripción (skill **live-devtools-narrative-mcp**). |
| `LIVE-DEVTOOLS-NARRATIVE-EVIDENCE-YYYY-MM-DD-<slug>.json` | Opcional: evidencia estructurada hermana del informe MCP. |
| `VIDEO-USER-INTERACTIVE-DEV-REPORT-YYYY-MM-DD-<slug>.md` | Informe único del método Video-User-interactive-dev (revisión + desarrollo). |
| `VIDEO-USER-INTERACTIVE-DEV-ANALYSIS-YYYY-MM-DD-<slug>.json` | JSON hermano del método Video-User-interactive-dev. |
| `USER-SESSION-VIDEO-REPORT-YYYY-MM-DD-<slug>.md` | Legacy: informe vídeo sin nombrar el método explícitamente. |
| `USER-SESSION-VIDEO-ANALYSIS-YYYY-MM-DD-<slug>.json` | Legacy: JSON asociado. |

## Cómo usarlo (resumen)

1. Navegá la app (p. ej. preview o prod en Vercel), grabá comentarios y capturas.
2. Transcribí el audio a texto.
3. En Cursor: adjuntá transcripción + imágenes + URL base; invocá la skill **`navigation-user-feedback`** (o la regla de proyecto si está activa).
4. Revisá prioridades P0/P1/P2; pasá el `USER-NAV-REPORT-*.md` al agente que implementa.

**Video-User-interactive-dev (recomendado):** en Cursor decí **Video-User-interactive-dev** y la **ruta del vídeo** (o adjuntá el archivo). Opcional: `npm run session:video-ingest -- ~/Downloads/….MOV [base_url]`. Salida: **`VIDEO-USER-INTERACTIVE-DEV-REPORT-*.md`** (revisión completa + procedimiento de desarrollo) + **`VIDEO-USER-INTERACTIVE-DEV-ANALYSIS-*.json`**.

**Vídeo sin nombrar el método:** misma skill **`user-session-video-to-backlog`** → nombres legacy `USER-SESSION-VIDEO-*`.

**Live DevTools narrative (MCP):** en Cursor, con MCP **chrome-devtools** activo, decí **Live DevTools narrative** o **Narrativa en vivo DevTools**. Base URL default **`https://calculadora-bmc.vercel.app`** (otra si la indicás). Pegá transcripción o escribí en vivo con `ACTION:` / `EXPECT:`. Salida: **`LIVE-DEVTOOLS-NARRATIVE-REPORT-*.md`** (+ JSON opcional). Skill `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`.

## Skill y regla Cursor

- Skill (transcripción + capturas): `.cursor/skills/navigation-user-feedback/SKILL.md`
- Regla opcional: `.cursor/rules/navigation-user-feedback.mdc`
- Skill (vídeo / **Video-User-interactive-dev**): `.cursor/skills/user-session-video-to-backlog/SKILL.md`
- Regla (disparo por nombre del método): `.cursor/rules/video-user-interactive-dev.mdc`
- Skill (**Live DevTools narrative** / MCP): `.cursor/skills/live-devtools-narrative-mcp/SKILL.md`
- Regla opcional: `.cursor/rules/live-devtools-narrative-mcp.mdc`

## Enlaces al resto del equipo

- Propagación multi-área: [PROJECT-TEAM-FULL-COVERAGE.md](../PROJECT-TEAM-FULL-COVERAGE.md)
- Estado del repo: [PROJECT-STATE.md](../PROJECT-STATE.md)
- Sesión / cockpit: [SESSION-WORKSPACE-CRM.md](../SESSION-WORKSPACE-CRM.md)
- Gates humanos: [HUMAN-GATES-ONE-BY-ONE.md](../HUMAN-GATES-ONE-BY-ONE.md)
