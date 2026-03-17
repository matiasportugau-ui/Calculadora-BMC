# Knowledge — Billing (Cierre)

Rol: Billing Error Review. Skill: `billing-error-review`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- Exports CSV/XLS/XLSX — facturas, notas de crédito, estado de cobro/pago.
- Periodo de control (YYYY-MM) cuando aplique.
- Reglas internas de negocio y tolerancia de redondeo.

---

## Salidas (qué produce)

- **Reporte de errores:** Duplicados, matemática fiscal, estados de pago, fechas faltantes.
- **Evidencia por fila:** doc_key, fila fuente, regla violada.
- **Acciones recomendadas** para administración.
- **Pre-auditoría** de cierre mensual.

---

## Convenciones

- **No modificar** datos originales de facturación.
- **No borrar** documentos ni ejecutar cambios contables automáticos.
- **Separar** hechos verificados de hipótesis.
- **Salida accionable** para administración.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Errores que afectan datos | Mapping, Fiscal | Log for [Agent]; PROJECT-STATE. |
| Hallazgos pre-cierre | Orquestador | Reporte. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Billing)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/billing-error-review/SKILL.md`
