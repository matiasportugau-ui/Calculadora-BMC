# Prompt para invocar al Equipo completo (input de cada run)

**Uso:** Al decir **"Equipo completo"** o **"Invoque full team"**, usa este documento como **input del run**. Ejecuta la secuencia normal (pasos 0–8) y además el **ciclo de mejoras** (paso 9) con los prompts abajo. Al terminar, actualiza el backlog y la sección "Próximos prompts" para el siguiente run, hasta que todos los agentes estén completamente desarrollados.

---

## Instrucción para el Orquestador (cada run)

1. **Leer** `docs/team/PROJECT-STATE.md`, `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md` y este archivo.
2. **Ejecutar** pasos 0 → 0b → 1 → 2 → … → 8 como siempre (full team run).
3. **Paso 9 — Ciclo de mejoras:** Ejecutar en este run los **Próximos prompts** listados abajo. Cada prompt se asigna al rol correspondiente; ese rol ejecuta la tarea y entrega el artefacto. El Orquestador verifica y actualiza `IMPROVEMENT-BACKLOG-BY-AGENT.md` (marcar ✓).
4. **Al final del run:** Actualizar la sección **"Próximos prompts"** de este mismo archivo con los siguientes prompts pendientes (según backlog), para que el próximo "Equipo completo" continúe. Si ya todos los agentes están desarrollados, escribir: "Todos los agentes están completamente desarrollados. Solo mantenimiento (actualizar knowledge cuando cambie el dominio)."

---

## Próximos prompts (ejecutar en este run)

**Run 2026-03-16:** Design, Dependencies, Reporter, Orchestrator, Mapping — ✓ completados.

---

## Próximos prompts para el siguiente run (actualizar al final)

**Run 2026-03-16 (go):** Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync, Sheets Structure — ✓ completados.

**Todos los 19 agentes están completamente desarrollados.** Solo mantenimiento: actualizar knowledge cuando cambie el dominio; completar reference.md y examples.md donde falten.

---

## Referencias

- Backlog: `docs/team/IMPROVEMENT-BACKLOG-BY-AGENT.md`
- Criterio desarrollado: tabla en ese mismo doc
- Knowledge: `docs/team/knowledge/README.md`, plantilla `knowledge/Mapping.md`
- Análisis: `docs/team/FULL-TEAM-IMPROVEMENT-ANALYSIS.md`
