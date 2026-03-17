# Knowledge — Contract (Contrato)

Rol: API Contract Validator. Skill: `bmc-api-contract-validator`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/google-sheets-module/planilla-inventory.md` — contrato canónico.
- `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` — campos esperados por UI.
- Si existe: `scripts/validate-api-contracts.js`.

---

## Salidas (qué produce)

- **Reporte pass/fail** por endpoint.
- **Campos faltantes o inesperados** vs contrato canónico.
- **Notificación** a Mapping y Design si detecta drift.

---

## Convenciones

- **Contrato canónico** definido por Mapa (planilla-inventory, DASHBOARD-INTERFACE-MAP).
- **Pre-deploy:** Validar antes de que la UI falle.
- **503 skip:** kpi-financiero puede retornar 503 si Sheets no disponible; no fallar por eso.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Drift detectado | Mapping, Design | Log for [Agent]; listar campos faltantes/inesperados. |
| Pre-deploy OK | Orquestador | Reporte pass. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Contract)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-api-contract-validator/SKILL.md`
