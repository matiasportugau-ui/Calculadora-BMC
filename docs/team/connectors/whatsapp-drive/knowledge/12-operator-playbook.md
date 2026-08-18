# Playbook operador (WA + Drive)

Pasos cortos. Secretos nunca en el chat.

## Mensaje de cliente → sugerencia

1. Confirmar webhook: `npm run wa:cloud-check` (local/prod según contexto).
2. El cliente escribe al número de la WABA. Esperar 5 min **o** que manden 🚀.
3. Abrir `/hub/canales` (Omni) o `/hub/wa` (Cockpit) **o** `CRM_Operativo` origen WA-Auto.
4. Revisar sugerencia AI. Editar. Aprobar envío. Si Graph falla, no marcar enviado.

## Mandar link de cotización

1. Tener PDF exportado (calculadora).
2. Preferir URL pública/GCS. Drive share link solo si el cliente puede abrirla.
3. Teléfono del **cliente** en dígitos (UY `598…`).
4. Frase explícita del vendedor + tool o botón send-approved.

## Guardar / reabrir en Drive

1. GIS: iniciar sesión Drive en el panel. Raíz `Panelin BMC Cotizaciones`.
2. Guardar → PDF + `.bmc.json` en carpeta del cliente.
3. Archivo empresa: ocurre al exportar si hay `DRIVE_QUOTE_FOLDER_ID` + OAuth server.
4. Reabrir: `?openDrive=` / Abrir desde panel. Server carga `.bmc.json` (no el token GIS).

## Media en el hilo

- Fotos: cockpit `/hub/wa` via signed GCS. Si 401, falta auth operador.
- Audio: transcript cuando hay bytes reales; no inventar texto.
- No buscar esos archivos en Drive.

## Si “no llega a la planilla”

- Logs Cloud Run `[WA]`.
- Verify token Meta = `WHATSAPP_VERIFY_TOKEN`.
- Service account editor en la Sheet.
- Canonical: bus + orchestrator + `OMNI_WA_CANONICAL` los tres ON, o se usa legacy.

## Si Drive 401 `invalid_client`

Client ID GIS inexistente o proyecto GCP incorrecto. Skill `bmc-google-drive-oauth`. Redeploy si cambió `VITE_GOOGLE_CLIENT_ID`.

## cm-0 Meta

Playbook clic a clic: `docs/team/HUMAN-GATES-ONE-BY-ONE.md`. No marcar done sin evidencia.
