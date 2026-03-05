# 🏢 Motor de Cálculo de Paredes — CALC-PARED

## Diferencias Críticas con Techo

| Aspecto | Techo | Pared |
|---------|-------|-------|
| Autoportancia | ✅ Sí | ❌ No aplica |
| Fijaciones | Varilla/tuerca o caballete | Anclaje H° + Tornillo T2 + Remaches |
| Perfilería | Goteros, cumbreras, babetas | Perfil U, K2, G2, 5852, esquineros |
| Aberturas | No | ✅ Puertas y ventanas |
| Selladores | Silicona + cinta | Silicona + cinta + membrana + espuma PU |

## Función Principal

```javascript
calcParedCompleto(inputs) → {
  paneles, perfilesU, esquineros, perfilesExtra,
  fijaciones, sellador, totales, warnings, allItems
}
```

### Parámetros de Entrada

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `familia` | string | `"ISOPANEL_EPS"` |
| `espesor` | number | `100` |
| `alto` | number | `3.5` |
| `perimetro` | number | `40` |
| `numEsqExt` | number | `4` |
| `numEsqInt` | number | `0` |
| `aberturas` | array | `[{tipo:"puerta", ancho:0.9, alto:2.1, cant:1}]` |
| `tipoEst` | string | `"metal"` |
| `inclSell` | boolean | `true` |
| `incl5852` | boolean | `false` |
| `color` | string | `"Blanco"` |

## Funciones de Cálculo

### 1. `calcPanelesPared(panel, espesor, alto, perimetro, aberturas)`

```
cantPaneles   = ceil(perimetro / AU)
areaBruta     = cantPaneles × alto × AU
areaAberturas = Σ(ancho × alto × cant) por cada abertura
areaNeta      = max(areaBruta - areaAberturas, 0)
precioM2      = p(espData)
costoPaneles  = precioM2 × areaNeta
```

**Ejemplo:** ISOPANEL EPS 100mm, alto 3.5m, perímetro 40m
```
cantPaneles   = ceil(40 / 1.14) = 36
areaBruta     = 36 × 3.5 × 1.14 = 143.64 m²
```

Con 1 puerta (0.9×2.1) + 2 ventanas (1.2×1.0):
```
areaAberturas = (0.9 × 2.1 × 1) + (1.2 × 1.0 × 2) = 4.29 m²
areaNeta      = 143.64 - 4.29 = 139.35 m²
```

### 2. `calcPerfilesU(panel, espesor, perimetro)`

Perfil U de base y coronación (mismo perfil, misma cantidad):

```
pzas = ceil(perimetro / largo_perfil)
```

Se generan 2 items: "Perfil U base" y "Perfil U coronación".

### 3. `calcEsquineros(alto, numExt, numInt)`

```
pzasPorEsquina = ceil(alto / largo_esquinero)
totalExt = pzasPorEsquina × numExt
totalInt = pzasPorEsquina × numInt
```

### 4. `calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst)` — ⚠️ REESCRITA v3

**CAMBIO CRÍTICO:** Ya NO usa varilla/tuerca/arandela/tortuga PVC. Esos son SOLO para techo.

Las paredes usan un sistema diferente:

**a) Kit anclaje H° — Perfil U de base a platea**
```
anclajes = ceil(anchoTotal / 0.30)    — cada 30cm en perímetro inferior
```

**b) Tornillo T2 — Para fijar paneles a estructura**
```
// Solo para metal o mixto
areaNeta    = cantP × alto × AU
tornillosT2 = ceil(areaNeta × 5.5)    — ~5.5 tornillos por m²
paquetes    = ceil(tornillosT2 / 100)  — se venden x100
```

**c) Remaches POP — Uniones entre perfiles**
```
remaches    = ceil(cantP × 2)          — ~2 por panel
paquetes    = ceil(remaches / 1000)    — se venden x1000
```

### 5. `calcPerfilesParedExtra(panel, espesor, cantP, alto, perimetro, opts)` — ⚠️ NUEVA v3

**a) Perfil K2 — Junta interior entre paneles**
```
juntasK2 = (cantP - 1) × ceil(alto / 3.0)    — 3.0m = largo del K2
```

**b) Perfil G2 — Tapajunta exterior**
```
numTramos = ceil(perimetro / (cantP × AU))
cantG2    = ceil(alto × 2 / 3.0) × max(numTramos, 1)
```

**c) Perfil 5852 aluminio — OPCIONAL (toggle en UI)**
```
// Cuando techo apoya sobre isopanel
cant5852 = ceil(anchoTotal / 6.8)            — largo 6.8m
// Si apoyo doble (sup + inf): × 2
```

### 6. `calcSelladorPared(perimetro, cantPaneles, alto)` — ⚠️ AMPLIADA v3

**a) Silicona**
```
mlJuntas  = juntasVerticales × alto + perimetro × 2
siliconas = ceil(mlJuntas / 8)
```

**b) Cinta butilo**
```
cintas = ceil(mlJuntas / 22.5)
```

**c) Membrana autoadhesiva — NUEVA v3**
```
rollosMembrana = ceil(perimetro / 10)    — rollos de 10m
```

**d) Espuma PU — NUEVA v3**
```
espumas = rollosMembrana × 2             — 2 por rollo de membrana
```

## Validaciones y Warnings

| Condición | Warning |
|-----------|---------|
| ISOPANEL 50mm | "Solo para subdivisiones interiores" |
| Alto > largo_max panel | "Alto excede largo máximo" |
| Alto < largo_min panel | "Alto menor al largo mínimo" |
| numEsqExt === 0 | "Sin esquinas exteriores — verificar geometría" |
| Color no disponible | "Color X no disponible" |

## Tests de Verificación

### Test 1: ISOPANEL EPS 100mm, 3.5m alto, 40m perímetro, 4 esq ext, metal
- Paneles: 36 → Área bruta: 143.64 m²
- Perfil U base: 14 pzas × $15.15 = $212.10
- Perfil U coronación: 14 pzas
- Esquineros ext: 8 pzas

### Test 2: Mismos datos + aberturas
- Área aberturas: 4.29 m²
- Área neta: 139.35 m²
- Paneles siguen siendo 36 (no cambian por aberturas)

### Test 3: ISOPANEL 50mm, 2.7m alto, 20m, 0 esq
- ⚠️ Warning "50mm solo subdivisiones"
- ⚠️ Warning "Sin esquinas exteriores"
