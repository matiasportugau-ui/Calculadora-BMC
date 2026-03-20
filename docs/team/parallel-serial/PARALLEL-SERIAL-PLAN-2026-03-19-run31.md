# Parallel / Serial — RUN 2026-03-19 / run31

**Contexto:** **Invoque full team** posterior al paquete **AUTOPILOT Runs 24–30**. Objetivo: **serie** de verificación y documentación sin asumir acciones humanas (Sheets, push remoto) ya completadas.

## Decisión

| Modo | Alcance |
|------|---------|
| **Serie** | CI local → artefactos equipo (MATPROMT, REPORT, JUDGE, REPO-SYNC) → actualización PROMPT/STATE/CHANGELOG/service-map. |
| **Paralelo** | Opcional: lectura handoff presupuesto libre mientras corre `npm test` (mismo desarrollador). |

## Orden recomendado

1. `npm run lint` → `npm test` (gate).  
2. Redactar **REPORT** + **JUDGE** con evidencia numérica (119 tests).  
3. **Repo Sync** — inventario `git status`; **no** incluir paths anidados sospechosos sin auditoría.  
4. Cerrar **paso 9**: sección «Próximos prompts run32+» en PROMPT.

## Notas Judge / Parallel

- **Scores:** favorecen **claridad** y **honestidad** sobre pendientes manuales; no penalizar Sheets N/A.  
- **Siguiente run:** si se necesita paralelizar **Calc + Mapping**, declararlo explícitamente en run32 MATPROMT.
