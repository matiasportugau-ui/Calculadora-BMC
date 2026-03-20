# Plan de implementación — Modernización «Vista previa del techo»

**Fecha:** 2026-03-19  
**Ámbito:** Calculadora BMC (React) — paso de dimensiones / zonas de techo.  
**Referencia de código actual:** `RoofPreview` y lógica de zonas en `src/components/PanelinCalculadoraV3_backup.jsx` (rectángulos sólidos, etiquetas `largo×ancho` en m); cálculos y modo metros/paneles en `src/utils/calculations.js` (`normalizarMedida`, `calcPanelesTecho`; `panel.au` = ancho útil del panel).

---

## 1. Objetivo de producto

Modernizar la **Vista previa del techo** para que:

1. **Dibuje paneles** como rejilla (tiras/módulos coherentes con el ancho útil `au` y el largo de cada zona), manteniendo las **mismas dimensiones en metros** que ya usa el motor de cotización.
2. Permita **reposicionar cada zona** arrastrándola en el lienzo (defasajes / volúmenes desalineados en planta), **sin cambiar** por defecto las cantidades del BOM hasta que se defina explícitamente otra regla de negocio.
3. Permita **ciclar el indicador visual de sentido de pendiente** por zona con **doble clic**: dirección A → dirección opuesta → oculto → (vuelta a A).
4. Mantenga accesible el flujo en **móvil** (touch), sin romper `RoofBorderSelector` ni export PDF/WhatsApp cuando aplique.

---

## 2. Criterios de aceptación (verificables)

| ID | Criterio |
|----|----------|
| AC-1 | Con `techoAnchoModo === "metros"` o `"paneles"`, el área mostrada por zona y el **total m²** coinciden con el cálculo actual (`largo * ancho` por zona en el estado ya normalizado). |
| AC-2 | La rejilla de paneles por zona usa `panel.au` del panel seleccionado (misma familia/espesor que la cotización): columnas según ancho en m; aristas/juntas visibles. |
| AC-3 | Cada zona se puede arrastrar dentro de un área de previsualización; posiciones persisten en **guardar proyecto** (`.bmc.json`) y al restaurar. |
| AC-4 | Doble clic (o doble tap con debounce) en una zona alterna: flecha en un sentido → sentido opuesto → sin indicador → ciclo. |
| AC-5 | Comportamiento por defecto al **primer render**: layout equivalente al actual (zonas alineadas en fila con separación escalada), si no hay datos de layout guardados. |
| AC-6 | `npm run lint` y `npm test` limpios; sin regresiones en `calcTechoCompleto` / merge de zonas. |

---

## 3. Modelo de datos propuesto

### 3.1 Extender `techo.zonas[]`

Cada elemento conserva `largo` y `ancho` como hoy (y el modo paneles/m ya resuelto en estado donde corresponda).

Añadir campos opcionales **solo para UI / documentación de planta**:

```js
// Por zona (índice estable con id si se reordena en el futuro)
{
  id: "z1",           // opcional; generar UUID corto al crear zona
  largo: 5,
  ancho: 3.36,
  preview: {
    // Posición en "metros de planta" respecto al origen del lienzo (recomendado)
    x: 0,
    y: 0,
    // Indicador visual de pendiente (no confundir con techo.pendiente en grados)
    slopeMark: "off" | "along_largo_pos" | "along_largo_neg"
    // along_largo_*: flecha según eje largo del rectángulo en vista planta
  }
}
```

**Reglas:**

- Si `preview` falta, el layout se **deriva** del algoritmo actual (posiciones automáticas).
- Las coordenadas `x,y` son **puramente visuales** para Fase 1: no entran en `calcPanelesTecho` salvo decisión explícita posterior.

### 3.2 Serialización

