# Knowledge — Calc (Calculadora Specialist)

Rol: Calculadora Specialist. Skill: `bmc-calculadora-specialist`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/google-sheets-module/planilla-inventory.md` — Master_Cotizaciones, CRM_Operativo.
- `src/utils/calculations.js`, `helpers.js`, constants — lógica de cálculo.
- Si existe: `tests/validation.js`.

---

## Salidas (qué produce)

- **Cambios en precios, BOM, paneles** (techo, pared).
- **Integración Drive** — guardar/cargar presupuestos.
- **PDF, export WhatsApp** — flujo de cotización.
- **Tests** — ejecutar `tests/validation.js` tras cambios en cálculos.

---

## Convenciones

- **Puerto 5173** — Calculadora canónica.
- **Coordinar con Mapping** si hay cambios en Sheets para cotizaciones.
- **Coordinar con Design** si hay cambios de UI en la Calculadora.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios en planilla cotizaciones | Mapping | Log for Mapping. |
| Cambios en UI Calculadora | Design | Log for Design. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Calc)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-calculadora-specialist/SKILL.md`
