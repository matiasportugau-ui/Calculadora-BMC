# Resolución de preguntas abiertas — Plan de mapping

**Propósito:** Este documento responde las preguntas abiertas del review del plan de mapping. Cada pregunta se explica en lenguaje claro, se ofrecen opciones concretas y se recomienda la mejor para aprobar.

---

## Pregunta 1: ¿Dónde vive el inventario actual vs el diff blueprint?

### Qué significa

Hoy el plan usa **el mismo archivo** (`planilla-map.md`) para dos cosas distintas:

1. **Inventario en vivo (Strand 1):** Lista de tabs que existen ahora, columnas, qué API usa cada uno. Es un “estado actual real” del workbook.
2. **Diff vs blueprint (Strand 3 / §9):** Comparación entre lo que hay hoy y lo que pide SHEET-ARCHITECTURE-BLUEPRINT-V2. Sirve para el checklist de mejoras de estructura.

Si Strand 1 escribe el inventario en `planilla-map.md`, Strand 3 pierde el lugar donde hacer el diff. Si Strand 3 escribe el diff ahí, Strand 1 pierde el lugar del inventario. **Colisión de artefactos.**

### Opciones

| Opción | Descripción | Pros | Contras |
|-------|-------------|------|---------|
| **A. Un solo archivo** | Mantener `planilla-map.md` para ambas cosas (inventario + diff en secciones distintas) | Un solo archivo, menos dispersión | Se mezclan dos propósitos; el diff puede pisar el inventario o viceversa |
| **B. Dos archivos separados** | Inventario en un archivo, diff en otro | Responsabilidades claras; Strand 1 y 3 no se pisan | Más archivos que mantener |
| **C. Inventario nuevo + planilla-map = diff** | Crear `planilla-inventory.md` para inventario; dejar `planilla-map.md` solo para diff/checklist | Coherente con README actual (planilla-map = diff); inventario tiene su propio espacio | Hay que actualizar referencias en el plan |

### Recomendación: **Opción C**

- El README ya define `planilla-map.md` como “diff actual vs blueprint”.
- El inventario en vivo es un artefacto distinto: describe el estado actual; el diff compara ese estado con el blueprint.
- Flujo: Strand 1 escribe `planilla-inventory.md` (inventario). Strand 3 lee ese inventario y produce `planilla-map.md` (diff + checklist).

**Cambios concretos:**

- Crear `docs/google-sheets-module/planilla-inventory.md` para el inventario en vivo (Strand 1).
- Mantener `docs/google-sheets-module/planilla-map.md` solo para diff vs blueprint y checklist (Strand 3).
- Actualizar PLAN-PROPOSAL §4 y §9 para reflejar esto.

---

## Pregunta 2: ¿El cross-reference debe incluir un campo de estado?

### Qué significa

El cross-reference relaciona: **Planilla/tab** ↔ **Dashboard section/block** ↔ **API route**.

Hoy no dice si cada elemento está:

- **live** — en uso real
- **conditional** — depende del schema (ej. Pagos_Pendientes solo si el workbook tiene esa tab)
- **placeholder** — UI existe pero sin datos reales (ej. Ventas 2.0, Invoque Panelin)
- **blueprint-only** — planeado en el blueprint pero no implementado

Sin eso, “¿dónde está X?” puede ser ambiguo: ¿existe hoy o es futuro?

### Opciones

| Opción | Descripción | Pros | Contras |
|-------|-------------|------|---------|
| **A. Sin estado** | Cross-reference solo con tab ↔ block ↔ API | Más simple | No se distingue live vs placeholder vs blueprint |
| **B. Estado por fila** | Cada fila del cross-reference tiene columna `Estado` (live | conditional | placeholder | blueprint-only) | Clara distinción; evita malentendidos | Un poco más de trabajo al mapear |
| **C. Estado solo para tabs** | Estado solo en la parte planilla; dashboard/API sin estado | Menos columnas | Menos información para bloques de UI y rutas |

### Recomendación: **Opción B**

- El dato clave ya dice que Pagos_Pendientes y Metas_Ventas no deben asumirse listos.
- Ventas 2.0 e Invoque Panelin son placeholders.
- Un campo `Estado` evita que el agente de mapeo o el de UI traten todo como “live”.

**Valores sugeridos:**

| Estado | Significado |
|--------|-------------|
| `live` | En uso hoy con datos reales |
| `conditional` | Depende de schema o tab (verificar en planilla-inventory) |
| `placeholder` | UI existe, datos no conectados o mock |
| `blueprint-only` | Planeado en blueprint, no implementado |

---

## Pregunta 3: ¿“Localhost usage” debe ser verificado en runtime o solo documentado?

### Qué significa

El plan pide documentar “funcionalidad y forma de uso en localhost” (puertos 3001, 5173, 3849). La duda es:

- **Solo documentación:** El agente lee código, IA.md, DASHBOARD-VISUAL-MAP, etc., y escribe la descripción.
- **Verificado en runtime:** El agente (o alguien) levanta los servidores, navega, y confirma que lo documentado coincide con lo que pasa en pantalla.