- Actualizar `src/utils/projectFile.js` (`serializeProject` / `deserializeProject`): merge profundo de `techo.zonas[].preview` con defaults.
- Versión de formato: evaluar bump de `FILE_FORMAT_VERSION` si se requiere migración; si los campos son opcionales, puede bastar compatibilidad hacia atrás sin bump.

---

## 4. Arquitectura técnica (componentes)

| Pieza | Responsabilidad |
|-------|-----------------|
| `RoofPreviewInteractive` (nuevo) o evolución de `RoofPreview` | SVG (o canvas): rejilla, drag, doble clic, labels `largo×ancho m`. |
| `buildZoneRects(zonas, tipoAguas, scale)` | Reutilizar lógica existente de escala y `dos_aguas` (mitad de ancho) para tamaños; añadir offset `preview.x/y`. |
| `drawPanelGrid(rect, largoM, anchoM, au)` | Particionar el rectángulo en **columnas** `ceil(anchoM/au)` (última columna recortada si aplica); líneas de junta en el eje largo. |
| `SlopeMark` | Subgrupo SVG: flecha vectorial centrada o junto al borde, rotación según eje largo y `slopeMark`. |

**Biblioteca:** Preferir SVG nativo + `pointerdown/move/up` y `react` state; evitar dependencia pesada salvo que haga falta multitouch complejo.

**Accesibilidad:** Leyenda breve «Arrastrá la zona · Doble clic: pendiente» + `aria` en controles si el bloque es focuable.

---

## 5. Fases de entrega

### Fase 0 — Inventario y ruta canónica (corta)

- Confirmar qué archivo exporta la calculadora en producción (`main.jsx` → `PanelinCalculadoraV3` vs `*_backup`).
- Unificar o extraer `RoofPreview` a `src/components/RoofPreview.jsx` para no duplicar (reducir drift).

### Fase 1 — Rejilla de paneles + dimensiones actuales

- Implementar `drawPanelGrid` alimentado por `techoPanelData` / dimensiones del panel activo (`au`).
- Mantener texto de zona como hoy; opcional: tooltip «N paneles ancho».

### Fase 2 — Persistencia de posición y drag

- Añadir `preview.x/y` con límites al rectángulo del “world” (bounding box dinámico o lienzo fijo con scroll).
- Sync: `onChange` hacia estado `techo` del padre (`updateZona` extendido).
- Reset: botón «Alinear de nuevo» (opcional UX).

### Fase 3 — Doble clic: carrusel de pendiente visual

- Implementar máquina de estados `off → pos → neg → off`.
- Cuidar conflicto con **doble clic nativo del navegador** (selección de texto); usar `preventDefault` donde haga falta o delegar en overlay.
- Touch: distinguir tap vs double-tap con umbral de tiempo.

### Fase 4 — Coherencia con `RoofBorderSelector`

- Reutilizar el mismo modelo `preview.x/y` y la misma escala **o** documentar que el selector de bordes sigue en “modo compacto alineado” hasta Fase 4b.
- Riesgo: dos fuentes de verdad visual — mitigar compartiendo util `zoneRectsFromState(techo, options)`.

### Fase 5 — QA, PDF y GPT (si aplica)

- Si la cotización PDF incluye captura de UI: decidir si se incluye snapshot de layout o solo texto.
- OpenAPI / payload de cotización: normalmente **no** requiere campos nuevos si el layout es solo UI; documentar en `docs/API-REFERENCE.md` si se expone.

---

## 6. Plan por rol (equipo completo — §2)

