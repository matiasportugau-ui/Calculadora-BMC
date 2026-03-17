# BMC Team Judge — Reference

## Sistema de ranqueo

### Escala por área (1–5)

| Puntuación | Significado |
|------------|-------------|
| 5 | Excelente — Cumple o supera criterios; entregable completo; impacto claro; evolución visible |
| 4 | Bueno — Cumple criterios; entregable completo con pequeños ajustes |
| 3 | Aceptable — Cumple parcialmente; entregable con gaps o retrasos menores |
| 2 | Mejorable — Gaps significativos; entregable incompleto o inconsistente |
| 1 | Crítico — No cumple; entregable ausente o erróneo; bloquea a otros |

### Áreas por tipo de agente

| Tipo | Áreas a ranquear |
|------|-------------------|
| **Mapping / Data** | Completitud del mapeo, actualización de artefactos, cross-reference |
| **Design / UI** | UX/UI, jerarquía, estados loading/error, time-saving |
| **Infra / Networks** | Documentación, endpoints, migración, riesgos |
| **Integraciones** | OAuth, webhooks, sync, documentación |
| **Reporting** | Claridad, handoffs, aceptación |
| **Audit / Debug** | Cobertura, hallazgos, acciones |
| **Fiscal / Billing** | Detección, reporte, mitigación |
| **Orquestación** | Orden, handoffs, inclusión de todos |
| **Contract / Security** | Validación, drift, cobertura |

---

## Formato reporte por run

```markdown
# Judge Report — Run YYYY-MM-DD

**Run:** [Full team run / Sync / Otro]
**Fecha:** YYYY-MM-DD

## Resumen ejecutivo

1–2 párrafos: cómo fue el run, principales hallazgos, agentes destacados, áreas de mejora.

## Ranking por agente (este run)

| Rol | Área 1 | Área 2 | Área 3 | Promedio | Observación |
|-----|--------|--------|--------|----------|-------------|
| Mapping | 4 | 5 | 4 | 4.3 | Planilla map actualizado |
| Design | 4 | 4 | 3 | 3.7 | Loading states pendientes |
| ... | | | | | |

## Oportunidades de evolución

- [Rol]: [sugerencia concreta]
- [Rol]: [sugerencia concreta]

## Próximo run

Recomendaciones para el siguiente run.
```

---

## Formato reporte histórico

```markdown
# Judge Report — Histórico

**Última actualización:** YYYY-MM-DD

## Promedio por agente (todos los runs)

| Rol | Promedio | Runs | Tendencia | Última evolución |
|-----|----------|------|-----------|------------------|
| Mapping | 4.2 | 12 | ↑ | +0.3 vs run anterior |
| Design | 3.8 | 12 | → | Estable |
| ... | | | | |

## Tendencias

- Evolución general: [sube / estable / baja]
- Agentes con mayor mejora: [lista]
- Áreas que requieren atención: [lista]
```

---

## Integración con full team run

El Juez ejecuta **después** del Implementation Plan & Reporter:

```
... → 5. Implementation Plan & Reporter
    → 6. Judge (evaluación y ranqueo)
    → 7. Update PROJECT-STATE
```

O de forma independiente: "Evaluar equipo" / "Reporte del Juez".
