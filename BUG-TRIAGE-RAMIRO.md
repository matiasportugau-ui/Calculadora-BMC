# BUG-TRIAGE-RAMIRO.md — Ledger Wolf Bug Hunter
**Versión:** v0.7 — 12/06/2026 | **Triage:** Wolf (Claude) | **Fuentes (3):** (1) Reporte Ramiro Amaral 02/06/2026 (PDF); (2) Capturas 05/06/2026 — lista ampliada de tareas (ítems 8–16) + bug "Sin proveedor IA"; (3) Verificación directa de código y CSV de **producción** (repo `matiasportugau-ui/Calculadora-BMC@main`). | **Triangulación:** repo ↔ Matriz de Costos y Ventas Dashboard (tabs BROMYROS / R y C Tornillos / MONTFRIO) ↔ CSV en prod.

> **✓ v0.5 CERRADA** — consolidación por lanes completa: (1) PDF Ramiro, (2) capturas 05/06 (ítems 8–16 + "Sin proveedor IA"), (3) verificación de código + CSV de prod. Lane MATRIZ **integrada** (evidencia 68/20/3, corrimiento de columna descartado). Restricción de propiedad respetada: este ledger **no editó** `server/config.js` ni `src/data/matrizPreciosMapping.js` (lane del otro agente).

---

## Resumen ejecutivo

Reporte con 6 hallazgos → **4 tickets** (2 hallazgos agrupados por causa raíz compartida). Severidad máxima: **S1** (precios web de anclajes ~25% por debajo de la Matriz, error silencioso). Causa raíz dominante: **extracción Matriz→código sin validación, con corrimiento de columnas y filas**, agravada por una Matriz estructuralmente sucia (celdas `#VALUE!`/`#REF!`, SKUs duplicados, decimales mixtos coma/punto). No hubo ledger previo adjunto: numeración arranca en WOLF-2026-0001; dedup contra BUG-001/BUG-004 del repo de evals.

## Tabla índice

