# cm-0 — Verificación WhatsApp Cloud API (automatización)

**Fecha:** 2026-04-18 (UTC aprox. según ejecución en repo)

**Alcance:** comprobar en producción el handshake Meta (GET verify), API viva y variables mínimas; no sustituye una prueba manual de mensaje entrante y fila **WA-Auto** en Sheets (gate humano según [WHATSAPP-META-E2E.md](../WHATSAPP-META-E2E.md) §4).

## Comandos ejecutados

1. `npm run smoke:prod` — **OK** (health, capabilities, MATRIZ CSV, suggest-response, ML status).
2. `PUBLIC_BASE_URL=https://panelin-calc-642127786762.us-central1.run.app npm run wa:cloud-check -- --probe` — **OK** (HTTP 200, cuerpo `OK_META` en GET de verificación webhook).

**Base canónica API:** `https://panelin-calc-642127786762.us-central1.run.app`  
**Callback webhook:** `{base}/webhooks/whatsapp`

## Criterio de cierre operativo

- **Automatización:** verificada en esta fecha (smoke + probe).
- **Pendiente humano (opcional de confirmación):** enviar mensaje de prueba desde otro número; tras inactividad o emoji de disparo, confirmar fila con origen **WA-Auto** en **CRM_Operativo** / **Form responses 1** o documentar error con logs Cloud Run.

## Referencias

- [WHATSAPP-META-E2E.md](../WHATSAPP-META-E2E.md)
- [PROCEDIMIENTO-CANALES-WA-ML-CORREO.md](../PROCEDIMIENTO-CANALES-WA-ML-CORREO.md) Fase 1
