# Fiscal — Ranking de criticidad del protocolo PROJECT-STATE

**Propósito:** El equipo definió un ranking de mayor a menor criticidad para los incumplimientos del protocolo "Cómo usar este archivo" en PROJECT-STATE. El Fiscal controla que no sucedan; si suceden, comunica a los miembros involucrados para que no pase de nuevo.

---

## Ranking de criticidad (mayor → menor)

### Crítico (nivel 1)

| Incumplimiento | Ejemplo concreto | Impacto | Control |
|----------------|------------------|---------|---------|
| **No actualizar "Cambios recientes" después de un cambio** | Mapping actualizó planilla-inventory pero no añadió fila en Cambios recientes | Otros no saben qué cambió; trabajo duplicado; handoffs rotos | Fiscal verifica que todo cambio relevante tenga fila |
| **No añadir a "Pendientes" o Log for [Agent] cuando un cambio afecta a otros** | Design añadió sección que consume /api/X pero no notificó a Mapping | Los afectados no actúan; drift; rework | Fiscal verifica tabla de propagación §4 |

### Alto (nivel 2)

| Incumplimiento | Ejemplo concreto | Impacto | Control |
|----------------|------------------|---------|---------|
| **No leer "Cambios recientes" y "Pendientes" antes de trabajar** | Reporter genera plan sin saber que Networks documentó migración pendiente | Actúa con información obsoleta; rework | Fiscal observa si agentes citan estado actual |
| **No ejecutar sync cuando hay cambios que afectan a múltiples áreas** | Cambio en Sheets afecta Mapping, Design, Dependencies; no se ejecutó full team | Drift acumulado; descoordinación | Fiscal verifica si se ejecutó sync |

### Medio (nivel 3)

| Incumplimiento | Impacto | Control |
|----------------|---------|---------|
| **Fila en Cambios recientes incompleta** (sin "Afecta a", sin "Estado") | Menos trazabilidad; más difícil saber quién debe actuar | Fiscal revisa que las filas tengan Fecha, Área, Cambio, Afecta a, Estado |
| **No consultar tabla de propagación al hacer cambio** | No notifica a todos los afectados; algunos quedan desactualizados | Fiscal verifica que cambios en X tengan notificación a Y según §4 |

### Bajo (nivel 4)

| Incumplimiento | Impacto | Control |
|----------------|---------|---------|
| **Pendientes no marcados como resueltos** | Ruido; confusión menor; lista inflada | Fiscal sugiere limpiar Pendientes ya resueltos |
| **Resumen ejecutivo desactualizado** | Menor claridad; no bloquea | Fiscal puede proponer actualización |

---

## Protocolo del Fiscal cuando detecta incumplimiento

1. **Identificar** nivel de criticidad (Crítico, Alto, Medio, Bajo).
2. **Identificar** miembros involucrados (quién incumplió; quiénes fueron afectados).
3. **Comunicar** a los involucrados:
   - Qué ocurrió (incumplimiento específico).
   - Nivel de criticidad.
   - Acción correctiva: qué hacer para que no pase de nuevo.
4. **Reportar** al Orquestador si es Crítico o Alto (o si se repite).
5. **Documentar** en Cambios recientes si el incumplimiento generó corrección (opcional; evita reincidencia).

### Formato de comunicación a involucrados

```
Log for [Agent]:

Incumplimiento detectado (nivel [Crítico|Alto|Medio|Bajo]): [descripción].
Impacto: [breve].
Acción para que no pase de nuevo: [concreta].
```

---

## Referencias

- Protocolo "Cómo usar este archivo": `docs/team/PROJECT-STATE.md` (final del archivo).
- Tabla de propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4.
- Skill Fiscal: `.cursor/skills/bmc-dgi-impositivo/SKILL.md` (sección Team Oversight).

**Evolución:** El ranking y los incumplimientos pueden ajustarse si el dominio crece o cambia. Ver PROJECT-TEAM-FULL-COVERAGE §0.