| ID | Título | Clase | Sev. | Estado | Golden case |
|---|---|---|---|---|---|
| WOLF-2026-0001 | Familia ISOFRIG completa ausente del catálogo | DATA | S2 | EN EVAL (patch en PR #332, GC-0001 verde) | GC-0001 verde |
| WOLF-2026-0002 | Precios desalineados con la Matriz por corrimiento de columna/fila (anclajes + goteros de cámara) | DATA | S1 | RESUELTO | Definido (GC-0002 verde, PR #276 merge) |
| WOLF-2026-0003 | Accesorios de borde faltantes (Isoroof 100, GSDECAM 100, laterales cámara Isodec por espesor, superior PIR 120) | DATA | S3 | EN EVAL (a+b cargados; c bloqueado, d skip) | GC-0003 verde (PR `wolf/0003-accesorios`) |
| WOLF-2026-0004 | Sin fuente única de verdad + Matriz con datos sucios (meta-raíz) | DATA/INFRA | S2 | CONFIRMADO — **etapa 2 (diff determinístico CI/cron) SHIPPED v0.7**; etapa 1 (saneamiento) sigue manual | Definido (eval de diff) |
| WOLF-2026-0005 | Sin proveedor IA en producción (intérprete de planos inactivo) | CONFIG/INFRA | S3 | ABIERTO | Definido (smoke `/api/planInterpret`) |

---

## WOLF-2026-0001 — Familia ISOFRIG completa ausente del catálogo
**Estado:** EN EVAL (patch 12/06/2026 en PR #332, branch `claude/isofrig-family-catalog-3gd2yn`; GC-0001 verde; cierre pendiente del merge de Matias + smoke UI en Vercel preview) | **Clase:** DATA | **Severidad:** S2 | **Reportó:** Ramiro Amaral, 02/06/2026

> **✓ Patch 12/06/2026 — D5 resuelta por triangulación.** Ficha oficial Kingspan (https://kingspan.com.uy/productos-kingspan/panel-isofrig) validada: núcleo **PIR en todos los espesores**, **au 1.10 m (1100 mm)** — la build legacy traía 1.14 copiado de ISOPANEL, corregido —, solo Blanco sanitario, espesores 40–200. Cargado en `constants.js`: familia `ISOFRIG_PIR` (7 espesores 40–180, `web` ex-IVA textual de la Matriz; **fila 200 clonada excluida**), perfil U ISOFRIG (80/100/150 vía PU* compartidos; **40/60/120/180 TODO-blocked** — precios de los U ISOFRIG-específicos de la Matriz no recibidos), visibilidad en `camara_frig` (+ `presupuesto_libre` automático vía `presupuestoLibreCatalogo`). `lmin/lmax` 2.3–14 = precedente build legacy (ficha no publica largos; confirmar con Bromyros). **TODO-blocked:** `venta`/`costo` por espesor (no estaban en ledger ni CSV en sesión; cargar de Matriz cuando Matias valide columnas — mientras tanto lista venta cae a web vía fallback de `p()` y la familia no aparece en el editor de precios).

### HUNT
- Cita textual del reporte: *"No aparece ISOFRIG in ningún espesor. Tampoco están cargados sus accesorios específicos ni sus fórmulas dentro del sistema de cotización."*
- Causa probable según Ramiro: *"Cuando se creó la calculadora, estos paneles no se usaban ni se cotizaban con frecuencia, por lo que no fueron incluidos."*

### OBSERVE
- `hecho confirmado` (repo): `grep -ci ISOFRIG` = **0** en `src/data/pricing.js`, `src/data/constants.js` and `src/utils/calculations.js` (@main, verificado 03/06).
- `hecho confirmado` (Matriz, tab BROMYROS): la familia existe completa — **IF40, IF60-IFSL60, IF80-IFSL80, IF100-IFSL100, IF120-IFSL120, IF150-IFSL150, IF180-IFSL180 y una fila 200 mm** (esta última con SKU/nombre clonados de IF150: error en la Matriz, ver WOLF-0004). Venta web ex IVA textual: 55.3384 / 62.8919 / 69.3770 / 76.9454 / 89.4740 / 93.3436 / 111.4058 / 111.0032.
- `hecho confirmado` (Matriz, sección Perfil U): existen perfiles específicos ISOFRIG — U 40, U 60, U 120, U 180 mm.
- `duda abierta`: fórmulas/reglas propias de ISOFRIG (au, lmin/lmax, sistema de fijación) no documentadas en la Matriz; definirlas con Kingspan/Bromyros o ficha técnica antes de cargar.
- Dedup: **nuevo** (sin relación con BUG-001/BUG-004).

### WHY
- DATA. 5-Whys: no cotiza ISOFRIG → no está en `constants.js` → el levantamiento inicial no lo incluyó → en ese momento no se vendía con frecuencia → no existe proceso de actualización catálogo↔Matriz (→ WOLF-0004). **Confianza: 95%.**
- Reproducibilidad: abrir calculadora → escenario Cámara Frigorífica o cualquier selector de familia → ISOFRIG no aparece como opción.

### LOCK
- Plan patch: cargar familia ISOFRIG in `constants.js` (8 espesores + perfiles U ISOFRIG) con precios tomados de la Matriz **después** de que Matias valide la columna web oficial and corrija la fila 200 mm.
- Plan raíz: cubierto por WOLF-2026-0004 (pipeline Matriz saneada → export → catálogo con validación).
- Owner sugerido: Claude Code (carga) + Matias manual (validación de columnas and reglas técnicas ISOFRIG).
- Golden case GC-0001: cotización `presupuesto_libre` / panel ISOFRIG 100 mm, 10 m², lista web → unitario esperado **76.9454 USD/m² ex IVA** (Matriz BROMYROS, fila IF100, columna Venta web USD ex IVA; validar columna). Hoy: producto inexistente (fallo esperado del eval hasta el fix).
- Criterio de cierre: GC-0001 en verde en `calculadora-bmc-evals`.

---

## WOLF-2026-0002 — Precios desalineados con la Matriz por corrimiento de columna/fila en la extracción
**Estado:** RESUELTO (patch mergeado vía PR #276, branch `wolf/0002-precios`, commits `9c1ccf0` + `e937381` + `baa90a9`) | **Clase:** DATA | **Severidad:** S1 (precio erróneo silencioso) | **Reportó:** Ramiro Amaral, 02/06/2026 (alcance ampliado por triage)

### HUNT
- Cita textual: *"Se detectaron precios mal cargados en anclajes usados para Isodec."* Causa probable según Ramiro: *"La IA o sistema de levantamiento de datos interpretó mal valores decimales de la Matriz de Costos."* Tarea delegada: *"Revisar errores de interpretación decimal en precios. (Evalualo vos)"*.
- El reporte no especifica SKUs ni valores; el triage los identificó.

### OBSERVE — evidencia archivo:línea vs Matriz (valores textuales)
**Anclajes (`constants.js` 171, 194–198):** el campo `web` del código coincide con la columna **"Venta + IVA" local** de la Matriz, no con la columna web. Los `costo` tampoco coinciden con la columna Costo.

| SKU código (línea) | código venta/web | Matriz venta+IVA | Matriz web | Delta web |
|---|---|---|---|---|
| anclaje_h (171) | 4.89 / **5.96** | 5.96 | **8.00** | **−25.5%** |
| anclaje_isoroof_terracota (194) | 1.31 / **1.60** | 1.60 | **2.15** | **−25.6%** |
| anclaje_isoroof_gris (195) | 1.31 / **1.60** | 1.60 | **2.15** | **−25.6%** |
| anclaje_chapa_bc18 (196) | 0.98 / **1.20** | 1.20 | **1.61** | **−25.5%** |
| anclaje_chapa_bc35 (197) | 0.98 / **1.20** | 1.20 | **1.61** | **−25.5%** |
| anclaje_kit_u_platea (198) | 0.89 / **1.09** | 1.09 | **1.46** | **−25.3%** |

**Goteros de cámara (`constants.js` 289–304) — corrimiento de FILA confirmado:**
- `GSDECAM80` (línea 304): código venta 29.94 / web 34.93 = **exactamente la fila GFSUP30 "Gotero Superior 30mm Prep."** de la Matriz (29.9400 / 34.9300). Smoking gun del corrimiento de filas.
- `GSDECAM50` (303): código 27.32/33.34 vs Matriz 28.992/33.824 → desalineado.
- `GLDCAM50` (289): código 22.32/27.23 vs Matriz 23.676/27.622 → desalineado.
- `GLDCAM80` (290): código 25.11/30.63 vs Matriz 26.64/31.08 → desalineado.
- En todos, `web = venta × 1.22` (consistencia interna), pero la **base** está errada: el error vino de la extracción, no del cálculo.
- `inferencia` (mecanismo): la Matriz tiene SKUs duplicados (GFSUP80 usado para 80 and 100 mm; GSDECAM80 para 80 and 100; GL80 para 80 and 100; GLDCAM80 para 80 and 100) and celdas `#VALUE!`/`#REF!` in la columna Costo, más celdas con coma decimal textual (`"32,84"`). Cualquier extractor (humano o IA) sin validación se corre de fila/columna ahí. La hipótesis "decimal" de Ramiro era razonable; la evidencia apunta a **mapeo fila/columna erróneo** como mecanismo dominante, con el formato mixto como agravante.
- Dedup: **relacionado pero NO duplicado de BUG-004** (BUG-004 = subestimación de *cantidad* de anclajes, LOGIC; este = *precio*, DATA). Cross-referenciar.
- **Refinamiento de mecanismo (v0.5, evidencia CSV de prod):** el conteo del CSV en producción (`costo` poblado 68/88 filas, `venta_local` 20/88, `venta_web` 3/88) **descarta el corrimiento de columna** como mecanismo dominante. La raíz real es **celdas de venta vacías en el origen**: cuando faltaba `venta_web`, el levantamiento rellenó con la columna disponible (venta+IVA local), produciendo la discrepancia. El fix de PR #276 sigue siendo válido (realineó a los valores correctos de la Matriz); lo que cambia es el *diagnóstico*, no la *resolución*. El título del ticket queda como histórico; la causa precisa migra a WOLF-0004. **Confianza mecanismo: 90% (revisada).**

### WHY
- DATA. 5-Whys: cobra de menos in web → `web` carga la columna equivocada → la extracción Matriz→constants.js mapeó mal columnas/filas → la Matriz no tiene estructura estable (SKUs duplicados, headers inconsistentes, #VALUE!) → no hay validación post-extracción contra la fuente (→ WOLF-0004). **Confianza: 90%** (85% in el mecanismo exacto; 100% in la discrepancia).
- Reproducibilidad: cotizar in lista web cualquier ítem de anclaje (p.ej. "Anclaje Isoroof GRISES") → calculadora muestra 1.60; Matriz web indica 2.15.

### LOCK
- Plan patch: corrección manual de los 6 anclajes + 4 goteros de cámara in `constants.js` con los valores de la Matriz **una vez que Matias confirme qué columna es la lista web oficial** (duda abierta D1). Un commit, diff mínimo.
- Plan raíz: WOLF-2026-0004 (validación automática código↔Matriz; control de rango/orden de magnitud como pidió Ramiro: *"Agregar controles de validación para evitar errores de formato decimal y precios fuera de rango"*).
- Owner sugerido: Claude Code (patch) tras validación de Matias.
- Golden case GC-0002: cotización `presupuesto_libre`, lista web: `anclaje_isoroof_gris` ×100 → **215.00 USD ex IVA** (2.15 c/u, Matriz R and C Tornillos, fila "1 Anclaje de Isoroof GRISES"); and `gotero_superior` cámara 80 mm ×1 (3.03 m) → web esperado **37.072 ex IVA** (Matriz GSDECAM80 80 mm). Validar columnas antes de fijar el eval.
- Criterio de cierre: GC-0002 in verde in `calculadora-bmc-evals`.

---

## WOLF-2026-0003 — Accesorios de borde faltantes in el catálogo
**Estado:** EN EVAL (v0.7: (a)+(b) cargados, GC-0003 verde; (c) bloqueado por dato; (d) skip por D2) | **Clase:** DATA | **Severidad:** S3 | **Reportó:** Ramiro Amaral, 02/06/2026

### HUNT
Citas textuales: *"Faltan accesorios Isoroof 100 mm — Agregar todos los accesorios correspondientes"*; *"Falta gotero superior de cámara para Isoroof — (50mm - 80mm - 100mm)"*; *"Faltan goteros laterales de cámara Isodec — Agregar familia completa in 100, 150, 200 y 250 mm"*; *"Falta gotero superior Isodec PIR 120 mm"*.

### OBSERVE (por sub-item)
- **(a) Gotero superior de cámara Isoroof:** el código SÍ tiene GSDECAM 30/50/80 (`constants.js` 302–304, con precios errados → WOLF-0002). **Falta el 100 mm**, que in la Matriz existe ("Gotero Superior - DE CAMARA 100mm", venta 39.468 / web ex 46.0460, con SKU clonado GSDECAM80 → corregir SKU al cargar). Refinamiento del reporte: no faltan 50/80 (están mal valuados); falta 100.
- **(b) Goteros laterales de cámara Isodec:** el código colapsó la familia in un genérico `_all` (GLDCAM-DC, líneas 292–293). La Matriz tiene los 4 espesores: "Perfil Ch. Gotero Lateral Cámara 100/150/200/250 mm" — web ex IVA textual 27.6640 / 28.9100 / 43.2740 / 37.5900. `duda abierta` D3: in la Matriz el 200 (43.27) cuesta más que el 250 (37.59) — validar antes de cargar. Nota Matriz: 150/200/250 marcados "REVISAR - inabilitado in ML".
- **(c) Accesorios Isoroof 100 mm:** Matriz los tiene a medias con SKUs clonados del 80 (GFSUP80 reutilizado para "Gotero Superior 100mm", GL80 para "Gotero Lateral 100mm"). Confirmar set completo a cargar.
- **(d) Gotero superior Isodec PIR 120 mm:** `duda abierta` D2 — no localizado como SKU dedicado in la Matriz (existen GF120DC frontal and GL120DC lateral PIR 120). El código mapea "Gotero frontal Superior" de ISODEC/PIR al id `gotero_frontal` (líneas 546–548). Confirmar con Ramiro si el faltante es un SKU nuevo o el GF120DC usado como superior.
- **(e) `web` de anclajes/fijaciones — RESUELTO (CSV R and C Tornillos, 07/06):** la pestaña *R and C Tornillos* **sí tiene** columna web — es la **col M "Shopify" (web ex-IVA)** + **col N "Shopify IVA inc." (c/IVA = ×1.22)**, más a la derecha (no se veía in el screenshot recortado). Mapeo de columnas confirmado: **F**=Producto · **G**=Costo ex-IVA · **J**=VENTA ex-IVA · **K**=Consumidor c/IVA · **M**=Shopify web ex-IVA · **N**=Shopify c/IVA. Los 6 `web` del PR WOLF-0002 **coinciden exactos con la col M**: 100mm 8.00 (N 9.76) · Terracota/Gris 2.15 (2.62) · BC-18/BC-35 1.61 (1.96) · Kit U-Platea 1.46 (1.79). → **`web` de anclajes validado.** (Nota: el *storefront* de Shopify publica estas fijaciones in **packs de 10**; la col M de la Matriz es el precio **por-unidad** equivalente, que es lo que carga `constants.js`.)
- Dedup (e): la columna web siempre existió in R and C Tornillos; el triage previo la dio por ausente por screenshot recortado.
- Dedup: **nuevo**; causa raíz compartida con 0001/0002 (cross-ref WOLF-0004).

### WHY
- DATA. Misma raíz: carga inicial incompleta + sin proceso de sincronización; agravante: la propia Matriz tiene estos ítems con SKUs sucios o flags "REVISAR". **Confianza: 90%.**
- Reproducibilidad: configurar techo ISOROOF 100 mm o cámara con bordes → los accesorios listados no aparecen como opción.

### LOCK
- Plan patch: cargar (a) GSDECAM100, (b) familia GLDCAM Isodec por espesor 100–250 reemplazando el `_all`, (c) set Isoroof 100, (d) según respuesta D2 — con SKUs corregidos (no heredar los clonados de la Matriz). (e) `web` de fijaciones YA validado vs col M "Shopify" de R and C Tornillos — sin acción de carga; el pendiente es de pipeline (ver D6/bloqueo SKU abajo).
- Plan raíz: WOLF-2026-0004.
- Owner sugerido: Claude Code, tras validación de D2/D3 por Matias/Ramiro.
- Golden case GC-0003: cotización techo ISODEC con borde lateral cámara 150 mm, 3 m, lista web → **28.9100 USD ex IVA** por barra de 3 m (Matriz, fila "Perfil Ch. Gotero Lateral Cámara 150 mm"; validar columna/precio D3). Hoy: opción inexistente por espesor (fallo esperado).
- Criterio de cierre: GC-0003 in verde in `calculadora-bmc-evals`.

### EJECUCIÓN v0.7 (11/06/2026, branch `wolf/0003-accesorios`) — estado por sub-item
- **(a) GSDECAM100 — ✅ CARGADO** (`constants.js` `gotero_superior.ISODEC_PIR[100]`). `venta` 39.468 / `web` 46.046 verbatim de la Matriz (ledger v0.6). SKU corregido `GSDECAM100` (la Matriz clona `GSDECAM80`). `costo: null` — celda Matriz `#REF!` (WOLF-0004), `costo` se lee con `?? 0`. `hecho confirmado`.
- **(b) Goteros laterales de cámara Isodec por espesor — ✅ CARGADO** (`gotero_lateral_camara.ISODEC` e `ISODEC_PIR`, 100/150/200/250). `web` verbatim: 27.664 / 28.91 / 43.274 / 37.59. Colapso `_all` (SKU genérico) **eliminado** (`grep -c` del SKU genérico = 0). SKUs corregidos `GLDCAM100..250`. `venta`/`costo: null` — la Matriz/ledger **no** proveen esas columnas por espesor; `p()` cae a web (lista activa default = web). `duda abierta`: completar `venta`/`costo` desde la Matriz (WOLF-0004).
  - **D3 (`duda abierta`, sin resolver):** 200 mm (43.274) > 250 mm (37.59); filas 150/200/250 "REVISAR - inabilitado in ML". Valores cargados **verbatim** (no se inventó/corrigió). Pendiente confirmación de Ramiro/Matias.
  - **`duda abierta` nueva (PIR):** los paneles ISODEC_PIR (50/80/120) ya **no** resuelven gotero lateral de cámara (antes lo atrapaba el `_all`). Confirmar si mapean a las medidas EPS 100–250 o son producto aparte. Degradación silenciosa segura (`resolveSKU_techo` → `null` → perfil omitido del BOM, sin crash).
- **(c) Accesorios Isoroof 100 mm — ⛔ BLOQUEADO (dato).** La Matriz reusa SKUs del 80 (`GFSUP80`/`GL80`/`GFS80`) para las filas de 100 mm and **no se proveyó el CSV BROMYROS in sesión**. Guardrail "nunca inventar precio" → no se cargan entradas in $0/null vivas (riesgo de cotización a $0). Acción: Matias pega las filas 100 mm de la Matriz → se cargan con SKUs corregidos `GFSUP100`/`GL100`/`GFS100`.
- **(d) Gotero superior Isodec PIR 120 — ⏭️ SKIP.** D2 sin resolver (¿SKU nuevo o `GF120DC` usado como superior?). Per goal: si D2 no está resuelto al correr, se omite and se registra. Sin cambios.

**Deliverables v0.7:** branch `wolf/0003-accesorios` (designado por harness: `claude/wolf-0003-accesorios-lyp1r8`), `evals/golden-cases/GC-0003.test.mjs` (verde: 9/9), diff acotado a `src/data/constants.js` + este ledger. **GC-0002 sigue verde** (sin regresión). Suite `tests/validation.js` 399/399.

---

## WOLF-2026-0004 — Sin fuente única de verdad + Matriz con datos sucios (meta-raíz)
**Estado:** CONFIRMADO — **etapa 2 (diff determinístico CI/cron) SHIPPED v0.7**; etapa 1 (saneamiento) sigue manual | **Clase:** DATA/INFRA (estructural) | **Severidad:** S2 | **Reportó:** Ramiro Amaral (raíz) + hallazgos del triage, 02-03/06/2026

> **⚠ CORRECCIÓN v0.5 — el triage previo (v0.1–v0.4) subestimó lo ya construido.** Existe un pipeline de reconciliación Matriz↔Stock↔catálogo funcional, no era "etapa 0". Lo que falta es **automatizarlo** (diff determinístico in CI/cron) and definir la **tab limpia EXPORT_CATALOGO**. Ver OBSERVE actualizado.

### HUNT
- Citas textuales del reporte: *"Falta de conexión directa con una fuente única de verdad"*; *"La principal mejora recomendada es conectar o validar la calculadora contra la Matriz de Costos y Ventas Dashboard. Eso eliminaría el problema de Raíz and nos evitaría tener que actualizar manualmente."*
- Hallazgo del triage que Ramiro no vio: **la Matriz misma no está in condiciones de ser fuente única hoy.**

### OBSERVE — suciedad de la Matriz (tab BROMYROS, evidencia textual)
- Celdas de Costo con `#VALUE!` (toda la sección GOTERO FRONTAL/LATERAL 3M) and `#REF!` (GFS50, GSDECAM 100).
- SKUs duplicados para productos distintos: GFS80 (80 mm and fila "0"), GFSUP80 (80 and 100 mm), GL80 (80 and 100 mm), GSDECAM80 (80 and 100 mm), GLDCAM80 (80 and 100 mm), CAN.ISDC120 (50, 80 and 120 mm), IF150-IFSL150 (150 and 200 mm con nombre clonado).
- Decimales mixtos: columnas con punto and celdas textuales con coma (`"32,84"`, `"36,94"`, `"41,42"`, `"45,52"` in ISODEC EPS; `"10,27"` in Bromplast).
- Anomalías de precio a validar: lateral cámara 200 > 250 (D3); "Gotero Lateral CAMARA 100mm" (16.848) más barato que el 50 mm (23.676).
- `hecho confirmado` (repo): el comentario in `constants.js:164` ya pedía *"Sincronizar precios con MATRIZ"* — la intención existía, el proceso no.
- El CSV `normalized_full_cleaned.csv` **no está in `main`** (404 in rutas estándar): el catálogo efectivo vive hardcodeado in `constants.js`. `duda abierta` D4: ubicación/estado real del CSV.
- **`hecho confirmado` (CSV de prod, v0.5):** el CSV efectivo in producción tiene `costo` poblado in **68/88** filas, `venta_local` in **20/88** and `venta_web` in solo **3/88**. → La mayoría de las ventas **están vacías in el origen**; esa es la causa raíz de las discrepancias de precio (no un corrimiento de columna). Cualquier sync que no contemple celdas vacías va a propagar o inventar valores. La etapa de saneamiento debe **completar las ventas faltantes in el origen** antes de habilitar el push automático.
- **`hecho confirmado` (repo, CORRECCIÓN v0.5): el pipeline Matriz→Calculadora YA EXISTE (parcial).** Componentes verificados:
  - `server/lib/productosMaestro.js` → `reconcileProductosMaestro()`: compara **Matriz (CSV de Google Sheets, `config.bmcMatrizSheetId`) ↔ Stock workbook ↔ catálogo** and reporta gaps (`linked` / `matrizOnly` / `stockOnly`).
  - Endpoints `GET /api/productos-maestro/reconcile` (reporte de links) and `POST /api/productos-maestro/push` (write real a Sheets, requiere token admin). Script npm asociado: `productos-maestro:reconcile`.
  - UI admin `src/components/ProductosMaestroEditor.jsx` (Config → Productos): editar `costo` / `ventaLocal` / `ventaWeb`, ver vinculaciones, simular (`dryRun=true`) and escribir cambios reales a Sheets.
  - Conclusión: las etapas 1 (UI de carga/edición) and parte de la 3 (carga asistida) **ya están**. Lo ausente es el **diff determinístico automatizado** (CI/cron) and la **tab limpia EXPORT_CATALOGO** como contrato de sincronización. **No edito** `src/data/matrizPreciosMapping.js` (otro agente / lane MATRIZ).

### WHY
- Estructural. 5-Whys: los datos divergen → cada actualización es manual and sin verificación → no hay export validado de la Matriz → la Matriz mezcla costeo interno, notas and catálogo in una sola hoja sin esquema → nunca se definió la frontera "fuente de verdad limpia" vs "hoja de trabajo". **Confianza: 90%.**

### LOCK
- Plan patch: ninguno (es la raíz, no se parchea).
- Plan raíz (3 etapas, absorbe las "Tareas Profundas" de Ramiro + ítems 8–12 de las capturas 05/06). **Estado actualizado v0.5:**
  1. **Sanear la Matriz / origen** — ⏳ PENDIENTE (decisión de negocio): corregir SKUs duplicados, #VALUE!/#REF!, anomalías D3, formato decimal único, **y completar las ventas vacías in el CSV de origen** (20/88 venta_local, 3/88 venta_web) — o crear una tab `EXPORT_CATALOGO` limpia (SKU único, columnas fijas: costo, venta_ex_iva, web_ex_iva) como único contrato de sync.
  2. **Diff determinístico** (script, no LLM) — 🟢 **HECHO (v0.7, etapa 2)**: nuevo `scripts/catalog-diff.mjs` + workflow `.github/workflows/catalog-diff.yml` (cron diario 09:00 UTC + trigger in PRs que tocan `src/data/constants.js`). Compara catálogo (`constants.js`) ↔ MATRIZ viva (CSV `GET /api/actualizar-precios-calculadora`, reutiliza el service-account ya montado in prod — sin credenciales nuevas) and **falla (exit 1) in S1**: divergencia relativa > umbral (default 1 %, piso absoluto 0.01 USD) o valor de catálogo **fuera de banda de magnitud** por categoría (control de "precios fuera de rango" + "errores de formato decimal" que pidió Ramiro). Política de celda vacía: `EMPTY` → `no-source`, **nunca** se compara ni se rellena (atrapa el mecanismo de WOLF-0002); `0` se trata como placeholder/faltante; `#VALUE!`/`#REF!` → celda-error; SKU duplicado → `duplicate-sku`, no compara nada; coma decimal normalizada con función testeada (`32,84` → 32.84, no 3284). Tests unitarios: `tests/catalogDiff.test.js` (in `test:core`). npm: `catalog:diff` / `catalog:diff:json`. **Gate del PR = baseline-aware** (regresión): corre el diff sobre el `constants.js` de la base and el del HEAD (misma MATRIZ viva) and **falla sólo ante S1 nuevos/peores que introduce el PR**, no ante el drift pre-existente — así el control es adoptable and no bloquea PRs ajenos mientras la etapa 1 sigue pendiente. El **cron diario** mantiene el reporte absoluto (falla ante cualquier S1). **Primer run absoluto vs prod (sample `audit-output/catalog-diff/2026-06-11.md`):** 51 divergencias S1 (mayormente `costo`, drift sistemático catálogo↔MATRIZ ~2.8–8 %) documentadas — exactamente el control que pedía Ramiro; cerrarlas es etapa 1 (saneamiento/decisión de fuente de verdad por campo, Matias) vía `matriz:bake`. Restricción de lane respetada: sin tocar `server/config.js` ni `src/data/matrizPreciosMapping.js`.
  3. **Carga asistida** — 🟢 EN GRAN PARTE HECHA: `ProductosMaestroEditor.jsx` permite editar precios and `push` real a Sheets con dry-run. Los fixes 0001/0003 pueden entrar por acá una vez resueltas las dudas de dato (D2/D3/D5).
- Owner sugerido: Matias manual (etapa 1, decisiones de negocio + completar origen) + Claude Code (automatizar etapa 2). **Coordinación de lane:** los cambios sobre `matrizPreciosMapping.js` and `config.js` los hace el **otro agente (lane MATRIZ)**; este ledger solo documenta.
- Golden case GC-0004: correr el diff sobre los SKUs de GC-0001/0002/0003 → cero divergencias.
- Criterio de cierre: diff in verde integrado al pipeline de evals.

---

## WOLF-2026-0005 — Sin proveedor IA in producción (intérprete de planos inactivo)
**Estado:** ABIERTO | **Clase:** CONFIG/INFRA (no es bug de código) | **Severidad:** S3 | **Reportó:** Matias, 05/06/2026 (capturas del wizard)

### HUNT
- Evidencia: capturas 05/06 del wizard de la calculadora (paso *Dimensiones* 5/11) con banner rojo *"Sin proveedor IA configurada. Configurá ANTHROPIC_API_KEY o GEMINI_API_KEY."* Nota de Matias: *"No estaría funcionando por el momento esa función."*

### OBSERVE
- `hecho confirmado` (repo): el string proviene de `server/lib/planInterpreter.js:37-41`, función `interpretPlan()` (expuesta por el endpoint `/api/planInterpret`). Si **ni** `ANTHROPIC_API_KEY` **ni** `GEMINI_API_KEY` están seteadas, lanza error 503 con ese mensaje.
- **Feature:** interpretación de **planos** (imagen / PDF / DXF) para auto-extraer dimensiones de techo/pared in el wizard. Es una **ayuda opcional** — la entrada manual de medidas funciona sin IA; el resto del wizard no se bloquea.
- **No es defecto de código:** el código maneja la ausencia de clave correctamente (degradación elegante con mensaje claro). El faltante es de **configuración de runtime in producción** (Cloud Run / Doppler `bmc-backend/prd`): no hay secret de proveedor IA cargado.
- Alcance: este ticket **no toca `server/config.js`** (lo maneja otro agente). El fix es operacional: setear el secret and redeploy.

### WHY
- CONFIG. 5-Whys: el intérprete de planos devuelve 503 → no hay proveedor IA → no se cargó `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` in el entorno de prod → la feature se deployó sin aprovisionar su secret → no hay check de capacidades que avise in deploy. **Confianza: 95%.**

### LOCK
- Plan patch: setear `ANTHROPIC_API_KEY` (o `GEMINI_API_KEY`) in GCP Secret Manager / Cloud Run del servicio `panelin-calc` and mirror in Doppler `bmc-backend/prd`; redeploy; verificar. **Decisión de Matias:** qué proveedor + costo asociado.
- Owner sugerido: Matias / lane deploy (config de runtime). No requiere cambio de código.
- Golden case GC-0005: `POST /api/planInterpret` con un plano de prueba in prod → responde 200 con dimensiones (no 503). Hoy: 503 esperado hasta aprovisionar el secret.
- Criterio de cierre: smoke de `/api/planInterpret` in verde + banner desaparece del wizard in prod.

---

## FEATURES (derivados, no son tickets WOLF)
- Selector de lista de precios in UI: default **Local BMC** (venta), opciones **Web** and **Mercado Libre** (hoy ML = Web). Definido por Matias 03/06 — a futuro, no bloquea los fixes.
- Las "Tareas Profundas" del reporte (sistema de toma de datos de la Matriz, validación, mejora de ingreso de productos) son el plan raíz de WOLF-2026-0004.

## LANES DE TRABAJO (v0.5) — consolidación multi-agente

La lista ampliada de las capturas 05/06 (ítems 8–16) se reparte in lanes con dueños distintos. Este ledger es el punto de consolidación; cada lane escribe su propia sección.

### Lane MATRIZ (ítems 8–12) — owner: otro agente / Matias
> **✓ Integrada in los tickets WOLF.** Cubre ítems 8–12 (validar precios vs Matriz, fuente única de verdad, sync automático/semiautomático, mejora de UI de carga). El contenido técnico de esta lane está consolidado in **WOLF-0004** (OBSERVE/LOCK: pipeline `productosMaestro` parcial ya existente, evidencia CSV de prod 68/20/3, plan raíz 3 etapas) and **WOLF-0002** (refinamiento de mecanismo: corrimiento de columna descartado). Restricción de archivos respetada: este agente **no editó** `server/config.js` ni `src/data/matrizPreciosMapping.js` (los maneja el otro agente).

### Lane TIME TRACKER (ítems 13–16) — owner: este agente (Wolf/Claude) · verificado contra repo 05/06
Mapa de los 4 ítems de Time Tracker de las capturas contra `server/routes/traktime.js` + migraciones + `server/lib/traktimeInvoicePdf.js`:

| Ítem captura | Descripción | Estado | Evidencia |
|---|---|---|---|
| 13 | Registrar cliente, tarea y tiempo | ✅ **IMPLEMENTADO** | `traktime.js`: endpoints `/clients`, `/projects`, `/tasks`, `/timer/start`, `/entries`; tablas `tk_clients/tk_projects/tk_tasks/tk_entries` con `user_id`, `project_id`, `task_id`, `started_at`, `stopped_at`, `duration_seconds` |
| 14 | Microespacios de coordinación entre tareas (gaps) | ❌ **NO EXISTE** | Ningún reporte calcula huecos entre tareas consecutivas; migraciones 000–010 no tienen columna para esto |
| 15 | Jornada total (primera → última tarea del día) | ❌ **NO EXISTE** | Los reportes suman `duration_seconds` (tiempo efectivo) pero no calculan el *span* del día (inicio de la 1ª − fin de la última) |
| 16 | PDF mensual de tareas/horas para administración | ⚠ **PARCIAL — es de FACTURAS, no de horas** | `traktimeInvoicePdf.js` → `renderAndUploadInvoice()` genera PDF de **facturas mensuales** (subtotal + IVA, agrupado por proyecto) and sube a GCS; **no** es un reporte de jornada/horas trabajadas para RH/administración |

**Conclusión de lane:** de 4 ítems, 1 está completo (13), 2 no existen (14 y 15 — *jornada-total* and *microespacios*) and 1 está parcial con propósito distinto (16 = invoicing, falta el reporte de horas). Trabajo nuevo acotado: agregar cálculo de jornada-total + gaps sobre `tk_entries` (no requiere decisiones de negocio) and un nuevo template de PDF de horas (vs. el de facturas).

---

## Pendientes para Matias (priorizados)
1. **D1 — RESUELTA (03/06):** los campos guardan precios **ex IVA** (IVA 22% una vez al total). Mapeo confirmado: `venta` ← columna venta local ex IVA (**lista default**, uso interno BMC); `web` ← columna web ex IVA (= ML por ahora). La aritmética ×1.22 de la fila testigo GSDECAM80 valida el mapeo. Consecuencia: el patch WOLF-0002 corrige **ambas** columnas de los anclajes (venta local ~−18%, web ~−25%).
2. **D2 — "Gotero superior Isodec PIR 120":** ¿SKU nuevo o es el GF120DC usado como superior? (con Ramiro).
3. **D3 — Anomalías de precio in la Matriz:** lateral cámara 200 (43.27) > 250 (37.59); cámara 100 (16.85) < 50 (23.68). ¿Errores o reales?
4. **D4 — `normalized_full_cleaned.csv`:** ¿dónde vive hoy and sigue siendo fuente, o el catálogo efectivo es `constants.js`?
5. **D5 — PARCIALMENTE RESUELTA (12/06, ficha oficial Kingspan):** au = **1.10 m** (1100 mm), núcleo **PIR todos los espesores**, solo Blanco — cargado. Restan confirmar: **lmin/lmax** (ficha no publica largos; se usó precedente legacy 2.3–14), **venta/costo** por espesor (columnas Matriz) and **precios de perfiles U ISOFRIG-específicos** (U 40/60/120/180).
6. **D6 — RESUELTA (07/06, CSV):** fuente de verdad del **`web` de fijaciones = col M "Shopify"** de *R and C Tornillos* (web ex-IVA; col N = c/IVA). Ya está in la Matriz and **los 6 `web` del PR WOLF-0002 coinciden** → validado, sin acción de carga. **Bloqueo de pipeline (→ WOLF-0004):** las filas de anclajes de *R and C Tornillos* **no tienen SKU** (col D = flag "PENDIENTE"; col B "Código RyC" vacía in esas filas). El export/bake matchea por SKU→path (`matrizPreciosMapping.js`), así que para enchufar R and C Tornillos al pipeline **primero hay que poblar los SKUs `ANC*` in el sheet** (higiene de Matriz). No bloquea la calc (opera con LOCAL).

## Registro de versión
- **v0.7 (12/06/2026): WOLF-2026-0001 → EN EVAL.** Patch in PR #332 (`claude/isofrig-family-catalog-3gd2yn`): familia `ISOFRIG_PIR` cargada in `constants.js` (7 espesores 40–180 con `web` ex-IVA de la Matriz; fila 200 clonada excluida; au 1.10 corregido vs 1.14 legacy por **ficha oficial Kingspan** → D5 resuelta por triangulación ficha↔Matriz↔build legacy), perfil U ISOFRIG (80/100/150; 40/60/120/180 TODO-blocked sin precio), visibilidad `camara_frig`. **GC-0001 verde** (`evals/golden-cases/GC-0001.test.mjs`: dato crudo + camino `presupuesto_libre` 10 m² × 76.9454 + espesores + visibilidad + au); GC-0002 sigue verde. Pendientes: venta/costo por espesor (Matriz), precios U ISOFRIG-específicos, lmin/lmax confirmación Bromyros, merge de Matias + smoke UI. Extra de sesión: base de conocimiento de productos `docs/product-catalog/` (97 ítems del Shopify real; detectado desfasaje de precios Shopify↔Matriz in ISOFRIG DRAFT).
- **v0.7 (11/06/2026) — WOLF-0003 EN EVAL (carga de accesorios de borde).** Branch `wolf/0003-accesorios`. Cargado in `src/data/constants.js`: **(a)** `GSDECAM100` (venta 39.468 / web 46.046 verbatim, costo null por `#REF!`, SKU corregido); **(b)** familia `gotero_lateral_camara` Isodec/PIR por espesor 100/150/200/250 (web verbatim 27.664 / 28.91 / 43.274 / 37.59), **reemplazando el colapso `_all`** (SKU genérico eliminado, `grep -c` = 0), SKUs corregidos `GLDCAM100..250`, `venta`/`costo` null (columnas no provistas → `p()` cae a web). **(c)** Isoroof 100 mm **BLOQUEADO** (sin CSV BROMYROS in sesión; no se cargan precios $0/null vivos). **(d)** PIR 120 superior **SKIP** (D2 sin resolver). Golden case `GC-0003.test.mjs` **verde** (9/9), GC-0002 sin regresión, `tests/validation.js` 399/399, lint 0 errores. **Dudas abiertas:** D3 (anomalía 200>250, valores verbatim) and nueva (PIR 50/80/120 sin lateral cámara tras quitar `_all`). Diff acotado a `constants.js` + ledger + eval (sin tocar lane MATRIZ ni valores de PR #276).
- **v0.7 (11/06/2026) — WOLF-0004 etapa 2 SHIPPED (diff determinístico CI/cron).** Nuevos: `scripts/catalog-diff.mjs` (catálogo `constants.js` ↔ MATRIZ viva, no-LLM, determinístico; umbral 1 % + piso 0.01 USD + bandas de magnitud por categoría derivadas de la distribución actual; política `EMPTY`/`0`/`#VALUE!` que evita el backfill de WOLF-0002; detección de SKU duplicado; normalizador de coma decimal testeado), workflow `.github/workflows/catalog-diff.yml` (cron diario absoluto + PR-trigger **baseline-aware** in `src/data/constants.js`/`scripts/catalog-diff.mjs` que falla sólo ante regresiones nuevas vs la base, comentario sticky in PR + artifact, skip elegante si la MATRIZ no responde — reutiliza el service-account de prod, sin secretos nuevos), `tests/catalogDiff.test.js` (in `test:core`), npm `catalog:diff`/`catalog:diff:json`, and sample committeado `audit-output/catalog-diff/2026-06-11.md`. **El primer run sobre prod NO es verde:** 51 divergencias S1 (drift de `costo` catálogo↔MATRIZ ~2.8–8 %) documentadas — exactamente el control que pedía Ramiro; cerrarlas es etapa 1 (saneamiento/decisión de fuente de verdad por campo, Matias) vía `matriz:bake`. Restricción de lane respetada: sin tocar `server/config.js` ni `src/data/matrizPreciosMapping.js`.
- **v0.5 (05/06/2026, cerrada 06/06/2026) — lane MATRIZ integrada.** Consolidación de 3 fuentes (PDF Ramiro 02/06 + capturas 05/06 con lista ampliada 8–16 and bug IA + verificación de código/CSV prod). Cambios: (1) **WOLF-0004 corregido** — el pipeline Matriz→Calc YA existe parcial (`productosMaestro.js` + `ProductosMaestroEditor.jsx` + `productos-maestro:reconcile`); falta automatizar diff (CI/cron) + tab `EXPORT_CATALOGO`. (2) **Evidencia CSV prod** (costo 68/88, venta_local 20/88, venta_web 3/88) → descarta corrimiento de columna; raíz = ventas vacías in origen; refina el mecanismo de WOLF-0002 (resolución sigue válida). (3) **WOLF-0005 abierto** — "Sin proveedor IA in prod" (config Cloud Run/Doppler, `planInterpreter.js`; no es bug de código). (4) **Lane Time Tracker documentada** (ítems 13–16): 13 ✅; 14 (microespacios) and 15 (jornada-total) ✗ no existen; 16 PDF mensual = facturas, no horas. Restricción: este agente no editó `server/config.js` ni `src/data/matrizPreciosMapping.js`. **Próximo paso para cerrar v0.5:** integrar el texto de la lane MATRIZ de Matias.
- v0.6 (07/06/2026): CSV completo de *R and C Tornillos* recibido → **D6 RESUELTA**. El `web` de anclajes sí está in la Matriz (col M "Shopify" ex-IVA / col N c/IVA) and **coincide exacto con los 6 `web` del PR WOLF-0002** (8.00/2.15/2.15/1.61/1.61/1.46). Corregido the sub-hallazgo (e): la columna web no estaba ausente, el screenshot estaba recortado. Mapeo de columnas R and C Tornillos documentado (F/G/J/K/M/N). Nuevo bloqueo de pipeline: filas de anclajes sin SKU in el sheet → WOLF-0004 (poblar `ANC*` in col B/D) antes de mapear in `MATRIZ_TAB_COLUMNS`.
- v0.5 (07/06/2026): verificación post-merge WOLF-0002 contra la Matriz in vivo + Shopify. **Validados al céntimo:** 5 goteros de cámara (`venta`/`web`/`costo` vs BROMYROS, incl. `GSDECAM30 web=36.93` correcto) and 6 anclajes in `venta`+`costo` (vs `VENTA USD EX IVA`, con `Consumidor Final`=×1.22 confirmando ex-IVA). Descartado el falso positivo de "IVA duplicado" (Codex P2 / sospecha inicial). Nuevo sub-hallazgo **WOLF-0003 (e)**: el `web` de anclajes no tiene columna in la Matriz; el canal web vende in **packs de 10** (Shopify). **Decisión D6:** fuente de verdad del `web` de fijaciones = ML/Shopify (pendiente extracción). Fix cosmético aparte: typo label `Kin`→`Kit` in `anclaje_kit_u_platea`.
- v0.4 (04/06/2026): WOLF-2026-0002 → **RESUELTO**. Matias autorizó el merge; PR #276 mergeado a `main` (admin override, merge commit conservando los 3 commits atómicos `9c1ccf0` + `e937381` + `baa90a9`) and deploy de producción verificado. Tabla índice and sección del ticket actualizadas. Sin reabrir alcance gateado (D2/D3/D5, GLDCAM-DC `_all`).
- v0.3 (04/06/2026): WOLF-2026-0002 → **EN EVAL**. Patch aplicado in branch `wolf/0002-precios` (commit `9c1ccf0`): 11 entradas realineadas a la Matriz (6 anclajes + 5 goteros de cámara, ex-IVA, D1). Golden case **GC-0002** verde (`evals/golden-cases/GC-0002.test.mjs`): anclaje gris web ×100 = 215.00; gotero superior cámara 80 mm web = 37.07. Cierre del ticket pendiente del merge manual de Matias tras revisar el preview de Vercel.
- v0.2 (03/06/2026): D1 resuelta por Matias (precios ex IVA; `venta`←local, `web`←web; default Local BMC). Feature "selector de listas Local/Web/ML" registrada. Alcance del patch 0002 ampliado a ambas columnas.
- v0.1 (03/06/2026): triage inicial del reporte Ramiro 02/06. 4 tickets emitidos, todos CONFIRMADOS con triangulación repo+Matriz. Sin ledger previo (numeración inicia in 0001). Próximo paso: validar D1–D5 → goal de Claude Code para patch 0002 + cargas 0001/0003 + pipeline 0004 etapa 2, con golden cases in `calculadora-bmc-evals`.
