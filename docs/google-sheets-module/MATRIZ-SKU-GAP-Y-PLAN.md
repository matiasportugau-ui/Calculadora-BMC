# MATRIZ col D — brechas de SKU y plan de alineación

**Objetivo:** que todo ítem con precio en `constants.js` pueda recibir **F / L / T / M / U** vía CSV (`/api/actualizar-precios-calculadora`) usando `MATRIZ_SKU_TO_PATH` en [`src/data/matrizPreciosMapping.js`](../../src/data/matrizPreciosMapping.js).

**Reglas de nomenclatura (alineadas al repo):**

- Mayúsculas, sin espacios; `normalizeSku()` quita espacios y **guiones** (no puntos).
- Prefijos por familia: paneles `ISP*` / `ISDEC*` / `IW*`; goteros `GF*` / `GL*` / `GSDECAM*`; canalón `CD*` / `CAN*`; fijaciones `ANC*`, `THEX*`, `T1*`, `VAR*`, `TUE*`, etc.; selladores `BROMPLAST`, `SIL300N`, `CBUT`, `MEMB*`, `ESP*`.
- Un **SKU col D** → un **path** canónico. Varios SKU pueden apuntar al mismo path (alias). **No** usar un mismo SKU para dos paths distintos en la planilla (el import solo actualiza un nodo).

---

## 1. Estado: `FIJACIONES` (kit Isodec y similares)

Los objetos en `FIJACIONES` **no** llevan campo `sku`; el vínculo a MATRIZ es solo por mapeo.

| Path calculadora | ¿En `MATRIZ_SKU_TO_PATH`? | SKU propuesto col D | Notas |
|------------------|---------------------------|---------------------|--------|
| `FIJACIONES.varilla_38` | Sí (nuevo) | **VAR381ML** | Varilla roscada 3/8" 1 m; filas BROMYROS ~161 |
| `FIJACIONES.tuerca_38` | Sí (nuevo) | **TUE38BSW** | Tuerca 3/8" galv.; ~162 |
| `FIJACIONES.arandela_carrocero` | Sí (nuevo) | **ARDC38** | Arandela carrocero 3/8"; ~163 |
| `FIJACIONES.arandela_plana` | Sí | **ARPLA38** | Ya documentado; ~167 |
| `FIJACIONES.arandela_pp` | Sí (nuevo) | **TORTPPBC** | Tortuga PVC blanca; ~164 |
| `FIJACIONES.arandela_pp_gris` | Sí (nuevo) | **TORTPPGR** | Tortuga gris; ~165 |
| `FIJACIONES.taco_expansivo` | Sí (nuevo) | **TACEX38** | Taco expansivo 3/8"; ~166 |
| `FIJACIONES.caballete` | Sí | **CABROJ** | Existente |
| `FIJACIONES.anclaje_h` … tornillos … | Sí | *ver mapping* | ANC100MM, THEX*, T1PERF, etc. |

**Plan hoja de cálculo:** rellenar col D en BROMYROS con los SKU de la tabla; volver a exportar CSV; opcional `npm run matriz:sync-fijaciones-isodec` para traer F/L/T a `constants.js`.

---

## 2. Estado: `SELLADORES`

| Path | SKU col D | Notas |
|------|-----------|--------|
| `SELLADORES.silicona` | **BROMPLAST** | Existente |
| `SELLADORES.silicona_300_neutra` | **SIL300N** | Fila ~168; script `matriz:sync-silicona-300` |
| `SELLADORES.cinta_butilo` | **CBUT** | Existente |
| `SELLADORES.membrana` | **MEMB3010** | Nuevo — rollo 30 cm × 10 m |
| `SELLADORES.espuma_pu` | **ESPPUGR** | Nuevo — espuma PU gris |

---

## 3. Estado: `PERFIL_TECHO` (SKU en objeto, muchos fuera del mapping)

### 3.1 Numéricos 68xx / 680x (Isodec EPS)

Convención Bromyros histórica: **código numérico en col D**. Quedan mapeados 1:1 al path anidado.

| SKU (constants) | Path |
|-----------------|------|
| 6838–6841 | `gotero_frontal.ISODEC.{100,150,200,250}` |
| 6842–6845 | `gotero_lateral.ISODEC.{100,150,200,250}` |
| 6828 | `babeta_adosar.ISODEC._all` |
| 6865 | `babeta_empotrar.ISODEC._all` |
| 6847 | `cumbrera.ISODEC._all` |
| 6801 | `canalon.ISODEC.100` |
| 6802–6804 | `canalon.ISODEC.{150,200,250}` |
| 6805 | `soporte_canalon.ISODEC._all` |

**Limitación:** En `constants.js`, **ISODEC_PIR** reutiliza el mismo precio en `babeta_*`, `cumbrera`, `soporte_canalon`, y parte de canalón que **ISODEC**. El import CSV solo actualiza el path mapeado por SKU; las ramas `_ISODEC_PIR_` gemelas **no** se actualizan solas. Opciones: (a) mantener precios iguales y script dual-write en el futuro; (b) filas MATRIZ extra con SKU distintos (p. ej. `6828PIR`) si algún día difieren.

