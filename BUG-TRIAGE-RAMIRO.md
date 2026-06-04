# BUG-TRIAGE-RAMIRO.md — Ledger Wolf Bug Hunter
**Versión:** v0.3 — 04/06/2026 | **Triage:** Wolf (Claude) | **Fuente:** Reporte Ramiro Amaral 02/06/2026 (PDF) | **Triangulación:** repo `matiasportugau-ui/Calculadora-BMC@main` (verificado por fetch directo) ↔ Matriz de Costos y Ventas Dashboard (Sheet pegado en sesión, tabs BROMYROS / R y C Tornillos / MONTFRIO)

---

## Resumen ejecutivo

Reporte con 6 hallazgos → **4 tickets** (2 hallazgos agrupados por causa raíz compartida). Severidad máxima: **S1** (precios web de anclajes ~25% por debajo de la Matriz, error silencioso). Causa raíz dominante: **extracción Matriz→código sin validación, con corrimiento de columnas y filas**, agravada por una Matriz estructuralmente sucia (celdas `#VALUE!`/`#REF!`, SKUs duplicados, decimales mixtos coma/punto). No hubo ledger previo adjunto: numeración arranca en WOLF-2026-0001; dedup contra BUG-001/BUG-004 del repo de evals.

## Tabla índice

| ID | Título | Clase | Sev. | Estado | Golden case |
|---|---|---|---|---|---|
| WOLF-2026-0001 | Familia ISOFRIG completa ausente del catálogo | DATA | S2 | CONFIRMADO | Definido |
| WOLF-2026-0002 | Precios desalineados con la Matriz por corrimiento de columna/fila (anclajes + goteros de cámara) | DATA | S1 | EN EVAL | Definido (GC-0002 verde) |
| WOLF-2026-0003 | Accesorios de borde faltantes (Isoroof 100, GSDECAM 100, laterales cámara Isodec por espesor, superior PIR 120) | DATA | S3 | CONFIRMADO (parcial) | Definido (1 sub-item pendiente-dato) |
| WOLF-2026-0004 | Sin fuente única de verdad + Matriz con datos sucios (meta-raíz) | DATA/INFRA | S2 | CONFIRMADO | Definido (eval de diff) |

---

## WOLF-2026-0001 — Familia ISOFRIG completa ausente del catálogo
**Estado:** CONFIRMADO | **Clase:** DATA | **Severidad:** S2 | **Reportó:** Ramiro Amaral, 02/06/2026

### HUNT
- Cita textual del reporte: *"No aparece ISOFRIG en ningún espesor. Tampoco están cargados sus accesorios específicos ni sus fórmulas dentro del sistema de cotización."*
- Causa probable según Ramiro: *"Cuando se creó la calculadora, estos paneles no se usaban ni se cotizaban con frecuencia, por lo que no fueron incluidos."*

### OBSERVE
- `hecho confirmado` (repo): `grep -ci ISOFRIG` = **0** en `src/data/pricing.js`, `src/data/constants.js` y `src/utils/calculations.js` (@main, verificado 03/06).
- `hecho confirmado` (Matriz, tab BROMYROS): la familia existe completa — **IF40, IF60-IFSL60, IF80-IFSL80, IF100-IFSL100, IF120-IFSL120, IF150-IFSL150, IF180-IFSL180 y una fila 200 mm** (esta última con SKU/nombre clonados de IF150: error en la Matriz, ver WOLF-0004). Venta web ex IVA textual: 55.3384 / 62.8919 / 69.3770 / 76.9454 / 89.4740 / 93.3436 / 111.4058 / 111.0032.
- `hecho confirmado` (Matriz, sección Perfil U): existen perfiles específicos ISOFRIG — U 40, U 60, U 120, U 180 mm.
- `duda abierta`: fórmulas/reglas propias de ISOFRIG (au, lmin/lmax, sistema de fijación) no documentadas en la Matriz; definirlas con Kingspan/Bromyros o ficha técnica antes de cargar.
- Dedup: **nuevo** (sin relación con BUG-001/BUG-004).

### WHY
- DATA. 5-Whys: no cotiza ISOFRIG → no está en `constants.js` → el levantamiento inicial no lo incluyó → en ese momento no se vendía con frecuencia → no existe proceso de actualización catálogo↔Matriz (→ WOLF-0004). **Confianza: 95%.**
- Reproducibilidad: abrir calculadora → escenario Cámara Frigorífica o cualquier selector de familia → ISOFRIG no aparece como opción.

