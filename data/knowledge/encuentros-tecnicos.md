# ENCUENTROS TÉCNICOS — Paneles BMC Uruguay

> Documento técnico de referencia para el agente Panelin.
> Fuente: procedimientos constructivos BMC / Kingspan / Bromyros.
> Unidades: mm. Precios en USD sin IVA.

---

## 1. ENCUENTRO PANEL–PANEL (junta longitudinal)

### Paneles de techo (ISODEC / ISOROOF)
- Los paneles se solapan lateralmente usando el **macho-hembra** del perfil conformado.
- **Sello en junta:** cinta butilo de 2mm×15mm aplicada en el macho antes del cierre.
- **Tornillería de junta:** tornillo tipo T1 cada 300 mm en toda la longitud del encuentro.
- No se requiere perfil adicional entre paneles contiguos en la misma agua.

### Paneles de pared (ISOPANEL / ISOWALL / ISODEC pared)
- Unión lateral: **perfil K2** (junta interior, 35×35 mm) entre paneles, largo 3,0 m — cantidad: `(cantPaneles - 1) × ceil(alto / 3.0)`.
- Unión exterior visible: **perfil G2** (tapajunta), largo 3,0 m — cubre la junta a la vista en fachada.
- Sellado: silicona neutra Bromplast en ambos lados de la junta antes de cerrar el G2.

---

## 2. ENCUENTRO TECHO–PARED (transición cubierta a fachada)

### Opción A — Babeta adosar (atornillada sobre la pared)
- Perfil **babeta de adosar** (acero prepintado mismo color que panel).
- Se atornilla al panel de pared con tornillo T1 cada 300 mm.
- **Cuándo usar:** encuentros en ángulo recto, obra nueva, acceso fácil al paramento.
- Sellado: cordón de silicona en la zona de contacto babeta–pared.

### Opción B — Babeta empotrar (embutida en muro)
- Perfil **babeta de empotrar** (entra 20–30 mm en ranura del muro).
- **Cuándo usar:** reforma sobre estructura existente de hormigón o ladrillo, mejor estética.
- Requiere corte previo en muro; impermeabilizar ranura con membrana autoadhesiva antes de insertar.

### Nota comercial
Ambas babetas se cotizan por ML. El bot debe preguntar tipo de obra (nueva vs reforma) para recomendar la variante correcta.

---

## 3. ENCUENTRO TECHO–CUMBRERA (dos aguas)

- Perfil **cumbrera estándar** 3,03 m — para ISODEC EPS/PIR e ISOROOF 3G/PLUS.
- Perfil **cumbrera COLONIAL** 2,20 m (SKU `CUMROOFCOL`, precio venta USD 97.86) — solo para ISOROOF COLONIAL.
- **Cinta de cierre cumbrera:** espuma de polietileno de célula cerrada perfilada, se coloca en la cima antes de atornillar la cumbrera.
- Tornillo cumbrera: aguja 14×5" cada 300 mm alternado entre aguas.
- **Solapo mínimo:** la cumbrera debe cubrir al menos 150 mm de cada agua.

---

## 4. ENCUENTRO PANEL–GOTERO (borde de alero)

### Gotero frontal
- Perfil **gotero frontal** (longitud 3,03 m) — deflecta el agua lejos de la fachada.
- Versión con greca (`GFCGR30`) solo para ISOROOF 30/50/80 mm con perfil de onda.
- Se instala antes que los paneles; los paneles se apoyan sobre el labio del gotero.

### Gotero lateral
- Perfil **gotero lateral** (3,0 m) — cierre de testero.
- Variante cámara: `gotero_lateral_camara` para instalaciones frigoríficas (con aislación extra en testero).

### Gotero superior
- Solo en ISOROOF y ISODEC PIR 30/50/80 mm — cierra el extremo superior del panel contra la cumbrera o pared de apoyo.

---

## 5. ENCUENTRO PANEL–ABERTURA (ventanas y puertas)

### En pared (ISOPANEL / ISOWALL)
- **Perímetro de abertura:** perfil U del espesor correspondiente recortado al contorno de la abertura.
- **Jambas laterales:** mismo perfil U, longitud = alto de abertura.
- **Dintel y umbral:** perfil U horizontal; el umbral puede llevar chapa de remate adicional si hay pluviales.
- **Sellado:** silicona neutra en todo el perímetro de contacto panel–marco.
- **Membrana:** rollo autoadhesivo 30cm×10m en jamba y dintel para impermeabilización (SKU `membrana`, `ceil(perím_abertura / 10)` rollos).

### Aberturas en cálculo
La calculadora descuenta el área neta de aberturas al calcular m² de panel y ajusta selladores automáticamente. El agente debe pedir `ancho × alto × cantidad` por tipo de abertura.

---

## 6. ENCUENTRO PANEL–ESTRUCTURA (apoyo sobre perlinería/viga)

