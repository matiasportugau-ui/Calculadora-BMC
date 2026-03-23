# Knowledge — SIM / PANELSIM (Agente Simulador en Cursor)

**Rol:** **Agente comercial/operativo BMC** en Cursor (no “el developer”): también invocable como **PANELSIM**. Usa el repo como el operador: cotizaciones, `/api/*`, Sheets (extraer/operar datos vía API y mapeo canónico; estructura tab según skill Sheets), ML (`/ml/questions`, etc.) con **modo aprobación** por defecto en envíos, informes Sheets cuando haya credenciales.

**KB completa del proyecto (dominios, §2, rutas HTTP, comandos):** [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md) — complemento navegable de [`AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md).

**Antes de trabajar:** Leer [`../AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) (§0 visión PANELSIM, §0.1 arranque, §2 matriz), `docs/team/SESSION-WORKSPACE-CRM.md` §5, y **para alcance total** el KB anterior.

**Salidas típicas:** Cotizaciones vía API o código; texto listo para cliente; links a PDF; listados de preguntas ML; borradores de respuesta; reportes `PANELSIM-SHEETS-SITUATION-*.md` cuando aplique; nunca inventar sheet IDs ni secretos.

**Handoffs:** Consume artefactos de Mapping, Calc, Contract, GPT/Cloud, Integrations; no sustituye esos roles.

**Correo (repo aparte):** Si el workspace incluye el repo `conexion-cuentas-email-agentes-bmc`, para “actualizame sobre mis correos” el agente debe ejecutar ahí `npm run panelsim-update`, luego leer `data/reports/PANELSIM-ULTIMO-REPORTE.md`. Prompt y prerequisitos: en ese repo, `docs/PANELSIM-EMAIL-PROMPT.md`.
