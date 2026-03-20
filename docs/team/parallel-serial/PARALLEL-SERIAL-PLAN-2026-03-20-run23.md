# Parallel / Serial — RUN 2026-03-20 / run23 (fusión)

**Objetivo:** Orden de ejecución que combine **run 22 (documental)** con **implementación Presupuesto libre V3** sin contradicciones de estado.

## En serie (recomendado)

1. **Leer base run22** — PROJECT-STATE, REPO-SYNC run22, REPORT run22, MATPROMT propagate.  
2. **Implementar / verificar Calc** — `PanelinCalculadoraV3.jsx` + `npm run lint` + `npm test`.  
3. **Reporter** — `REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md` (+ actualización PROJECT-STATE).  
4. **Judge** — `JUDGE-REPORT-RUN-2026-03-20-run23.md`.  
5. **MATPROMT** — este archivo + fila histórico en `MATPROMT-FULL-RUN-PROMPTS.md`.  
6. **PROMPT equipo** — referencia run23 fusión en «Próximos prompts».

## En paralelo (no bloquean)

- Revisión §5 Quantum doc (propagación §4) mientras corre test suite local.  
- Lectura `NEXT-STEPS-RUN-23` (lockfile / audit) en paralelo al smoke UI **si** no toca mismos archivos que Calc.

## Combinación de agentes

- **Calc + Design:** mismo agente/código (UI coherente).  
- **Judge + MATPROMT:** documentación tras verde CI local.

## Justificación

El código depende de `constants.js` ya alineado (run previo); la narrativa run22 no requiere reordenar pasos 1–8 del orquestador, solo **añadir** entregable Calc y cerrar run23 con Judge unificado.