### LOCK
- Plan patch: cargar familia ISOFRIG en `constants.js` (8 espesores + perfiles U ISOFRIG) con precios tomados de la Matriz **después** de que Matias valide la columna web oficial y corrija la fila 200 mm.
- Plan raíz: cubierto por WOLF-2026-0004 (pipeline Matriz saneada → export → catálogo con validación).
- Owner sugerido: Claude Code (carga) + Matias manual (validación de columnas y reglas técnicas ISOFRIG).
- Golden case GC-0001: cotización `presupuesto_libre` / panel ISOFRIG 100 mm, 10 m², lista web → unitario esperado **76.9454 USD/m² ex IVA** (Matriz BROMYROS, fila IF100, columna Venta web USD ex IVA; validar columna). Hoy: producto inexistente (fallo esperado del eval hasta el fix).
- Criterio de cierre: GC-0001 en verde en `calculadora-bmc-evals`.

---

## WOLF-2026-0002 — Precios desalineados con la Matriz por corrimiento de columna/fila en la extracción
**Estado:** EN EVAL (patch aplicado, branch `wolf/0002-precios`, commit `9c1ccf0`) | **Clase:** DATA | **Severidad:** S1 (precio erróneo silencioso) | **Reportó:** Ramiro Amaral, 02/06/2026 (alcance ampliado por triage)

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
- `inferencia` (mecanismo): la Matriz tiene SKUs duplicados (GFSUP80 usado para 80 y 100 mm; GSDECAM80 para 80 y 100; GL80 para 80 y 100; GLDCAM80 para 80 y 100) y celdas `#VALUE!`/`#REF!` en la columna Costo, más celdas con coma decimal textual (`"32,84"`). Cualquier extractor (humano o IA) sin validación se corre de fila/columna ahí. La hipótesis "decimal" de Ramiro era razonable; la evidencia apunta a **mapeo fila/columna erróneo** como mecanismo dominante, con el formato mixto como agravante.
- Dedup: **relacionado pero NO duplicado de BUG-004** (BUG-004 = subestimación de *cantidad* de anclajes, LOGIC; este = *precio*, DATA). Cross-referenciar.

