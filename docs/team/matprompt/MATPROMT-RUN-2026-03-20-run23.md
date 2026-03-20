# MATPROMT — RUN 2026-03-20 / run23 (fusión)

**Objetivo:** Unificar en un solo run el cierre **documental run 22** (propagate & synchronize) con la **implementación Presupuesto libre** en `PanelinCalculadoraV3.jsx`.

**Artefactos enlazados:**  
`judge/JUDGE-REPORT-RUN-2026-03-20-run23.md` · `parallel-serial/PARALLEL-SERIAL-PLAN-2026-03-20-run23.md` · `reports/REPORT-SOLUTION-CODING-2026-03-20-full-team-implement.md` · `reports/REPORT-SOLUTION-CODING-2026-03-20-run22.md` · `plans/NEXT-STEPS-RUN-23-2026-03-20.md`

---

## Resumen ejecutivo (3–5 líneas)

1. Run 22 dejó estado y propagación §4 actualizados sin código de app.  
2. Run 23 añade código: escenario `presupuesto_libre` con acordeones, `calcPresupuestoLibre`, BOM por grupos, PDF/WhatsApp.  
3. Verificación local: `npm test` 115 passed; `npm run lint` 0 errores en `src/`.  
4. Pendientes heredados: push Repo Sync, tabs/triggers, E2E, opcional acotar catálogo tornillería.

## Objetivos del usuario / agenda

- Tener **un solo run numerado (23)** con Judge + MATPROMT + Parallel/Serial alineados.  
- No duplicar narrativa: run22 = base; run23 = base + Presupuesto libre V3.

## Roles N/A este run

- **Sheets Structure:** sin edición planilla (solo recordatorio tabs/triggers).  
- **GPT/Cloud:** sin cambio OpenAPI/Actions en esta fusión.

## Orden (Parallel/Serial)

- **Serie:** Reporter (sintético) → Calc (código) → Judge → actualizar HISTORICO + MATPROMT guía + PROMPT.  
- **Paralelo permitido:** lectura Quantum doc §5 (run22) mientras se valida V3 localmente.

---

## Prompts orientadores breves por rol

### Orchestrator
- **Hacer:** Registrar run23 en PROJECT-STATE; enlace Judge + MATPROMT + PLAN.  
- **Entrega:** Paso 9 PROMPT con «próximo run» = push + E2E + tabs.

### MATPROMT (autoprompt)
- **Hacer:** Mantener `MATPROMT-FULL-RUN-PROMPTS.md` histórico con fila run23.  
- **DELTA:** Si Matias pide solo `PRESUPUESTO_LIBRE_IDS` en UI, prompt corto a Calc + Mapping.

### Calc / Design
- **Hecho:** Presupuesto libre V3.  
- **Seguimiento:** backup.jsx / filtro SKUs si aplica.

### Mapping
- **Hacer:** Validar col.D MATRIZ vs `PRESUPUESTO_LIBRE_IDS` cuando negocio confirme.

### Repo Sync
- **Hacer:** Cerrar gap «push verificado» del run22 en el próximo bloque manual.

### Judge
- **Entrega:** `JUDGE-REPORT-RUN-2026-03-20-run23.md`; promedio ~4.7/5 orientativo.

### Parallel/Serial
- **Entrega:** `PARALLEL-SERIAL-PLAN-2026-03-20-run23.md`.

### DELTA — (solo si aplica)
- **Disparador:** Usuario pide catálogo tornillería acotado.  
- **Roles:** Calc (UI), Mapping (MATRIZ), Reporter (nota PROJECT-STATE).
