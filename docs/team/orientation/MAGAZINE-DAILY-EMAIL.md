# Digest diario por correo (PROJECT-STATE + git)

**Destinatario por defecto:** `matias.portugau@gmail.com` (sobrescribible con `MAG_DAILY_EMAIL_TO` en `.env`).

El digest **no** regenera la spread HTML completa con IA cada día: arma un correo con **Cambios recientes** de `docs/team/PROJECT-STATE.md`, **git status** y **git log** reciente, y guarda copia en `.runtime/magazine-daily/` (gitignored). La spread editorial fija sigue en [MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.html](./MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.md).

## 1. Gmail (recomendado)

1. Activa **verificación en 2 pasos** en la cuenta Google.
2. Crea una **contraseña de aplicación**: Google Account → Seguridad → Contraseñas de aplicaciones.
3. En `.env` del repo (no commitear):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=matias.portugau@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx

# Opcional
MAG_DAILY_EMAIL_TO=matias.portugau@gmail.com
MAG_DAILY_EMAIL_FROM=matias.portugau@gmail.com
# Adjuntar spread HTML de referencia (~442 líneas)
# MAG_DAILY_ATTACH_MAGAZINE=1
```

4. Instalá el transporte:

```bash
npm install nodemailer
```

## 2. Comandos npm

| Comando | Efecto |
|---------|--------|
| `npm run magazine:daily` | Escribe `.runtime/magazine-daily/magazine-daily-YYYY-MM-DD.html` y `.txt` |
| `npm run magazine:daily:send` | Igual + envía correo si `SMTP_USER` y `SMTP_PASS` están definidos |
| `npm run magazine:daily:dry` | Muestra asunto y tamaño; no escribe ni envía |

## 3. Programación diaria (macOS)

```bash
bash scripts/install-magazine-daily-schedule.sh
```

- **Hora por defecto:** 08:00 hora local **America/Montevideo** (`RUN_HOUR_LOCAL=8` en el plist).
- El agente de Launchd corre **cada hora en el minuto 0**; el script solo ejecuta el envío en la hora configurada y **una vez por día** (estado en `~/.cache/bmc-magazine-daily/schedule-state.log`).

Desinstalar:

```bash
bash scripts/uninstall-magazine-daily-schedule.sh
```

## 4. Seguridad

- No commitees `.env` ni contraseñas.
- El script no imprime `SMTP_PASS`.
- Si no configurás SMTP, `magazine:daily` sigue siendo útil para generar archivos locales.

## 5. Índice

- Plantilla spread + ejemplo: [AI-MAGAZINE-UPDATE-LOGS-PROMPT.md](./AI-MAGAZINE-UPDATE-LOGS-PROMPT.md) · [MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.md](./MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.md)
