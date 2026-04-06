# Lógica de negocio — BMC Uruguay / Panelin Calculator

Este documento es la fuente de verdad compacta para que modelos AI entiendan el dominio
sin leer miles de líneas de código. Importar con `@BUSINESS_LOGIC.md` al inicio de sesiones
de cálculo. Fuente canónica: `src/data/constants.js` + `src/utils/calculations.js`.

---

## 1. Precios y moneda

- **Moneda**: USD. Todos los precios en `constants.js` son **sin IVA**.
- **IVA Uruguay**: 22% (0.22). Se aplica **una sola vez** al total final.
- **Multiplicador**: `IVA_MULT = 1.22`. Función: `pIVA(item) = p(item) * 1.22`
- **Listas de precios**:
  - `"venta"` → precio BMC venta directa (default operativo)
  - `"web"` → precio lista web/público
  - `"costo"` → costo interno (NO mostrar al cliente)
- **Override dinámico**: `src/data/pricing.js` lee MATRIZ CSV desde Google Sheets y sobreescribe
  los precios de `constants.js`. Sincronizar con `npm run matriz:pull-csv`.

---

## 2. Familias de paneles

### Techo (`PANELS_TECHO`)

| Clave | Nombre comercial | Sistema fijación | Ancho útil (au) | Largo fabricación |
|---|---|---|---|---|
| `ISODEC_EPS` | ISODEC EPS | varilla_tuerca | 1.12 m | 2.3–14 m |
| `ISODEC_PIR` | ISODEC PIR | varilla_tuerca | 1.12 m | 3.5–14 m |
| `ISOROOF_3G` | ISOROOF 3G | caballete_tornillo | 1.0 m | 3.5–8.5 m |
| `ISOROOF_FOIL` | ISOROOF FOIL 3G | caballete_tornillo | 1.0 m | 3.5–8.5 m |
| `ISOROOF_COLONIAL` | Isoroof Colonial | caballete_tornillo | 1.0 m | 3.5–8.5 m |
| `ISOROOF_PLUS` | ISOROOF PLUS 3G | caballete_tornillo | 1.0 m | 3.5–8.5 m |

**Espesores ISODEC EPS**: 100, 150, 200, 250 mm
**Espesores ISODEC PIR**: 50 (evitar), 80, 120 mm
**Espesores ISOROOF**: 30, 40, 50, 80, 100 mm (varía por familia)

**Restricciones importantes**:
- ISODEC_PIR 50 mm: marcado "EVITAR ESTE ESPESOR" en MATRIZ
- ISOROOF PLUS: mínimo 800 m² para color Blanco
- ISOROOF 3G color Blanco: mínimo 500 m²
- ISODEC colores Gris/Rojo: solo 100–150 mm, +20 días de entrega

### Pared (`PANELS_PARED`)

| Clave | Nombre comercial | Ancho útil (au) |
|---|---|---|
| `ISOPANEL_EPS` | ISOPANEL EPS | 1.14 m |
| `ISOWALL_PIR` | ISOWALL PIR | 1.10 m |
| `ISODEC_EPS_PARED` | ISODEC EPS (pared) | 1.14 m |

**Restricción**: ISOPANEL EPS 50 mm solo para subdivisiones interiores. Fachada exterior mínimo 100 mm.

---

## 3. Autoportancia (`ap`)

Cada panel/espesor tiene un `ap` (vano máximo entre apoyos en metros).

```
apoyos = ceil(largo / ap) + 1
```

Si `largo <= ap` → ok: true (un solo tramo entre apoyos extremos).
El campo `lmin/lmax` es rango de fabricación, NO límite estructural.

---

## 4. Fórmulas de fijaciones ISODEC (sistema varilla_tuerca)

### Grilla de puntos

```
// cantP = cantidad de paneles en ancho; apoyos = líneas de apoyo
if (apoyos === 1) puntos_grilla = 2 * cantP          // solo perímetro
else              puntos_grilla = cantP * (apoyos + 2) // 2 extra por filas perimetrales
```

**Regla física**: primera y última fila de apoyo (perímetro) → 2 fijaciones/panel.
Filas intermedias → 1 fijación/panel al centro.

### Refuerzo perimetral lateral (laterales verticales expuestos)

```
espaciado_perimetro = 2.5 m  (configurable en dimensioningFormulas)
puntos_lateral = 2 * max(0, ceil(largo / 2.5) - 1)
```

### Total fijaciones

```
total = puntos_grilla + puntos_lateral
```

### Varillas desde barras de 1 m

Cada fijación consume un tramo de `(espesor_mm / 1000) + extra_sustrato` metros.
Modelo greedy: `floor(1.0 / cut_m)` tramos por barra. Sin empalme de recortes.

