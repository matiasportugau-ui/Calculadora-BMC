# PANELSIM / SIM — carpeta del agente (Cursor)

Todo lo que sigue al **Agente Simulador (SIM)** y **PANELSIM** (mismo rol), más **SIM-REV** y artefactos de **MATPROMT** tema SIM, vive bajo `docs/team/panelsim/`. Así se actualiza un solo lugar al evolucionar el agente comercial/operativo BMC.

## Jerarquía rápida

| Ruta | Contenido |
|------|-----------|
| [`AGENT-SIMULATOR-SIM.md`](./AGENT-SIMULATOR-SIM.md) | **Canónico:** identidad, límites, matriz de conexiones, SIM-REV, invocaciones (**§5.1 proceso al invocar PANELSIM**). **Empezar aquí.** |
| [`PANELSIM-ARRANQUE-CAPACIDADES.md`](./PANELSIM-ARRANQUE-CAPACIDADES.md) | Informe: qué queda activo automáticamente al abrir Cursor y qué no (API, correo, Sheets, ML). |
| [`knowledge/`](./knowledge/) | Atajo `SIM.md`, índice completo `PANELSIM-FULL-PROJECT-KB.md`, `SIM-REV.md`. |
| [`matprompt/`](./matprompt/) | Plantillas MATPROMT (tema SIM, handoff PANELSIM). |
| [`reports/`](./reports/) | Informes de situación Sheets, run KB, y futuros `SIM-REV-REVIEW-*.md`. |
| OAuth Mercado Libre | [`docs/ML-OAUTH-SETUP.md`](../../ML-OAUTH-SETUP.md) — checklist portal, `.env`, `npm run ml:verify`, Cloud Run (`npm run ml:cloud-run`), GCS. |
| Skill (repo raíz) | **Correo multi-cuenta IMAP:** [`.cursor/skills/panelsim-email-inbox/`](../../../.cursor/skills/panelsim-email-inbox/) — procedimiento cerrado para `npm run panelsim-update` en el repo hermano `conexion-cuentas-email-agentes-bmc`, variable opcional `BMC_EMAIL_INBOX_REPO` en `.env` de Calculadora-BMC. |
| Workspace + correo | [EMAIL-WORKSPACE-SETUP.md](./EMAIL-WORKSPACE-SETUP.md) (`panelsim-email.code-workspace`), verificación chat [EMAIL-PANELSIM-CHAT-VERIFY.md](./EMAIL-PANELSIM-CHAT-VERIFY.md). |

## Invocación — proceso estándar (PANELSIM / Panelin en Cursor)

Al **invocar PANELSIM** para cotizar, verificar precios contra la **MATRIZ** o usar **`/api/*`**, el arranque puede ser:

- **Todo en uno:** `npm run panelsim:session` — planillas + correo + API (intento en background) + informe `reports/PANELSIM-SESSION-STATUS-*.md` (ver §5.1 opción A).

O **paso a paso:**

1. `npm run panelsim:env` — entorno planillas + credenciales + IDs (ver salida del script).
2. `npm run start:api` — API local para Sheets y `GET /api/actualizar-precios-calculadora`.

Detalle y excepciones (correo-only, sin credenciales): [`AGENT-SIMULATOR-SIM.md`](./AGENT-SIMULATOR-SIM.md) §5.1 y §0.1.

## Mantenimiento

- **Cambios de identidad o reglas del agente:** editar solo `AGENT-SIMULATOR-SIM.md` (y una línea en `PROJECT-STATE.md` → Cambios recientes).
- **Cambios de alcance de API/rutas/comandos:** actualizar `knowledge/PANELSIM-FULL-PROJECT-KB.md` §6–§8 y, si aplica, §11.
- **Nuevos informes PANELSIM:** generar bajo `reports/` con el nombre acordado en el canónico.
- **Enlaces viejos** `docs/team/AGENT-SIMULATOR-SIM.md` o `docs/team/knowledge/SIM.md`: quedan **stubs** que redirigen a esta carpeta.
- **Mercado Libre:** cambios de redirect o despliegue → actualizar [ML-OAUTH-SETUP.md](../../ML-OAUTH-SETUP.md) si el flujo cambia; sincronizar vars con `npm run ml:cloud-run` en producción.

## Referencias externas a esta carpeta

- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 (filas SIM / SIM-REV)
- `docs/team/PROJECT-STATE.md`
- `.cursor/agents/bmc-dashboard-team-orchestrator.md` (paso 5h SIM-REV)
- `.cursor/agents/sim-reviewer-agent.md`
