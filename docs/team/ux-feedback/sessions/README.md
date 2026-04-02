# Sesiones de vídeo (UX / demos)

Carpeta para **artefactos locales** de grabaciones (tablet + teléfono, Loom export, etc.).

## Qué versionar

- **`metadata.json`** por sesión (opcional en git si no contiene datos sensibles).
- Informes generados por el agente: `../USER-SESSION-VIDEO-REPORT-*.md` y `../USER-SESSION-VIDEO-ANALYSIS-*.json` (raíz de `ux-feedback/`).

## Qué no commitear

Los **MP4/MOV**, **audio.wav** y carpetas **frames/** suelen ser pesados y pueden incluir PII en pantalla: quedan **ignorados** por `.gitignore` bajo `sessions/`.

## Ingesta en un paso (vídeo desde iPhone → Mac)

1. Pasá el archivo al Mac (**AirDrop**, **Fotos**, **Archivos** / iCloud Drive).
2. Desde la **raíz del repo**:

```bash
npm run session:video-ingest -- ~/Downloads/IMG_xxxx.MOV
# opcional: URL de la app
npm run session:video-ingest -- ~/Downloads/IMG_xxxx.MOV "http://localhost:5173"
```

Eso crea `sessions/YYYY-MM-DD-iphone-<slug>/` con el vídeo copiado, `extracted/audio.wav` + `extracted/frames/`, `metadata.json` y `CURSOR-CHAT-PROMPT.txt` (texto listo para pegar en el chat).

3. En Cursor: adjuntá el vídeo (y/o `audio.wav` + `metadata.json`) y usá la skill **`user-session-video-to-backlog`**.

## Extracción local (solo ffmpeg)

Si ya tenés el MP4/MOV en `sessions/`:

```bash
npm run session:video-extract -- "docs/team/ux-feedback/sessions/2026-04-02-mi-demo/demo.mp4"
```

Luego transcribir `audio.wav` o usar transcript de Loom/Descript y seguir la skill **`user-session-video-to-backlog`**.