### WHY
- DATA. 5-Whys: cobra de menos en web → `web` carga la columna equivocada → la extracción Matriz→constants.js mapeó mal columnas/filas → la Matriz no tiene estructura estable (SKUs duplicados, headers inconsistentes, #VALUE!) → no hay validación post-extracción contra la fuente (→ WOLF-0004). **Confianza: 90%** (85% en el mecanismo exacto; 100% en la discrepancia).
- Reproducibilidad: cotizar en lista web cualquier ítem de anclaje (p.ej. "Anclaje Isoroof GRISES") → calculadora muestra 1.60; Matriz web indica 2.15.

### LOCK
- Plan patch: corrección manual de los 6 anclajes + 4 goteros de cámara en `constants.js` con los valores de la Matriz **una vez que Matias confirme qué columna es la lista web oficial** (duda abierta D1). Un commit, diff mínimo.
- Plan raíz: WOLF-2026-0004 (validación automática código↔Matriz; control de rango/orden de magnitud como pidió Ramiro: *"Agregar controles de validación para evitar errores de formato decimal y precios fuera de rango"*).
- Owner sugerido: Claude Code (patch) tras validación de Matias.
- Golden case GC-0002: cotización `presupuesto_libre`, lista web: `anclaje_isoroof_gris` ×100 → **215.00 USD ex IVA** (2.15 c/u, Matriz R y C Tornillos, fila "1 Anclaje de Isoroof GRISES"); y `gotero_superior` cámara 80 mm ×1 (3.03 m) → web esperado **37.072 ex IVA** (Matriz GSDECAM80 80 mm). Validar columnas antes de fijar el eval.
- Criterio de cierre: GC-0002 en verde en `calculadora-bmc-evals`.

---

## WOLF-2026-0003 — Accesorios de borde faltantes en el catálogo
**Estado:** CONFIRMADO (parcial: 1 sub-item pendiente-dato) | **Clase:** DATA | **Severidad:** S3 | **Reportó:** Ramiro Amaral, 02/06/2026

### HUNT
Citas textuales: *"Faltan accesorios Isoroof 100 mm — Agregar todos los accesorios correspondientes"*; *"Falta gotero superior de cámara para Isoroof — (50mm - 80mm - 100mm)"*; *"Faltan goteros laterales de cámara Isodec — Agregar familia completa en 100, 150, 200 y 250 mm"*; *"Falta gotero superior Isodec PIR 120 mm"*.

### OBSERVE (por sub-item)
- **(a) Gotero superior de cámara Isoroof:** el código SÍ tiene GSDECAM 30/50/80 (`constants.js` 302–304, con precios errados → WOLF-0002). **Falta el 100 mm**, que en la Matriz existe ("Gotero Superior - DE CAMARA 100mm", venta 39.468 / web ex 46.0460, con SKU clonado GSDECAM80 → corregir SKU al cargar). Refinamiento del reporte: no faltan 50/80 (están mal valuados); falta 100.
- **(b) Goteros laterales de cámara Isodec:** el código colapsó la familia en un genérico `_all` (GLDCAM-DC, líneas 292–293). La Matriz tiene los 4 espesores: "Perfil Ch. Gotero Lateral Cámara 100/150/200/250 mm" — web ex IVA textual 27.6640 / 28.9100 / 43.2740 / 37.5900. `duda abierta` D3: en la Matriz el 200 (43.27) cuesta más que el 250 (37.59) — validar antes de cargar. Nota Matriz: 150/200/250 marcados "REVISAR - inabilitado en ML".
- **(c) Accesorios Isoroof 100 mm:** Matriz los tiene a medias con SKUs clonados del 80 (GFSUP80 reutilizado para "Gotero Superior 100mm", GL80 para "Gotero Lateral 100mm"). Confirmar set completo a cargar.
- **(d) Gotero superior Isodec PIR 120 mm:** `duda abierta` D2 — no localizado como SKU dedicado en la Matriz (existen GF120DC frontal y GL120DC lateral PIR 120). El código mapea "Gotero frontal Superior" de ISODEC/PIR al id `gotero_frontal` (líneas 546–548). Confirmar con Ramiro si el faltante es un SKU nuevo o el GF120DC usado como superior.
- Dedup: **nuevo**; causa raíz compartida con 0001/0002 (cross-ref WOLF-0004).

### WHY
- DATA. Misma raíz: carga inicial incompleta + sin proceso de sincronización; agravante: la propia Matriz tiene estos ítems con SKUs sucios o flags "REVISAR". **Confianza: 90%.**
- Reproducibilidad: configurar techo ISOROOF 100 mm o cámara con bordes → los accesorios listados no aparecen como opción.

### LOCK
- Plan patch: cargar (a) GSDECAM100, (b) familia GLDCAM Isodec por espesor 100–250 reemplazando el `_all`, (c) set Isoroof 100, (d) según respuesta D2 — con SKUs corregidos (no heredar los clonados de la Matriz).
- Plan raíz: WOLF-2026-0004.
- Owner sugerido: Claude Code, tras validación de D2/D3 por Matias/Ramiro.
- Golden case GC-0003: cotización techo ISODEC con borde lateral cámara 150 mm, 3 m, lista web → **28.9100 USD ex IVA** por barra de 3 m (Matriz, fila "Perfil Ch. Gotero Lateral Cámara 150 mm"; validar columna/precio D3). Hoy: opción inexistente por espesor (fallo esperado).
- Criterio de cierre: GC-0003 en verde en `calculadora-bmc-evals`.

---

## WOLF-2026-0004 — Sin fuente única de verdad + Matriz con datos sucios (meta-raíz)
**Estado:** CONFIRMADO | **Clase:** DATA/INFRA (estructural) | **Severidad:** S2 | **Reportó:** Ramiro Amaral (raíz) + hallazgos del triage, 02-03/06/2026

### HUNT
- Citas textuales del reporte: *"Falta de conexión directa con una fuente única de verdad"*; *"La principal mejora recomendada es conectar o validar la calculadora contra la Matriz de Costos y Ventas Dashboard. Eso eliminaría el problema de Raíz y nos evitaría tener que actualizar manualmente."*
- Hallazgo del triage que Ramiro no vio: **la Matriz misma no está en condiciones de ser fuente única hoy.**

### OBSERVE — suciedad de la Matriz (tab BROMYROS, evidencia textual)
- Celdas de Costo con `#VALUE!` (toda la sección GOTERO FRONTAL/LATERAL 3M) y `#REF!` (GFS50, GSDECAM 100).
- SKUs duplicados para productos distintos: GFS80 (80 mm y fila "0"), GFSUP80 (80 y 100 mm), GL80 (80 y 100 mm), GSDECAM80 (80 y 100 mm), GLDCAM80 (80 y 100 mm), CAN.ISDC120 (50, 80 y 120 mm), IF150-IFSL150 (150 y 200 mm con nombre clonado).
- Decimales mixtos: columnas con punto y celdas textuales con coma (`"32,84"`, `"36,94"`, `"41,42"`, `"45,52"` en ISODEC EPS; `"10,27"` en Bromplast).
- Anomalías de precio a validar: lateral cámara 200 > 250 (D3); "Gotero Lateral CAMARA 100mm" (16.848) más barato que el 50 mm (23.676).
- `hecho confirmado` (repo): el comentario en `constants.js:164` ya pedía *"Sincronizar precios con MATRIZ"* — la intención existía, el proceso no.
- El CSV `normalized_full_cleaned.csv` **no está en `main`** (404 en rutas estándar): el catálogo efectivo vive hardcodeado en `constants.js`. `duda abierta` D4: ubicación/estado real del CSV.

### WHY
- Estructural. 5-Whys: los datos divergen → cada actualización es manual y sin verificación → no hay export validado de la Matriz → la Matriz mezcla costeo interno, notas y catálogo en una sola hoja sin esquema → nunca se definió la frontera "fuente de verdad limpia" vs "hoja de trabajo". **Confianza: 90%.**

### LOCK
- Plan patch: ninguno (es la raíz, no se parchea).
- Plan raíz (3 etapas, absorbe las "Tareas Profundas" de Ramiro):
  1. **Sanear la Matriz**: corregir SKUs duplicados, #VALUE!/#REF!, anomalías D3, formato decimal único — o crear una tab `EXPORT_CATALOGO` limpia (SKU único, columnas fijas: costo, venta_ex_iva, web_ex_iva) que sea lo único que se sincroniza.
  2. **Diff determinístico** (script, no LLM): compara `EXPORT_CATALOGO` ↔ `constants.js` y reporta divergencias/faltantes/fuera-de-rango. Costo por corrida ~cero; corre en CI o cron.
  3. **Carga asistida**: los fixes 0001/0002/0003 entran por este pipeline, no a mano.
- Owner sugerido: Matias manual (etapa 1, decisiones de negocio) + Claude Code (etapas 2–3).
- Golden case GC-0004: correr el diff sobre los SKUs de GC-0001/0002/0003 → cero divergencias.
- Criterio de cierre: diff en verde integrado al pipeline de evals.

---

## FEATURES (derivados, no son tickets WOLF)
- Selector de lista de precios en UI: default **Local BMC** (venta), opciones **Web** y **Mercado Libre** (hoy ML = Web). Definido por Matias 03/06 — a futuro, no bloquea los fixes.
- Las "Tareas Profundas" del reporte (sistema de toma de datos de la Matriz, validación, mejora de ingreso de productos) son el plan raíz de WOLF-2026-0004.

## Pendientes para Matias (priorizados)
1. **D1 — RESUELTA (03/06):** los campos guardan precios **ex IVA** (IVA 22% una vez al total). Mapeo confirmado: `venta` ← columna venta local ex IVA (**lista default**, uso interno BMC); `web` ← columna web ex IVA (= ML por ahora). La aritmética ×1.22 de la fila testigo GSDECAM80 valida el mapeo. Consecuencia: el patch WOLF-0002 corrige **ambas** columnas de los anclajes (venta local ~−18%, web ~−25%).
2. **D2 — "Gotero superior Isodec PIR 120":** ¿SKU nuevo o es el GF120DC usado como superior? (con Ramiro).
3. **D3 — Anomalías de precio en la Matriz:** lateral cámara 200 (43.27) > 250 (37.59); cámara 100 (16.85) < 50 (23.68). ¿Errores o reales?
4. **D4 — `normalized_full_cleaned.csv`:** ¿dónde vive hoy y sigue siendo fuente, o el catálogo efectivo es `constants.js`?
5. **D5 — Reglas técnicas ISOFRIG** (au, lmin/lmax, sistema de fijación) para la carga del 0001.

## Registro de versión
- v0.3 (04/06/2026): WOLF-2026-0002 → **EN EVAL**. Patch aplicado en branch `wolf/0002-precios` (commit `9c1ccf0`): 11 entradas realineadas a la Matriz (6 anclajes + 5 goteros de cámara, ex-IVA, D1). Golden case **GC-0002** verde (`evals/golden-cases/GC-0002.test.mjs`): anclaje gris web ×100 = 215.00; gotero superior cámara 80 mm web = 37.07. Cierre del ticket pendiente del merge manual de Matias tras revisar el preview de Vercel.
- v0.2 (03/06/2026): D1 resuelta por Matias (precios ex IVA; `venta`←local, `web`←web; default Local BMC). Feature "selector de listas Local/Web/ML" registrada. Alcance del patch 0002 ampliado a ambas columnas.
- v0.1 (03/06/2026): triage inicial del reporte Ramiro 02/06. 4 tickets emitidos, todos CONFIRMADOS con triangulación repo+Matriz. Sin ledger previo (numeración inicia en 0001). Próximo paso: validar D1–D5 → goal de Claude Code para patch 0002 + cargas 0001/0003 + pipeline 0004 etapa 2, con golden cases en `calculadora-bmc-evals`.
