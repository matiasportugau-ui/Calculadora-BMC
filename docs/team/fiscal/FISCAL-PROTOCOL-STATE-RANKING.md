# Fiscal — Ranking de criticidad del protocolo PROJECT-STATE

**Propósito:** El equipo definió un ranking de mayor a menor criticidad para los incumplimientos del protocolo "Cómo usar este archivo" en PROJECT-STATE. El Fiscal controla que no sucedan; si suceden, comunica a los miembros involucrados para que no pase de nuevo.

---

## Ranking de criticidad (mayor → menor)

### Crítico (nivel 1)

| Incumplimiento | Impacto | Control |
|----------------|---------|---------|
| **No actualizar "Cambios recientes" después de un cambio** | Otros no saben qué cambió; trabajo duplicado; handoffs rotos; bloqueos en cadena | Fiscal verifica que todo cambio relevante tenga fila en Cambios recientes |
| **No añadir a "Pendientes" o Log for [Agent] cuando un cambio afecta a otros** | Los afectados no actúan; drift; trabajo desalineado; rework | Fiscal verifica tabla de propagación §4; si cambio afecta a X, debe haber Pendiente o Log for X |

### Alto (nivel 2)

| Incumplimiento | Impacto | Control |
|----------------|---------|---------|
| **No leer "Cambios recientes" y "Pendientes" antes de trabajar** | Actúa con información obsoleta; puede rehacer trabajo o chocar con cambios recientes | Fiscal observa si agentes citan estado actual al iniciar; si no, incumplimiento |
| **No ejecutar sync cuando hay cambios que afectan a múltiples áreas** | Drift acumulado; estado desactualizado; descoordinación | Fiscal verifica si tras cambios multi-área se ejecutó "Sync project state" o full team run |

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
