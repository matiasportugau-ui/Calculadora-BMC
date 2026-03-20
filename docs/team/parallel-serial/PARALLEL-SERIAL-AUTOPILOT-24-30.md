# Parallel / Serial — AUTOPILOT Runs 24–30

**Regla:** Por defecto **serie** (cada run desbloquea el siguiente en [SOLUCIONES-UNO-POR-UNO-2026-03-20.md](../plans/SOLUCIONES-UNO-POR-UNO-2026-03-20.md)).

## Serie global (24 → 30)

1. **Run 24** Git/push **antes** de asumir deploy como verdad.  
2. **Run 25** Smoke prod **antes** de culpar a Sheets por fallos.  
3. **Run 26** Sheets **después** de smoke (evita debug API fantasma).  
4. **Run 27** Calc backup/libre **en paralelo permitido** con documentación Mapping solo si **no** toca schema Sheets ese día.  
5. **Run 28** Audit force **en rama** — **nunca** en paralelo con merge urgente hotfix producción (serie: hotfix primero).  
6. **Run 29** SKUs/billing **después** de MATRIZ estable o con placeholder explícito.  
7. **Run 30** Síntesis **solo** cuando 24–29 estén ✓ o “bloqueado:” documentado.

## Paralelo explícito (seguro)

| Par | Tareas | Condición |
|-----|--------|-----------|
| A | Run 25 curl + Run 24 commit final polish | Misma persona; sin conflicto archivos. |
| B | Run 27 ADR escrito + Run 29 lista SKUs en Markdown | Sin cambio código simultáneo en mapping si no hay lock. |
| C | Judge draft + Reporter índice | Solo documentación. |

## Combinación desaconsejada

- **Run 26 (Sheets)** + **Run 28 (audit --force)** en la misma ventana sin freeze de `main` — alto riesgo de drift y rollback confuso.

## Entrega

Al cerrar **Run 30**, Parallel/Serial considera esta serie **plan maestro** hasta nueva orden; el siguiente PARALLEL-SERIAL puede ser “run31+” definido por Orchestrator según PROMPT.
