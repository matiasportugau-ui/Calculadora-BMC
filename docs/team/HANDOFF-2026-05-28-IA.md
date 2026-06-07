# Handoff — Esfuerzo IA / Centralización de Proveedores (2026-05-28)

**Fecha**: 2026-05-28 (sesión de continuación)
**Rama**: main
**Contexto**: Respuesta al "Resumen Ejecutivo" de progreso en calidad de training + funcionalidad del agente.

## Trabajo Realizado

### Análisis inicial
- Se verificó el estado real del proyecto contra lo planteado en el Resumen Ejecutivo.
- Confirmación: Las 3 prioridades altas siguen **vigentes**.
- `aiProviderConfig.js` ya existía y estaba bien diseñado, pero su adopción era parcial.

### Ejecución (Opción A)
- Migración completa de hardcodes en `server/routes/bmcDashboard.js`.
- Antes: 23 literales (`claude-haiku-4-5-20251001`, `gpt-4o-mini`, `grok-3-mini`, `gemini-2.0-flash`).
- Después: 0 hardcodes.
- Ahora usa consistentemente `resolveModel(p, undefined, true)` en:
  - ai_suggest_response
  - ai_draft_outbound
  - 3 bloques de extracción JSON estructurada (CRM)

**Archivos modificados**:
- `server/routes/bmcDashboard.js` (migración)
- `docs/team/PROJECT-STATE.md` (registro honesto del estado + progreso)

**Validaciones**:
- `node --check server/routes/bmcDashboard.js` → OK
- ESLint reportó issues de formato pre-existentes (no introducidos por esta sesión)

## Estado Actual del Esfuerzo de IA

**Completado en esta sesión**:
- Centralización de modelos en bmcDashboard (el punto más doloroso).

**Todavía pendiente (alta prioridad)**:
1. Agregar `logAiCall` + `estimateCostUSD` en:
   - `wolfboard.js`
   - `superAgent.js`
   - Bloques de extracción JSON en `bmcDashboard.js` (actualmente no reportan costo)
2. Enriquecer el prompt del tool `recuperar_casos_similares` (hacerlo más proactivo).
3. Actualizar `docs/AI-INTEGRATION-CALCULADORA.md` (última revisión abril 2026).

## Uncommitted Changes Relevantes (al cierre)

Muchos cambios pre-existentes (trabajo PDF + sesiones anteriores). Los directamente relacionados con esta sesión:
- `M server/routes/bmcDashboard.js`
- `M docs/team/PROJECT-STATE.md`

**Nota importante**: `server/lib/aiProviderConfig.js` aparece como `??` (untracked). El módulo central fue creado en sesión previa y aún no está commiteado.

## Recomendación de Próximos Pasos

1. **Inmediato**: Agregar observabilidad de costo en wolfboard y superAgent (alto valor de visibilidad).
2. Mejorar el tool RAG (`recuperar_casos_similares`).
3. Hacer commit limpio de `aiProviderConfig.js` + migración de bmcDashboard (después de gate:local).

## Literal Next Prompt para Reanudar

"Lee docs/team/HANDOFF-2026-05-28-IA.md y docs/team/PROJECT-STATE.md (entrada IA del 28-05). Contexto: Opción A completada (migración total de hardcodes en bmcDashboard a aiProviderConfig). Siguen pendientes: logging de costo en wolfboard/superAgent y mejora del tool RAG. Continúa con la siguiente prioridad alta bajo feature freeze. Sigue AGENTS.md."

## Recordatorio de Freeze

Feature freeze de 10 días hábiles activo (hasta ~11 junio 2026). Este tipo de trabajo (mantenibilidad + observabilidad) está explícitamente permitido.

---
Sesión cerrada de forma ordenada.