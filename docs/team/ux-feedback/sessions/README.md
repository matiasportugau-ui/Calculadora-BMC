# Sesiones de vídeo (UX / demos)

Carpeta para **artefactos locales** de grabaciones (tablet + teléfono, Loom export, etc.).

## Qué versionar

- **`metadata.json`** por sesión (opcional en git si no contiene datos sensibles).
- Informes generados por el agente: `../USER-SESSION-VIDEO-REPORT-*.md` y `../USER-SESSION-VIDEO-ANALYSIS-*.json` (raíz de `ux-feedback/`).

## Qué no commitear

Los **MP4/MOV**, **audio.wav** y carpetas **frames/** suelen ser pesados y pueden incluir PII en pantalla: quedan **ignorados** por `.gitignore` bajo `sessions/`.

## Dependencias

- **ffmpeg** y **node** en PATH. Los comandos `npm run session:video-ingest` y `npm run session:video-extract` ejecutan al inicio `session:video-deps:ensure` (en macOS con Homebrew pueden instalar **ffmpeg** si falta).
- Comprobar: `npm run session:video-deps`.

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

Salida típica:

- **`extracted/audio.wav`** — audio **completo** (16 kHz mono) para transcript o para que el modelo **entienda la voz**.
- **`extracted/frames/frame_*.jpg`** — por defecto **1 imagen cada 5 s**, máx. **640 px** de ancho, JPEG **baja calidad pero legible** (menos peso que 1 fps en HD).

Personalizar (ejemplo: captura cada 10 s, 480 px, más comprimido):

```bash
export BMC_SESSION_VIDEO_FRAME_INTERVAL_SEC=10
export BMC_SESSION_VIDEO_FRAME_MAX_WIDTH=480
export BMC_SESSION_VIDEO_JPEG_Q=18
npm run session:video-extract -- "ruta/al.mp4"
```

Luego transcribir `audio.wav` o usar transcript de Loom/Descript y seguir la skill **`user-session-video-to-backlog`**.
