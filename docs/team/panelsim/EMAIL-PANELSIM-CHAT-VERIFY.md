# Verificación Fase F — chat PANELSIM + correo

Checklist manual (1 vez tras Fases A–E):

1. Abrí el workspace multi-root: [EMAIL-WORKSPACE-SETUP.md](./EMAIL-WORKSPACE-SETUP.md) o `panelsim-email.code-workspace`.
2. En un chat de Cursor con contexto **Calculadora-BMC**, escribí: *«PANELSIM: actualizame sobre el correo»* (o equivalente).
3. Confirmá que el agente:
   - Resuelve la ruta del repo `conexion-cuentas-email-agentes-bmc` (skill [`.cursor/skills/panelsim-email-inbox/SKILL.md`](../../../.cursor/skills/panelsim-email-inbox/SKILL.md)).
   - Ejecuta `npm run panelsim-update` desde esa raíz.
   - Lee `data/reports/PANELSIM-ULTIMO-REPORTE.md` y resume sin inventar mensajes si el sync falló.

Si el agente no encuentra el repo: definí `BMC_EMAIL_INBOX_REPO` en `.env` local de Calculadora-BMC (ver [`.env.example`](../../../.env.example)).
