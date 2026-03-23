# PANELSIM / SIM — carpeta del agente (Cursor)

Todo lo que sigue al **Agente Simulador (SIM)** y **PANELSIM** (mismo rol), más **SIM-REV** y artefactos de **MATPROMT** tema SIM, vive bajo `docs/team/panelsim/`. Así se actualiza un solo lugar al evolucionar el agente comercial/operativo BMC.

## Jerarquía rápida

| Ruta | Contenido |
|------|-----------|
| [`AGENT-SIMULATOR-SIM.md`](./AGENT-SIMULATOR-SIM.md) | **Canónico:** identidad, límites, matriz de conexiones, SIM-REV, invocaciones. **Empezar aquí.** |
| [`knowledge/`](./knowledge/) | Atajo `SIM.md`, índice completo `PANELSIM-FULL-PROJECT-KB.md`, `SIM-REV.md`. |
| [`matprompt/`](./matprompt/) | Plantillas MATPROMT (tema SIM, handoff PANELSIM). |
| [`reports/`](./reports/) | Informes de situación Sheets, run KB, y futuros `SIM-REV-REVIEW-*.md`. |
| Skill (repo raíz) | **Correo multi-cuenta IMAP:** [`.cursor/skills/panelsim-email-inbox/`](../../../.cursor/skills/panelsim-email-inbox/) — procedimiento cerrado para `npm run panelsim-update` en el repo hermano `conexion-cuentas-email-agentes-bmc`, variable opcional `BMC_EMAIL_INBOX_REPO` en `.env` de Calculadora-BMC. |
| Workspace + correo | [EMAIL-WORKSPACE-SETUP.md](./EMAIL-WORKSPACE-SETUP.md) (`panelsim-email.code-workspace`), verificación chat [EMAIL-PANELSIM-CHAT-VERIFY.md](./EMAIL-PANELSIM-CHAT-VERIFY.md). |

## Mantenimiento

- **Cambios de identidad o reglas del agente:** editar solo `AGENT-SIMULATOR-SIM.md` (y una línea en `PROJECT-STATE.md` → Cambios recientes).
- **Cambios de alcance de API/rutas/comandos:** actualizar `knowledge/PANELSIM-FULL-PROJECT-KB.md` §6–§8 y, si aplica, §11.
- **Nuevos informes PANELSIM:** generar bajo `reports/` con el nombre acordado en el canónico.
- **Enlaces viejos** `docs/team/AGENT-SIMULATOR-SIM.md` o `docs/team/knowledge/SIM.md`: quedan **stubs** que redirigen a esta carpeta.

## Referencias externas a esta carpeta

- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 (filas SIM / SIM-REV)
- `docs/team/PROJECT-STATE.md`
- `.cursor/agents/bmc-dashboard-team-orchestrator.md` (paso 5h SIM-REV)
- `.cursor/agents/sim-reviewer-agent.md`