### Sistema varilla (ISODEC EPS / PIR)
- **Perforación:** agujero pasante en cresta del panel, perpendicular a la estructura.
- **Varilla 3/8"** (1 m, cortar a medida) pasa por el panel hasta la correa.
- **Secuencia:** arandela PP (tortuga) → panel → arandela carrocero → tuerca de ajuste.
- **Torque de apriete:** 15–20 N·m (no sobre-apretar; deforma la chapa).
- **Sustrato hormigón:** requiere taco expansivo 3/8" embebido en la losa antes de instalar.

### Sistema caballete (ISOROOF 3G / FOIL / PLUS / COLONIAL)
- **Caballete** (arandela trapezoidal metálica) se apoya sobre la cresta del panel y se fija a la correa con tornillo aguja.
- Caballete cada ~300 mm en zona de alero, cada ~500 mm en zona central.
- `caballetes = ceil((cantP × 3 × (largo/2.9 + 1)) + (largo × 2 / 0.3))`
- Cada caballete lleva 2 tornillos aguja.

---

## 7. ENCUENTRO PARED–LOSA/PLATEA (base inferior)

### Anclaje H° (pared sobre platea de hormigón)
- **Kit anclaje H°** (varilla 1/4", tuercas y arandelas): 1 kit cada **30 cm** del perímetro inferior.
- `anclajes = ceil(perimetro / 0.30)`
- **Perfil U base** (mismo espesor que el panel): `ceil(perimetro / 3.0)` unidades de 3,0 m.
- El perfil U base se ancla a la platea antes de colocar el primer panel.

### Esquineros exteriores/interiores
- **Esquinero ext.** (SKU `ESQ-EXT`, 3,0 m): `ceil(alto / 3.0)` piezas por cada esquina exterior.
- **Esquinero int.** (SKU `ESQ-INT`, 3,0 m): ídem para esquinas interiores.
- Precio venta: USD 8.59/barra.

---

## 8. ENCUENTRO PANEL–PANEL EN ESQUINA (fachadas)

### Esquina exterior (ángulo 90°)
1. Perfil **esquinero exterior** (ESQ-EXT) atornillado con T1 al panel de cada cara.
2. Sellado: silicona neutra en las dos ranuras de contacto antes de cerrar el esquinero.
3. Para mayor rigidez estética: **ángulo de aluminio 5852 anodizado** (6,8 m, SKU `PLECHU98`, USD 51.84 venta) — opcional, se cotiza aparte.

### Esquina interior (ángulo entrante)
- Perfil **esquinero interior** (ESQ-INT) — mismo precio y procedimiento que exterior.
- No requiere ángulo de aluminio adicional.

---

## 9. TABLAS RÁPIDAS DE REFERENCIA

### Mínimos de solapo y sellado
| Encuentro | Solapo mín. | Sellado |
|---|---|---|
| Panel–panel techo | N/A (macho-hembra) | Cinta butilo 2mm×15mm |
| Cumbrera | 150 mm por agua | Espuma perfilada + silicona |
| Gotero frontal | 50 mm sobre alero | Silicona en contacto |
| Babeta adosar | 80 mm sobre pared | Silicona |
| Babeta empotrar | 20–30 mm en ranura | Membrana + silicona |
| Abertura en pared | N/A | Silicona + membrana |

### Selladores disponibles
| SKU | Descripción | Rendimiento | Precio venta |
|---|---|---|---|
| `silicona_300_neutra` | Silicona neutra 300 ml | 8 ml lineal | USD 7.00 |
| `membrana` | Membrana autoadhesiva 30cm×10m | 1 rollo = 10 ML | USD 20.71 |
| Cinta butilo | 2mm×15mm×22.5m | 1 rollo = 22,5 ML | USD 14.89 |

---

## 10. PREGUNTAS FRECUENTES — ENCUENTROS

**P: ¿Puedo usar ISODEC PIR en pared y ISOROOF en techo en el mismo proyecto?**
R: Sí, son compatibles constructivamente. El encuentro techo–pared se resuelve con babeta adosar o empotrar según el detalle de obra. Los sistemas de fijación son independientes por zona.

**P: ¿Qué perfil va en el encuentro entre el techo y la pared de block/ladrillo?**
R: Babeta adosar si el muro es accesible y liso; babeta empotrar si se puede ranurear (más estanca). En ambos casos sellar con silicona neutra y considerar membrana autoadhesiva en zonas de mucha lluvia.

**P: ¿El agente puede cotizar encuentros y perfiles de forma automática?**
R: Sí para los perfiles perimetrales (goteros, babeta, cumbrera, canalón) cuando se configuran los bordes en la calculadora. Los esquineros se calculan con `numEsqExt` y `numEsqInt`. Babetas y detalles especiales son ítems manuales en "Presupuesto libre".

**P: ¿Cuánta silicona necesito para una fachada de 40 m de perímetro?**
R: Por regla del motor: `ceil(perimetro × 2 / 8)` cartuchos = ceil(80/8) = 10 cartuchos de 300 ml para las juntas verticales principales. Agregar 20% para aberturas y esquinas.
