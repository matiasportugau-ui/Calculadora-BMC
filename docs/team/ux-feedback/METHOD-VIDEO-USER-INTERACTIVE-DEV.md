# Método **Video-User-interactive-dev**

Desarrollo y mejora guiados por **sesión en vídeo** (p. ej. tablet filmada con iPhone): el usuario narra objetivos, flujo, errores y mejoras; el agente produce **una revisión completa documentada** y, **en el mismo informe**, el **procedimiento de desarrollo** y **ajustes** identificados.

## Cómo invocarlo (mínimo que tenés que decir)

En Cursor, una frase como:

> Vamos a usar **Video-User-interactive-dev**. El vídeo está en: **`<ruta absoluta o relativa al repo>`**  
> (o adjuntá el archivo en el chat.)

Opcional en la misma línea: **URL base** de la app (`localhost:5173`, preview Vercel, etc.) y **versión** / entorno.

No hace falta repetir toda la skill: con el **nombre del método** + **path o adjunto** alcanza.

## Preparación recomendada (Mac)

```bash
npm run session:video-ingest -- ~/Downloads/IMG_xxxx.MOV "http://localhost:5173"
```

Eso deja vídeo, `extracted/audio.wav`, frames, `metadata.json` y `CURSOR-CHAT-PROMPT.txt` bajo `sessions/`. Podés citar esa carpeta como path.

## Qué debe hacer el agente

1. **Ingestar evidencia:** vídeo multimodal y/o `audio.wav` + `metadata.json` + frames clave si el vídeo no entra al chat.
2. **Analizar integralmente** lo que se evalúa en el vídeo (objetivos dichos, pasos, UI visible, errores, deseos de mejora).
3. **Escribir en disco** (misma corrida):
   - Informe principal (Markdown): ver plantilla [`TEMPLATE-VIDEO-USER-INTERACTIVE-DEV-REPORT.md`](./TEMPLATE-VIDEO-USER-INTERACTIVE-DEV-REPORT.md).
   - JSON estructurado: `VIDEO-USER-INTERACTIVE-DEV-ANALYSIS-YYYY-MM-DD-<slug>.json` (mismo esquema que en la skill `user-session-video-to-backlog`).

## Nombres de archivo canónicos

| Artefacto | Patrón |
|-----------|--------|
| Informe único (revisión + procedimiento dev) | `docs/team/ux-feedback/VIDEO-USER-INTERACTIVE-DEV-REPORT-YYYY-MM-DD-<slug>.md` |
| JSON | `docs/team/ux-feedback/VIDEO-USER-INTERACTIVE-DEV-ANALYSIS-YYYY-MM-DD-<slug>.json` |

`<slug>`: corto, sin espacios (p. ej. `iphone-techo-multizona`).

## Referencias

- Skill: [`.cursor/skills/user-session-video-to-backlog/SKILL.md`](../../.cursor/skills/user-session-video-to-backlog/SKILL.md)
- Regla Cursor: [`.cursor/rules/video-user-interactive-dev.mdc`](../../.cursor/rules/video-user-interactive-dev.mdc)
- Carpeta sesiones: [`sessions/README.md`](./sessions/README.md)