### Opciones

| Opción | Descripción | Pros | Contras |
|-------|-------------|------|---------|
| **A. Solo documentación** | Derivar de código y docs; no ejecutar | Rápido, no requiere entorno | Puede quedar desactualizado si el código cambió |
| **B. Verificación obligatoria** | Ejecutar 3001, 3849, 5173 y verificar antes de cerrar el map | Alta confiabilidad | Requiere entorno listo, más tiempo |
| **C. Híbrido** | Documentar primero; marcar “verificado” solo si se ejecutó | Flexibilidad; se puede iterar | Hay que mantener la marca “verificado” vs “doc-only” |

### Recomendación: **Opción C (híbrido)**

- El mapping debe poder hacerse aunque el entorno no esté listo.
- Cuando el entorno esté disponible, se puede añadir una verificación explícita.

**Implementación:**

- El agente produce la documentación de localhost usage a partir de código y docs.
- Añadir en DASHBOARD-INTERFACE-MAP una sección “Verificación runtime” con tabla:

  | Page/Block | Puerto | Verificado (fecha) | Notas |
  |------------|--------|--------------------|-------|
  | /finanzas | 3001 | — | Pendiente |
  | /finanzas | 3849 | — | Pendiente |
  | Cotizaciones | 5173 | — | Pendiente |

- Cuando alguien verifique, se actualiza la tabla. Si no se verifica, queda claro que es “doc-only”.

---

## Pregunta 4: ¿El mapping debe clasificar tabs por disponibilidad real?

### Qué significa

El plan dice listar “todos los workbooks/tabs que el sistema usa”, pero no obliga a clasificarlos. En tu entorno:

- **CRM_Operativo** está activo (schema actual).
- **Pagos_Pendientes** y **Metas_Ventas** el código los usa, pero pueden no existir en el workbook actual.
- Hay tabs del blueprint que aún no existen.

Sin clasificación, todo parece “en uso” y se pueden tomar decisiones incorrectas.

### Opciones

| Opción | Descripción | Pros | Contras |
|-------|-------------|------|---------|
| **A. Sin clasificación** | Solo listar tabs | Más simple | No se distingue qué está disponible hoy |
| **B. Clasificación obligatoria** | Cada tab tiene: active_now \| conditional \| optional \| blueprint-only | Clara distinción; evita asumir tabs inexistentes | Requiere que el agente verifique (Sheets API o planilla-inventory) |
| **C. Clasificación por schema** | Clasificar por schema (CRM_Operativo vs Master_Cotizaciones) y marcar qué tabs son opcionales | Alineado con bmcDashboard.js | Puede no cubrir todos los casos (ej. tabs del blueprint) |

### Recomendación: **Opción B**

- Coherente con el dato clave y con el campo `Estado` del cross-reference.
- El planilla-inventory debe incluir, por cada tab:

  | Tab | Estado | Schema(s) | Notas |
  |-----|--------|-----------|-------|
  | CRM_Operativo | active_now | CRM_Operativo | Fuente principal hoy |
  | Pagos_Pendientes | conditional | — | Verificar si existe en workbook |
  | Metas_Ventas | conditional | — | Verificar si existe en workbook |
  | AUDIT_LOG | conditional | CRM_Operativo | Puede no existir en CRM |
  | Parametros | active_now | CRM_Operativo | Si existe |
  | Motor_IA | blueprint-only | — | Del blueprint, no implementado |

**Valores sugeridos:**

- `active_now` — existe y se usa hoy
- `conditional` — el código lo usa pero la tab puede no existir (verificar)
- `optional` — existe pero no es crítica (degradación limpia)
- `blueprint-only` — planeado, no implementado

---

## Resumen de decisiones para aprobar

| # | Pregunta | Decisión recomendada |
|---|-----------|------------------------|
| 1 | Ubicación inventario vs diff | **C:** `planilla-inventory.md` (inventario) + `planilla-map.md` (diff/checklist) |
| 2 | Estado en cross-reference | **B:** Columna `Estado` (live \| conditional \| placeholder \| blueprint-only) |
| 3 | Localhost usage | **C:** Documentar primero; sección “Verificación runtime” opcional |
| 4 | Clasificación de tabs | **B:** Clasificación obligatoria en planilla-inventory (active_now \| conditional \| optional \| blueprint-only) |

---

## Próximos pasos

1. **Aprobar** estas decisiones (o indicar cambios).
2. **Actualizar** PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md y el Implementation Plan con:
   - Rutas de artefactos (planilla-inventory.md vs planilla-map.md)
   - Requisito de clasificación de tabs
   - Requisito de campo Estado en cross-reference
   - Sección de verificación runtime en DASHBOARD-INTERFACE-MAP
3. **Ejecutar** Strand 1 con estas reglas.

---

**Autor:** Cursor Agent (interface/UX role)  
**Fecha:** 2025-03-15  
**Contexto:** Review de Implementation Plan y PLAN-PROPOSAL; cooperación con agente de mapping (Blue Pen).