Referencias: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`.

| Rol | Entregables concretos |
|-----|------------------------|
| **Orchestrator** | Orden de fases; handoff Calc → Design → Contract/QA; cierre con PROJECT-STATE. |
| **MATPROMT** | Bundle corto por rol en `MATPROMT-FULL-RUN-PROMPTS.md` (delta): prompts de implementación Fase 1–4. |
| **Parallel/Serial** | Fase 0→1 secuencial; Fase 2 y 1 pueden solaparse **solo** si Fase 2 usa API estable de rectáculos; recomendación: **serie** 1→2→3→4 para reducir retrabajo. |
| **Calc** (`bmc-calculadora-specialist`) | Extraer/normalizar `RoofPreview`; extender `updateZona`; defaults de `preview`; tests en `tests/validation.js` para deserialización y áreas. |
| **Design** (`bmc-dashboard-design-best-practices`) | Estados hover/active al arrastrar, contraste de rejilla, microcopy español, touch targets ≥ 44px, modo claro consistente con tokens `C`. |
| **Dependencies** (`bmc-dependencies-service-mapper`) | Diagrama: `PanelinCalculadoraV3` → `RoofPreview` → `RoofBorderSelector` → `calculations.js` → `projectFile.js`; riesgo de divergencia de coordenadas. |
| **Reporter** (`bmc-implementation-plan-reporter`) | Resumen de sprint, riesgos, acceptance sign-off (este documento como fuente). |
| **Mapping** | Si en el futuro el layout vive en Sheets: mapeo columnas; **Fase 1 N/A** si no hay planilla. |
| **GPT/Cloud** | Solo si se envía layout al backend: revisar `openapi-calc.yaml` y acciones GPT; si no, marcar N/A. |
| **Contract** | Si hay nuevo endpoint (no previsto en Fase 1), validar contrato; si no, N/A. |
| **Security** | Sanitizar nada crítico (solo JSON local); N/A salvo exposición nueva de datos. |
| **Audit/Debug** | Smoke en 5173: drag + guardar + recargar; contrastes móvil. |
| **Judge** | Criterios: AC-1…AC-6 + tiempo de entrega por fase. |
| **Repo Sync** | Tras merge, duplicar resumen en repo equipo si aplica política del proyecto. |
| **Fiscal / Billing** | N/A (salvo que el layout se use para facturación — no es el caso en Fase 1). |

---

## 7. Pruebas

- **Unit:** `deserializeProject` con `zonas[].preview` parcial; merge defaults.
- **Unit:** `buildZoneRects` con y sin `preview.x/y`; `dos_aguas` divisor de ancho.
- **Manual:** iPhone Safari — drag, doble tap, scroll de página sin “perder” el gesto.
- **Regresión:** Cotización total idéntica antes/después de arrastrar (Fase 1–3).

---

## 8. Riesgos y decisiones pendientes

| Riesgo | Mitigación |
|--------|------------|
| `RoofBorderSelector` desincronizado del drag | Fase 4 compartida o scope explícito “preview simplificado” en selector. |
| Doble clic vs drag | Umbral de movimiento `> 5px` cancela click; doble clic solo si no hubo drag. |
| Rendimiento con muchas zonas | Limitar N zonas razonable; simplificar rejilla (líneas, no 500 rects DOM). |
| ¿El layout debe afectar metros lineales de perfilería? | **Decisión negocio:** por defecto **no** en Fase 1–3. |

---

## 9. Relación con otros planes

- `docs/team/PLAN-FLOOR-PLAN-TECHO-FACHADA.md`: plano poligonal Techo+Fachada es **complementario**; la vista previa de zonas rectangular puede alimentar o converger con ese modelo en el futuro.
- Extraer componente común de “vista planta” evita duplicar SVG entre `FloorPlanEditor` y `RoofPreview`.

---

## 10. Checklist de cierre (para quien implemente)

- [ ] Componente unificado o documentado en `DASHBOARD-INTERFACE-MAP` / calculadora map si existe sección.
- [ ] Entrada en `docs/team/PROJECT-STATE.md` — Cambios recientes.
- [ ] `npm run lint` + `npm test` + `npm run build` (según `AGENTS.md`).
- [ ] Captura o Loom opcional para handoff Diseño/Calc.

---

*Documento generado para coordinación de equipo completo; implementación pendiente de ejecución por rol Calc + Design.*
