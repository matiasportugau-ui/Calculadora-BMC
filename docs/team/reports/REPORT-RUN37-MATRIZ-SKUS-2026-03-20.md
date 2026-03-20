# REPORT — Run 37 (MATRIZ SKUs + billing)

**Fecha:** 2026-03-20  
**Fuente código:** `src/data/matrizPreciosMapping.js` (MATRIZ_SKU_TO_PATH)

## Lista SKUs en código (col.D MATRIZ esperada)

SKUs que la calculadora espera en la planilla **MATRIZ de COSTOS y VENTAS 2026** (columna D o equivalente "SKU / Código"). Validar en la planilla real que existan y coincidan.

| Categoría | SKUs |
|-----------|------|
| **Paneles techo** | IAGRO30, IAGRO50, IROOF30, IROOF40, IROOF50, IROOF80, IROOF100, IROOF50PLS, IROOF80PLS, ISDEC100, ISDEC150, ISDEC200, ISDEC250, ISDPIR50, ISDPIR80, ISDPIR120 |
| **Paneles pared** | ISD50EPS, ISD100EPS, ISD150EPS, ISD200EPS, ISD250EPS, IW50, IW80, IW100 |
| **Goteros** | GFS30, GFS50, GFS80, GFSUP30, GFSUP50, GFSUP80, GSDECAM30, GSDECAM50, GSDECAM80, GL30, GL40, GL50, GL80, GLDCAM50, GLDCAM80, GFCGR30 |
| **Babetas/cumbrera/canalón** | BBAS3G, BBESUP, CUMROOF3M, CD30, CD50, CD80, SOPCAN3M |
| **Selladores** | CBUT, BROMPLAST, SIL300N |
| **Fijaciones** | CABROJ, ANCISOTER, ANCISOGR, ANCBC18, ANCBC35, ANCUPLAT, REMPOP532, REMPOP316, THEX1234, THEX121PM, THEX12212, TAG12X2, TAG12X3, THEXPU204, T1PERF, T2FACH, TAGU14X5, ANC100MM |
| **Herramientas** | APLDX03 |
| **Servicios** | FLETEBRO |

**Total en código:** 72 SKUs.

## Estado

- **OK:** Mapeo código → path calculadora definido; `buildPlanillaDesdeMatriz` busca por nombre de columna (Costo, Venta BMC, Venta Web) y usa SKU para aplicar a path.
- **Pendiente validar:** Confirmar en la planilla MATRIZ 2026 que cada SKU de la tabla existe en col.D (o columna equivalente) y que no hay SKUs en planilla sin mapeo (quedarían fuera de "Cargar desde MATRIZ").

## Billing

- Sanity cierre: pendiente ejecución con datos reales (Pagos_Pendientes, workbook Pagos 2026). Sin datos exportados en este run; rol Billing puede ejecutar con export cuando corresponda.