### Tuercas y arandelas (por tipo de estructura)

| Sustrato | Tuercas/punto | Tacos/punto |
|---|---|---|
| metal | 2 | 0 |
| hormigon | 1 | 1 (taco expansivo) |
| madera | 2 | 0 |

Arandela plana (inferior): 1 por punto en metal/madera. No en hormigón.

---

## 5. Fijaciones ISOROOF (sistema caballete_tornillo)

- Caballetes (arandela trapezoidal) + tornillos punta aguja Type 14×5"
- No usa varilla roscada
- Cálculo: basado en puntos de apoyo × tornillos por caballete

---

## 6. Selladores techo

- **Silicona 600 ml** (Bromplast): ratio configurable, default ~1 por tramo
- **Silicona 300 ml neutra** (MATRIZ SKU: SIL300N): 2 unidades por cada 600 ml
- **Cinta butilo**: perímetro lineal expuesto
- **Membrana autoadhesiva**: cumbrera y uniones críticas

---

## 7. Perfiles de techo

Cada familia (ISODEC / ISODEC_PIR / ISOROOF) tiene perfiles específicos:
- `gotero_frontal`: borde frontal de cubierta, largo 3.03 m
- `gotero_lateral`: borde lateral de cubierta, largo 3.0 m
- `cumbrera`: remate de caballete, largo 3.03 m (ISOROOF_COLONIAL: 2.2 m)
- `babeta_adosar` / `babeta_empotrar`: encuentros con muro

**ISOROOF_COLONIAL**: usa perfilería de ISOROOF 3G en todo excepto la cumbrera (CUMROOFCOL, 2.2 m).

---

## 8. Escenarios de cotización

| Escenario | Descripción |
|---|---|
| `solo_techo` | Solo cubierta, sin fachada |
| `solo_fachada` | Solo muro/fachada, con esquineros |
| `techo_fachada` | Cubierta + fachada (building envelope completo) |
| `camara_frigorifica` | Cámara fría: fachada + requerimientos térmicos especiales |

---

## 9. Motor de cálculo — funciones clave

```
src/utils/calculations.js

calcPanelesTecho(panel, espesor, largo, ancho)       → {cantPaneles, areaTotal, costoPaneles, descarte}
calcAutoportancia(panel, espesor, largo)              → {ok, apoyos, maxSpan}
countPuntosFijacionVarillaGrilla(cantP, apoyos)      → número entero
calcFijacionesVarilla(cantP, apoyos, largo, tipoEst) → BOM completo de fijaciones
calcSelladoresTecho(...)                             → unidades de selladores
calcLargoRealFromModo(largo, modo, grados, altDif)  → largo real (aplica pendiente)
calcFactorPendiente(grados)                          → 1/cos(rad)
```

---

## 10. Fuentes de precios

| Fuente | Mecanismo | Actualización |
|---|---|---|
| `src/data/constants.js` | Valores estáticos hardcoded | Manual en código |
| `src/data/pricing.js` | Lee MATRIZ CSV cacheada | `npm run matriz:pull-csv` |
| Google Sheets BROMYROS | Fuente master de precios | Manual por proveedor |

**Precedencia**: pricing.js (MATRIZ) sobreescribe constants.js cuando hay SKU match.

---

## 11. APIs y endpoints relevantes

| Endpoint | Descripción |
|---|---|
| `GET /health` | Health check Cloud Run |
| `POST /api/v1/calculate` | Cálculo server-side de cotización |
| `GET /api/v1/pricing` | Precios actuales (desde MATRIZ) |
| `GET /api/bmc/dashboard` | CRM cockpit (requiere API_AUTH_TOKEN) |
| `POST /webhooks/whatsapp` | Meta webhook (HMAC verificado) |
| `POST /webhooks/shopify` | Shopify webhook (HMAC verificado) |

---

## 12. Invariantes que NUNCA deben romperse

1. **IVA se aplica UNA SOLA VEZ** al total. Nunca aplicar por ítem y también al total.
2. **Precios en constants.js son sin IVA**. Nunca subir precios con IVA a ese archivo.
3. **Funciones de cálculo son puras**. Sin llamadas a APIs, sin side effects, sin localStorage.
4. **ISODEC ≠ ISOPANEL**. ISODEC es techo (varilla). ISOPANEL es pared (tornillo). No intercambiar.
5. **ap (autoportancia) ≠ lmax (largo máximo fabricación)**. Son conceptos independientes.
6. **ancho útil (au)**: ISODEC/ISOPANEL = 1.12–1.14 m. ISOROOF/ISOWALL = 1.0–1.10 m.
