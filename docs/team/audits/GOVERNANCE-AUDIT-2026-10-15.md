# Governance & Audit Report — 2026-10-15

Fuente: `~/.ialfred/bin/audit-report.sh` (canónico; `/tmp/audit-report.sh` es copia vieja — no usar).
Export generado por IAlfred (desk local). Datos limpiados: sin claves, sin valores de secretos.

## Resumen de governance (hoy)

- Decisiones: 4 (2 `create`, 2 `decide`) → **1 approve (aplicado)**, **1 reject (no aplicado)**.
- Workflows: 3 ejecutados, **3 OK**, 0 error (`quotes-refresh`, `hitl-pending`, `morning-brief`).
- Errores en journal: 0.
- Loops HITL: **10 abiertos**, 32 completados.
- Server health: `personal-agent-api` v0.8.0 · BMC configured: true · WA dry-run: true · Sheets: service account.

## P0 / P1 — Blockers que requieren HITL (Console / secretos)

Ninguno se puede cerrar desde terminal: los tres requieren mint/console/pago humano.

| Prio | Loop | Blocker | Acción humana exacta |
|-----:|------|---------|----------------------|
| 98 | `ol-cloudrun-billing-closed-20261011` | ~~GCP billing CERRADO → panelin-calc 503~~ **probablemente RESUELTO**: hoy `panelin-calc` responde (403 por guard de origen, NO 503). Falta confirmación humana | Confirmar en Console que la cuenta `01F73B-2A3BF3-1687AE` esté **Open**; si sí, marcar el loop done |
| 95 | `ol-xai-key-rotate-20261013` | `XAI_API_KEY` y `GROK_API_KEY` inválidas (desk: `xai: HTTP 403`) | Mint en console.x.ai → rotar en Doppler `bmc-backend/prd` → reiniciar Enviar Desk :8787. No pegar la key en chat |
| 89 | `ol-meta-campaign-20261008` | Meta Ads LIVE API caída: faltan `META_ADS_*`; content IDs no matchean el catálogo | Reponer credenciales Meta Ads y remapear catálogo |

Notas:
- GCP: el chequeo con `gcloud billing accounts describe` fue **bloqueado por permisos** en este entorno (read-only pero el harness lo corta). Alternativa segura: confirmar por Console (o habilitar `gcloud` para el agente).
- `/tmp/xai-rotate-doppler.sh` **no existe** (el loop lo referencia). Hay que crearlo o improvisar la rotación.
- Estado LLM del desk hoy: OpenAI (GPT) **activo/verde**; xAI 403, Anthropic 401 (key inválida), Gemini 429 (cuota) en cooldown. El desk opera por OpenAI.

## Infra local (verificado hoy)

- Enviar Desk :8787 — up. IAlfred :3857 — up. Calculadora API :3001 — up. Vite :5173 — up.
- tmux session `ialfred-monitor` creada (windows: journal, audit, health, loops). Attach: `tmux attach -t ialfred-monitor`.
- Backup de audit trail: `~/backups/audit/2026-10-15/` (+ `.tar.gz`).

## Fixes aplicados hoy

- `~/.ialfred/bin/audit-report.sh` (backup en `*.bak-20261015-013614`):
  - `|| echo 0` tras `grep -c` producía `"0\n0"` y rompía `[ -gt ]` (línea 51: "integer expression expected"). → `|| true`.
  - Sección OPEN HITL LOOPS leía `.items` pero `open-loops.json` es un array → mostraba "0 open". → jq tolerante a array/objeto. Ahora: 10 open / 32 done.

## Pendiente / siguientes pasos

1. HITL: los 3 blockers de la tabla (arriba). Sin esto, Cloud Run panelin-calc sigue 503 y xAI/Meta Ads siguen caídos.
2. Revisar window 0 sobrante en la tmux session (el script deja una shell extra).
3. Automatizar el backup semanal (hoy fue manual); proponer cron/launchd.