### 3.2 Canalón 120 mm

| SKU en constants | Path canónico (mapping) |
|------------------|-------------------------|
| CAN.ISDC120 | `canalon.ISODEC.120` (y PIR 120 comparte precio hoy) |

En col D puede figurar `CAN.ISDC120` o `CANISDC120` (misma normalización salvo puntos: ver nota en §5).

### 3.3 Gotero lateral cámara Isodec

| SKU | Path |
|-----|------|
| GLDCAM-DC | `gotero_lateral_camara.ISODEC._all` (normalizado **GLDCAMDC**) |

### 3.4 Colisiones críticas — ISODEC PIR goteros (frontal vs lateral)

En `constants.js`, el **mismo SKU** aparece en **varios paths** (mismo precio hoy, pero el import solo puede actualizar **uno**):

| SKU actual | Paths afectados |
|------------|-----------------|
| **GF80DC** | frontal PIR 50; lateral PIR 50 y 80 |
| **GF120DC** | frontal PIR 80 y 120 |
| **GL80DC** | lateral PIR 50 y 80 |
| **GL120DC** | lateral PIR 120 |

**Plan recomendado (fase C):**

1. En MATRIZ, asignar SKU **disjuntos** por célula:

   - **GFFPIR50**, **GFFPIR80**, **GFFPIR120** → `gotero_frontal.ISODEC_PIR.{50,80,120}`
   - **GLLPIR50**, **GLLPIR80**, **GLLPIR120** → `gotero_lateral.ISODEC_PIR.{50,80,120}`

2. **Hecho en repo (2026-04-05):** el campo `sku` en `constants.js` y en `PanelinCalculadoraV3_legacy_inline.jsx` (eliminado el 2026-04-30) usaba **GFFPIR***/**GLLPIR*** (trazabilidad UI/PDF alineada al import CSV).

3. Mantener **GF80DC**, **GF120DC**, **GL80DC**, **GL120DC** en el mapping como **aliases** hacia un path único (retrocompatibilidad con filas antiguas de planilla).

### 3.5 Canalón PIR 50 / 80 (mismo `6801` que Isodec 100)

Mismo problema: un código, tres paths. SKU nuevos sugeridos en MATRIZ:

| SKU sugerido | Path |
|--------------|------|
| **CANPIR50** | `canalon.ISODEC_PIR.50` |
| **CANPIR80** | `canalon.ISODEC_PIR.80` |

`6801` queda solo para `canalon.ISODEC.100`.

---

## 4. Estado: `PERFIL_PARED`

Ninguno estaba en el mapping; todos cotizan por perfil en BOM pared.

| SKU (constants) | Path | Normalizado `normalizeSku` |
|-----------------|------|----------------------------|
| PU50MM | `perfil_u.ISOPANEL.50` | PU50MM |
| PU100MM | `perfil_u.ISOPANEL.100` (e ISOWALL.100) | PU100MM |
| PU150MM | `perfil_u.ISOPANEL.150` | PU150MM |
| PU200MM | `perfil_u.ISOPANEL.200` y `.250` | PU200MM |
| G2-100 … G2-250 | `perfil_g2.ISOPANEL.*` | G2100 … G2250 |
| K2 | `perfil_k2._all` | K2 |
| ESQ-EXT | `esquinero_ext._all` | ESQEXT |
| ESQ-INT | `esquinero_int._all` | ESQINT |
| PLECHU98 | `perfil_5852._all` | PLECHU98 |

**Nota:** PU50MM en ISOWALL 80 comparte SKU con ISOPANEL 50 — un SKU, dos paths; si en el futuro difieren precios, separar SKU (p. ej. **PU50IWL**).

---

## 5. Normalización y claves en código

- `normalizeSku` **no** elimina **puntos**. Si en col D está `CAN.ISDC120`, conviene añadir en el objeto la clave con punto entre comillas o duplicar alias **CANISDC120** (recomendado para evitar errores de tipeo).

---

## 6. Checklist de ejecución

1. **Fase A (hecho en repo):** ampliar `MATRIZ_SKU_TO_PATH` con numéricos 68xx, perfil pared, GLDCAMDC, selladores membrana/PU, fijaciones Isodec kit, aliases PIR y CANPIR*.
2. **Fase B (planilla):** rellenar col D en BROMYROS según tablas anteriores; verificar que no haya dos filas con distinto precio y mismo SKU.
3. **Fase C (opcional):** sustituir GF80DC / GF120DC / GL80DC / GL120DC en planilla y `constants.js` por GFFPIR* / GLLPIR*; añadir CANPIR50/80 si se desea import independiente para PIR.
4. **Verificación:** import CSV en Config → Listado de precios; `npm run matriz:reconcile` si aplica; `npm test` + smoke MATRIZ.

---

## Referencias

- Mapeo canónico: [`src/data/matrizPreciosMapping.js`](../../src/data/matrizPreciosMapping.js)
- Doc MATRIZ CSV: [`MATRIZ-PRECIOS-CALCULADORA.md`](./MATRIZ-PRECIOS-CALCULADORA.md)
