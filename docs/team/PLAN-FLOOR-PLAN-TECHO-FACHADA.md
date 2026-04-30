# Plan: Plano de diseño para Techo + Fachada

**Objetivo:** Cuando el usuario elige **Techo + Fachada**, poder dibujar el diseño como un plano, asignar medidas a las fachadas, y que el techo se adapte automáticamente.

---

## Flujo deseado

1. **Dibujar fachadas** — El usuario dibuja las paredes (fachadas) en una vista de planta (plano 2D).
2. **Asignar medidas** — Cada fachada tiene longitud editable (como los accesorios del techo).
3. **Techo se adapta** — El área del techo se deriva del contorno cerrado de las fachadas (footprint).
4. **Perímetro y alto** — El perímetro de pared = suma de longitudes de fachadas; alto = input global o por fachada.

---

## Modelo de datos

### Opción A: Polígono cerrado (footprint)

```js
plano: {
  modo: "plano",           // "plano" | "manual" (formulario actual)
  vertices: [              // Puntos del polígono (vista planta)
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 }
  ],
  paredAlto: 3.5
}
```

- **Área techo** = área del polígono (Shoelace o descomposición en rectángulos).
- **Perímetro** = suma de lados del polígono.
- **Techo.zonas** = descomposición del polígono en rectángulos (ej. L-shaped → 2 zonas).

### Opción B: Segmentos de fachada (MVP)

```js
plano: {
  modo: "plano",
  fachadas: [
    { id: "f1", label: "Frente", largo: 10, alto: 3.5 },
    { id: "f2", label: "Fondo", largo: 10, alto: 3.5 },
    { id: "f3", label: "Izq", largo: 8, alto: 3.5 },
    { id: "f4", label: "Der", largo: 8, alto: 3.5 }
  ]
}
```

- **Perímetro** = suma de `largo`.
- **Techo** = asumimos rectangular: largo = max(frente, fondo), ancho = max(izq, der) o promedio.
- Para rectángulo: largo = (frente + fondo) / 2, ancho = (izq + der) / 2.

### Opción C: Híbrido (recomendado para Fase 1)

- **Forma base:** Rectangular o L-shaped (presets).
- **Edición visual:** Canvas SVG donde el usuario arrastra vértices o edita medidas en inputs.
- **Sync bidireccional:** Cambios en el plano → techo.zonas + pared.perimetro; cambios en inputs → plano.

---

## Fases de implementación

### Fase 1 — Rectángulo visual (MVP)

- [ ] Nuevo componente `FloorPlanEditor.jsx`.
- [ ] Modo "Plano" para escenario `techo_fachada`.
- [ ] Vista planta: rectángulo con largo × ancho.
- [ ] Inputs de medida en cada lado (o 2 inputs: largo, ancho).
- [ ] Al editar: `techo.zonas = [{ largo, ancho }]`, `pared.perimetro = 2*(largo+ancho)`, `pared.alto` = input.
- [ ] Toggle: "Usar plano" vs "Formulario manual" (comportamiento actual).

### Fase 2 — L-shaped y polígono simple

- [ ] Soporte para L-shaped (2 rectángulos).
- [ ] Cálculo de área y perímetro desde polígono.
- [ ] Techo.zonas = descomposición en zonas rectangulares.

### Fase 3 — Dibujo libre

- [ ] Canvas interactivo: click para añadir vértices, arrastrar para mover.
- [ ] Validación de polígono cerrado.
- [ ] Medidas editables por segmento.

---

## Integración en PanelinCalculadoraV3

1. En `scenario === "techo_fachada"`, después de seleccionar paneles, mostrar sección **"Diseño por plano"**.
2. Si `plano.modo === "plano"`: mostrar `FloorPlanEditor` en lugar de (o además de) Dimensiones Techo + Dimensiones Pared.
3. `FloorPlanEditor` recibe: `value`, `onChange`, `techoPanelData`, `paredPanelData`.
4. `onChange` actualiza estado que sincroniza `techo.zonas`, `pared.perimetro`, `pared.alto`.

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/components/FloorPlanEditor.jsx` | Crear — editor de plano |
| `src/components/PanelinCalculadoraV3.jsx` | Modificar — integrar FloorPlanEditor cuando techo_fachada |
| `src/data/constants.js` | Añadir estructura `plano` si se usa en projectFile |
| `src/utils/projectFile.js` | Incluir `plano` en serialize/deserialize |

---

## Referencias

- RoofBorderSelector: asignación visual de accesorios por lado.
- RoofPreview: vista previa del techo con zonas.
- calculations.js: calcTechoCompleto, calcParedCompleto, mergeZonaResults.
