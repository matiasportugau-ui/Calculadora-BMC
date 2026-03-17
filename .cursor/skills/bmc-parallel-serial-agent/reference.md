# BMC Parallel/Serial Agent — Reference

## Criterios para paralelo vs serie

### Ejecutar en paralelo cuando

- Las tareas son **independientes** (no hay handoff directo entre ellas).
- Los agentes trabajan en **áreas distintas** sin superposición de artefactos.
- Hay **clones** disponibles (Mapping+1, Design+1) para distribuir carga.
- El objetivo es **reducir tiempo total** y las tareas no compiten por recursos críticos.

### Ejecutar en serie cuando

- Hay **handoff directo** (Mapping → Dependencies → Design).
- Una tarea **depende del output** de otra (planilla map antes de Design).
- Hay **riesgo de conflicto** si dos agentes editan el mismo artefacto.
- El orden está definido por **dependencies.md** o el plan vigente.

---

## Uso de scores (JUDGE-REPORT-HISTORICO)

- **Agentes con mejor score** en el área relevante: priorizar para esa tarea.
- **Tendencias:** Si un agente sube, considerarlo para tareas críticas.
- **Áreas de ranqueo:** Cruzar área de la tarea con áreas donde el agente rinde mejor.

---

## Ejemplo de plan de ejecución

```markdown
# Parallel/Serial Plan — YYYY-MM-DD

**Objetivo:** [descripción]

## Paralelo (ejecutar a la vez)
- Mapping+1: mapear tab Pagos_Pendientes
- Design+1: proponer UX para sección Metas
(No comparten artefactos; independientes)

## Serie (orden)
1. Mapping (planilla completa) → handoff
2. Dependencies (grafo) → handoff
3. Design (usa map + dependencies)

## Combinación recomendada
- Mapping (base) + Mapping+1 (Pagos_Pendientes en paralelo)
- Design (después de Dependencies)
- Justificación: Mapping 4.2 en Completitud; Design 3.8 en UX; Dependencies debe ir antes por handoff.
```

---

## Integración con Orquestador

El Orquestador puede invocar al Parallel/Serial Agent **antes** del full run para obtener el plan óptimo, o **durante** el run cuando hay ramas que permiten paralelización.
