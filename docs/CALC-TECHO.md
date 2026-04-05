# 🏠 Motor de Cálculo de Techos — CALC-TECHO

## Función Principal

```javascript
calcTechoCompleto(inputs) → {
  paneles, autoportancia, fijaciones, perfileria,
  selladores, totales, warnings, allItems
}
```

### Parámetros de Entrada

| Campo | Tipo | Ejemplo | Descripción |
|-------|------|---------|-------------|
| `familia` | string | `"ISODEC_EPS"` | Clave en PANELS_TECHO |
| `espesor` | number | `100` | Espesor en mm |
| `largo` | number | `6.5` | Largo en metros (dirección del panel) |
| `ancho` | number | `5.6` | Ancho en metros (perpendicular al panel) |
| `tipoEst` | string | `"metal"` | `"metal"` / `"hormigon"` / `"mixto"` / `"madera"` |
| `ptsHorm` | number | `0` | Puntos en hormigón (solo mixto) |
| `borders` | object | `{frente, fondo, latIzq, latDer}` | Tipo de perfil por lado |
| `opciones` | object | `{inclCanalon, inclGotSup, inclSell}` | Toggles |
| `color` | string | `"Blanco"` | Color del panel |

## Funciones de Cálculo

### 1. `calcPanelesTecho(panel, espesor, largo, ancho)`

```
cantPaneles = ceil(ancho / AU)
anchoTotal  = cantPaneles × AU
areaTotal   = cantPaneles × largo × AU
precioM2    = p(espData)          ← SIN IVA
costoPaneles = precioM2 × areaTotal
```

**Ejemplo:** ISODEC EPS, 6.5m × 5.6m
```
AU = 1.12m
cantPaneles = ceil(5.6 / 1.12) = 5
areaTotal   = 5 × 6.5 × 1.12 = 36.40 m²
precioM2    = p({venta:37.76, web:45.97}) = 45.97 (web)
costoPaneles = 45.97 × 36.40 = $1,673.31
```

### 2. `calcAutoportancia(panel, espesor, largo)`

Verifica si el largo excede la autoportancia del panel.

```
maxSpan = espData.ap     (metros)
apoyos  = ceil(largo / maxSpan + 1)
ok      = largo <= maxSpan
```

**Tabla de autoportancia ISODEC EPS:**

| Espesor | Autoportancia |
|---------|--------------|
| 100mm | 5.5m |
| 150mm | 7.5m |
| 200mm | 9.1m |
| 250mm | 10.4m |

### 3. `calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm)`

Para paneles con sistema `varilla_tuerca` (ISODEC, ISODEC PIR).

```
grilla = cantP × (apoyos + 2) (apoyos ≥ 2; ver motor)
lateral_perímetro = Σ en planta (laterales verticales exteriores libres) max(0, ceil(L / espPerim) − 1) por tramo; sin multizona: 2 × max(0, ceil(largo / espPerim) − 1)
puntosFijación = grilla + lateral_perímetro
varillas (con espesor mm) = barras 1 m según tramo = espesor + extra sustrato; fallback sin espesor: ceil(puntos / 4)
```

**Por tipo de estructura:**

| Estructura | Tuercas | Tacos |
|-----------|---------|-------|
| Metal | puntos × 2 | 0 |
| Hormigón | puntos × 1 | puntos |
| Mixto | (pMetal × 2) + (pH × 1) | pH |

Items generados: varilla 3/8", tuerca 3/8", taco expansivo (si H°), arandela carrocero, arandela plana (lado inferior, por punto metal o madera; no en solo hormigón), tortuga PVC.

### 4. `calcFijacionesCaballete(cantP, largo)`

Para paneles con sistema `caballete_tornillo` (ISOROOF).

```
caballetes = ceil((cantP × 3 × (largo/2.9 + 1)) + (largo × 2 / 0.3))
tornillosAguja = caballetes × 2
paquetesAguja  = ceil(tornillosAguja / 100)
```

### 5. `calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones)`

Resuelve perfiles de borde usando `resolveSKU_techo`:

| Lado | Dimensión | Opciones |
|------|-----------|----------|
| Frente | anchoTotal | gotero_frontal, gotero_frontal_greca, none |
| Fondo | anchoTotal | gotero_frontal, babeta_adosar, babeta_empotrar, cumbrera, none |
| Lat. Izq | largo | gotero_lateral, gotero_lateral_camara, babeta_adosar, none |
| Lat. Der | largo | gotero_lateral, gotero_lateral_camara, babeta_adosar, none |

**Canalón (CORREGIDO v3):**
```javascript
// Resuelve precio del catálogo por familia/espesor
const canData = resolveSKU_techo("canalon", familiaP, espesor);
pzasCanalon = ceil(anchoTotal / canData.largo)
```

**Soporte canalón (CORREGIDO v3):**
```javascript
// Antes (incorrecto): ceil(anchoTotal / 1.5)
// Ahora (correcto):
mlSoportes = (cantP + 1) × 0.30
barrasSoporte = ceil(mlSoportes / largo_barra)
```

**Tornillos T1 perfilería:**
```
fijPerfileria = ceil(totalML / 0.30)
paquetesT1    = ceil(fijPerfileria / 100)
```

### 6. `calcSelladoresTecho(cantP, opts)`

Bromplast **600 ml**: `siliconas_600 = ceil(mlSilicona / ml_por_unid)` (ver motor: juntas, solapes, babetas, empalmes canalón). **300 ml neutra:** en paralelo, `cant_300 = siliconas_600 × ratio` (default **2**, parámetro `SELLADORES_TECHO.silicona_300_por_unid_600`). Cinta butilo: `cintas = ceil(cantP / paneles_por_rollo)` (default 10).

## Validaciones y Warnings

| Condición | Warning |
|-----------|---------|
| Color no disponible para familia | "Color X no disponible" |
| Color requiere espesor máximo | "Color X solo hasta Ymm" |
| Color requiere área mínima | "Color X requiere mín. Y m²" |
| Largo excede autoportancia | "Largo excede autoportancia máx" |
| Largo < mínimo fabricable | "Largo < mínimo Ym" |
| Largo > máximo fabricable | "Largo > máximo fabricable Ym" |

## Tests de Verificación

### Test 1: ISODEC EPS 100mm, 6.5×5.6m, metal
- Paneles: 5 → Área: 36.40 m²
- Apoyos: 3 (autoportancia 5.5m)
- Puntos fijación: 36
- Varillas: 9

### Test 2: ISOROOF 3G 50mm, 4.0×5.0m, madera
- Paneles: 5 → Área: 20.0 m²
- Caballetes: 63

### Test 3: ISODEC EPS 200mm, 10×8m, hormigón
- Paneles: 8 → Área: 89.60 m²
- ⚠️ Autoportancia excedida (9.1m < 10m)
- Apoyos: 3
- Puntos fijación: 56
