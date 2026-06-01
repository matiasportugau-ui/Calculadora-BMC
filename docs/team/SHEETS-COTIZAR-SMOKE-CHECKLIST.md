# Sheets Cotizar — Smoke Checklist (Admin 2.0)

**Planilla:** [2.0 - Administrador de Cotizaciones](https://docs.google.com/spreadsheets/d/1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0/edit) — tab `Admin.`

**Prerequisito:** Cloud Run `panelin-calc` desplegado con fix `presupOrchestrator` (import + message shape). Verificar:

```bash
BMC_API_BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app npm run smoke:presup
# status debe ser awaiting_approval (no error)
```

## Pasos (humano, ~15 min)

1. **Cerrar** la planilla en todos los browsers.
2. **Extensiones → Apps Script** → pegar [`Code.gs`](../../scripts/apps-script/cotizar-button/Code.gs) + [`Sidebar.html`](../../scripts/apps-script/cotizar-button/Sidebar.html) desde el repo (rama `wip/cotizar-and-presup`).
3. Ejecutar **`writeCotizarHeadersSafe`** → columna **60**.
4. Confirmar alert: Borrador 60–65, Revisión 67–69.
5. Guardar proyecto Apps Script y **recargar** la planilla.
6. Menú **Cotizaciones 2.0** → abrir Sidebar.
7. Seleccionar fila ~9 (consulta iSODEC 350 m²) → **Cotizar**.

## Criterios de éxito

- [ ] Estado (col C) = `Borrador Automático`
- [ ] Cols 60–65 con PDF link o explicación borrador
- [ ] Col **K** sin cambios
- [ ] Log en `Log Cotizaciones` (opcional)

## Evidencia

Anotar en [`HANDOFF-2026-05-30-cotizar-presup-split.md`](HANDOFF-2026-05-30-cotizar-presup-split.md) o comentario PR #257: fila, timestamp, screenshot.

**Opcional:** `PDF_DRIVE_FOLDER_ID` en CONFIG tras crear carpeta Drive BMC.
