# ADR-001 — Presupuesto libre: backup (canónico) vs V3

**Estado:** Aceptado  
**Fecha:** 2026-03-20  
**Run:** 35 (Presupuesto libre / canónico)

---

## Contexto

El escenario **Presupuesto libre** está implementado en dos componentes:

- **`PanelinCalculadoraV3.jsx`** — App canónica: acordeones completos, estado libre persistido (snapshot, Drive, projectFile), categorías BOM (incl. TORNILLERÍA, EXTRAORDINARIOS), mismo motor que V3.
- **`PanelinCalculadoraV3.jsx`** — Versión standalone: usa el mismo motor (`presupuestoLibreCatalogo.js`) con catálogo de precios **inline** (archivo autónomo, sin depender de Config/cargar MATRIZ).

Ambos comparten: `src/utils/presupuestoLibreCatalogo.js`, `server/routes/calc.js` (`POST /calc/cotizar/presupuesto-libre`), OpenAPI y constants (CATEGORIAS_BOM, FIJACIONES).

---

## Decisión

- **App canónica para Presupuesto libre:** se considera **`PanelinCalculadoraV3.jsx`**. Es la UI de referencia con flujo completo (persistencia, Drive, categorías, acordeones).
- **V3 standalone:** se mantiene como variante con datos inline; no se exige paridad total de UI (acordeones/toggles) con backup. Paridad funcional del **motor** y de la **API** ya está garantizada.
- **PRESUPUESTO_LIBRE_IDS:** opcional a futuro para acotar tornillería/herrajes en el catálogo libre; no bloqueante para este run. Si se implementa, documentar en constants o en este ADR.

---

## Consecuencias

- Tests (`npm test` → 119 passed) y API presupuesto-libre siguen siendo la validación de regresión.
- Cambios de comportamiento del presupuesto libre se hacen en el motor o en backup; V3 puede seguir recibiendo mejoras de motor vía imports.
- Referencia: `docs/team/HANDOFF-NEXT-AGENT-PRESUPUESTO-LIBRE-2026-03-20.md`, `docs/team/reports/RUN-ROADMAP-FORWARD-2026.md` run35.
