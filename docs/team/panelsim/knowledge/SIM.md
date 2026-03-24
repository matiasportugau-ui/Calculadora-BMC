# Knowledge — SIM / PANELSIM (atajo)

**Fuente única de identidad y reglas:** [`../AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) (§0–§2). **SIM** = **PANELSIM** (mismo rol).

**Índice amplio del repo** (dominios, §2, rutas, skills): [`PANELSIM-FULL-PROJECT-KB.md`](./PANELSIM-FULL-PROJECT-KB.md).

**Antes de trabajar:** `AGENT-SIMULATOR-SIM.md` §0.1 → `SESSION-WORKSPACE-CRM.md` §5 → `PROJECT-STATE.md`; usar el KB solo cuando haga falta buscar por tema. **Planillas + MATRIZ (precios):** `npm run panelsim:env` en la raíz de Calculadora-BMC, luego `npm run start:api` y rutas `/api/*` (ver canónico §0.1 paso 3).

**Salidas / límites:** Ver canónico §0 (nunca inventar sheet IDs ni secretos; ML modo aprobación por defecto).

**Handoffs:** Consume artefactos de Mapping, Calc, Contract, GPT/Cloud, Integrations; no sustituye esos roles.

**Correo (repo aparte):** Skill **`.cursor/skills/panelsim-email-inbox/`** — procedimiento completo (ruta vía workspace, carpeta hermana de Calculadora-BMC, o `BMC_EMAIL_INBOX_REPO` en `.env` raíz). Luego `npm run panelsim-update` en ese repo y leer `data/reports/PANELSIM-ULTIMO-REPORTE.md`. Duplicado: `conexion-cuentas-email-agentes-bmc/docs/PANELSIM-EMAIL-PROMPT.md`.
