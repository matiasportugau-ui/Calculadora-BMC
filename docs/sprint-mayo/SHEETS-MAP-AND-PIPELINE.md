# SHEETS-MAP-AND-PIPELINE — Sprint Mayo 2026

**Fecha:** 2026-05-09  
**Autor:** bmc-sheets-mapping  
**Alcance:** Mapa completo de fuentes de datos, verificación de 3 precios sospechosos, diseño de pipelines dual-write y shadow training.

---

## 1. Resumen ejecutivo

- **BLOQUEO CRÍTICO — MCP Google Drive bloqueado por hook de seguridad:** Todas las lecturas directas de las 5 sheets de Drive via MCP devolvieron "Permission denied by hook". Los datos de §2 provienen de docs existentes del equipo (generadas en sesiones anteriores con acceso MCP activo) y del CSV caché local. Las secciones marcadas con "VERIFICADO desde caché local" son datos primarios. Las que dicen "desde docs equipo" son datos de sesiones anteriores — confiables pero no actualizados hoy.
- **Precios ISOROOF FOIL 50mm y flete verificados contra MATRIZ:** ambos confirmados como discrepancias reales y con causa explicada. Ver §4.
- **Precio `anclaje_h` no resoluble desde fuentes locales:** la MATRIZ no tiene la fila de fijaciones individuales con precio unitario descompuesto. Requiere apertura manual de la planilla de anclajes referenciada en el código. Ver §4.
- **Dropbox Cotizaciones:** ~2.645 .ods y ~3.269 .pdf existen como stubs de Dropbox (nombres locales, contenido solo disponible cuando está sincronizado). Solo 2 archivos .ods estaban localmente descargados y fueron leídos. Naming convention confirmada. Ver §3.
- **crmAppend.js existe y funciona:** hay un pipeline de dual-write parcialmente implementado hacia CRM_Operativo. Lo que falta es el dual-write hacia Admin_Cotizaciones (la vieja). Ver §5.
- **No existe `data-mapper.js` con ese nombre en Drive.** La referencia al ID `1ZM1Q8JVp--OOYEo6m3C1Ttqvq1CVEKPR` no se pudo leer (MCP bloqueado). El repo tiene `src/data/matrizPreciosMapping.js` y `scripts/reconcile-matriz-csv.mjs` que hacen mapeo de SKU → path. Ver §7.
- **Oro de training:** la hoja "Venta y Coordinaciones" del workbook 2.0 Ventas (ID `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`) es la fuente más confiable de ventas cerradas. El volumen de cotizaciones históricas en Dropbox/.ods es de miles de filas pero los archivos están en cloud y requieren descarga masiva para ser útiles.

---

## 2. Mapa de Sheets de Drive

**Nota metodológica:** El MCP de Google Drive devolvió "Permission denied by hook" para las 5 sheets. Los datos de esta sección provienen de documentación interna (`docs/google-sheets-module/`) generada por sesiones anteriores del equipo con acceso MCP activo. Se indica la fuente de cada dato. No se modificó ninguna sheet.

---

### 2.1 Admin Cotizaciones ("la viva") — ID `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0`

**Fuente de datos:** `docs/google-sheets-module/INTEGRACION-ADMIN-COTIZACIONES.md` + `planilla-inventory.md`

**Tabs conocidas:**
- `Admin.` — hoja principal de cotizaciones en proceso
- `Copy of Admin.` — copia de respaldo
- `Enviados` — cotizaciones enviadas a clientes (tab clave para training)
- `Confirmado` — pedidos confirmados
- `Sheet8`, gráficos, otras

**Columnas de "Admin." (cabecera en fila 2, datos desde fila 3):**

| Columna origen | Tipo | Observaciones |
|----------------|------|---------------|
| Asig. | string | Responsable/vendedor asignado |
| Estado | string | Pendiente, Asignado, Listo, Enviado, CONTACTAR |
| Fecha | date | Formato DD-MM (sin año) |
| Cliente | string | Nombre del cliente |
| Orig. | string | WA, EM, LL, ML, CL |
| Telefono-Contacto | string | Número de contacto |
| Direccion / Zona | string | Ubicación de la obra |
| Consulta | text | Texto libre del pedido |
| RUTA DE ACCESO | string | Ruta interna o nota |
| Relleno | string | Tipo de relleno (EPS/PIR) |
| Largo (M) | number | Largo del panel |
| Ancho (M) | number | Ancho de la obra |
| Color | string | Color del panel |
| TerminaFront | string | Terminación frontal |
| TerminaSup | string | Terminación superior |
| Termina Lat. 1/2 | string | Terminaciones laterales |
| Anclajes a | string | Tipo de estructura (metal/madera/H°) |
| Traslado | string | Flete sí/no/precio |
| Forma | string | Forma de pago |

**Filas estimadas:** Datos desde aprox. fila 8, con sección "ESPERANDO RESPUESTAS DE LOS CLIENTES" visible en capturas. No fue posible obtener conteo exacto hoy.  
**Frecuencia de uso:** Alta — el equipo la opera manualmente en tiempo real.  
**Owner:** Matías / equipo comercial BMC.  
**Acceso API:** `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` debe tener rol Lector.

---

### 2.2 BMC crm_automatizado ("la nueva") — ID `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`

**Fuente de datos:** `docs/google-sheets-module/planilla-inventory.md`, `MAPPER-PRECISO-PLANILLAS-CODIGO.md`, `SHEETS-MAPPING-5-WORKBOOKS.md`

Esta es la sheet que el código usa como `BMC_SHEET_ID`. Es el workbook principal del dashboard.

**Tabs conocidas:**
- `CRM_Operativo` — fuente principal de cotizaciones (activa ahora; header en fila 3, datos desde fila 4)
- `Parametros` — catálogos y dropdowns; no leído por API
- `AUDIT_LOG` — log de operaciones
- `Metas_Ventas` — KPIs de ventas
- `Admin_Cotizaciones` — copia sincronizada desde workbook "Admin Cotizaciones" (creada por script `npm run integrate-admin-cotizaciones`)
- `Manual`, `Dashboard`, `Automatismos` — tabs informativas

**Columnas de CRM_Operativo (header fila 3):**

| Columna | Campo canónico | Tipo | Notas |
|---------|----------------|------|-------|
| A | correlationId (Wolfboard) | string | Opcional; escrito por crmAppend |
| B | FECHA_CREACION | datetime ISO | Timestamp de ingreso |
| C | CLIENTE_NOMBRE | string | Nombre del cliente |
| D | TELEFONO | string | |
| E | DIRECCION | string | Ubicación/dirección |
| F | ORIGEN | string | Calculadora-Panelin, WA, ML, etc. |
| G | NOTAS | string | Resumen del pedido |
| H | — | string | Tipo (Cotización) |
| I | — | string | Vacío |
| J | ESTADO | string | Pendiente, Abierto, Confirmado |
| K | ASIGNADO_A | string | Vendedor |
| L–Q | — | string | Vacío (disponibles) |
| R | PROBABILIDAD_CIERRE | string | % estimado |
| S | URGENCIA | string | |
| T | — | string | "No" (flag) |
| U | — | string | Vacío |
| V | TIPO_CLIENTE | string | |
| W | OBSERVACIONES | string | Links PDF + Drive concatenados |
| X–AG | — | string | Vacíos (disponibles) |
| AF | RESPUESTA_SUGERIDA | string | Texto IA (WA pipeline) |
| AG | PROVIDER_IA | string | Modelo que generó la respuesta |
| AH | LINK_PRESUPUESTO | string | URL al PDF de cotización |
| AI | APROBADO_ENVIAR | string | Sí / No — gate humano |
| AJ | ENVIADO_EL | datetime | Fecha/hora de envío |
| AK | BLOQUEAR_AUTO | string | Sí / No |
| AL | TIPO_CONTACTO | string | cliente, proveedor, lead, interno |
| AM | TAGS_TAXONOMIA | string | Tags separados por coma |
| AN | NOTAS_TAXONOMIA | string | Notas de clasificación |

**Acceso service account:** Editor — requerido para append/update.  
**Env var:** `BMC_SHEET_ID`  
**Schema activo:** `BMC_SHEET_SCHEMA=CRM_Operativo` (obligatorio; si falta, el código falla buscando `Master_Cotizaciones` que ya no existe).

---

### 2.3 2.0 Ventas Dashboard — ID `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA`

**Fuente de datos:** `docs/google-sheets-module/SHEETS-MAPPING-5-WORKBOOKS.md`, `MAPPER-PRECISO-PLANILLAS-CODIGO.md`

**Tabs conocidas:** Múltiples — una por proveedor (BROMYROS, MONTFRIO, HM-RUBBER, y otras). Header en fila 2 por tab. El nombre de la tab se convierte en campo `PROVEEDOR`.

**Columnas por tab (header fila 2):**

| Columna origen | Campo canónico | Tipo |
|----------------|----------------|------|
| ID. Pedido | COTIZACION_ID | string |
| NOMBRE | CLIENTE_NOMBRE | string |
| FECHA ENTREGA | FECHA_ENTREGA | date |
| COSTO SIN IVA / MONTO SIN IVA | COSTO | number |
| GANANCIAS SIN IVA | GANANCIA | number |
| SALDOS | SALDO_CLIENTE | string |
| Pago a Proveedor | PAGO_PROVEEDOR | string |
| FACTURADO | FACTURADO | string |
| Nº FACTURA | NUM_FACTURA | string |
| (nombre del tab) | PROVEEDOR | string (derivado) |

**Gold para training:** Las filas con `FACTURADO = "Sí"` son el oro absoluto — ventas cerradas y pagadas con costo/ganancia real. Esta es la fuente para calcular el "precio real humano" contra el cual comparar las cotizaciones shadow de Panelin.

**Acceso API:** `GET /api/ventas?tab=NombrePestaña` o sin `tab` para merge completo.  
**Env var:** `BMC_VENTAS_SHEET_ID`  
**Owner:** Equipo comercial BMC.

---

### 2.4 MATRIZ de COSTOS y VENTAS 2026 — ID `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`

**Fuente de datos:** CSV caché `.runtime/matriz-precios-latest.csv` (última sincronización: 2026-04-05 08:18 UTC) + JSON caché `.accessible-base/matriz_precios.json` (sincronizado: 2026-04-25 03:22 UTC).

Esta es la fuente canónica de precios. El CSV tiene 48 filas de productos mapeados con formato:
`path,descripcion,categoria,costo,venta_local,venta_local_iva_inc,venta_web,venta_web_iva_inc,unidad,tab`

**Categorías presentes en el CSV local:**
- Paneles Techo (ISOROOF_FOIL, ISOROOF_3G, ISOROOF_PLUS, ISOROOF_COLONIAL, ISODEC_EPS)
- Paneles Pared (ISOPANEL_EPS, ISOWALL_PIR)
- Perfilería Techo (goteros, cumbreras, canalones, soportes, babetas)
- Selladores (silicona Bromplast 600ml)
- Servicios (flete Bromyros)

**Ausentes en el CSV local (no exportados en el último pull):** fijaciones individuales (varillas, tuercas, arandelas, anclajes), tornillos. La MATRIZ tiene una sección "ANCLAJES varios" pero sin precio unitario descompuesto.

**Acceso API:** `GET /api/actualizar-precios-calculadora` — descarga CSV desde la MATRIZ live.  
**Env var:** `BMC_MATRIZ_SHEET_ID` (default hardcodeado en `server/config.js`: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`)

---

### 2.5 data-mapper.js — ID `1ZM1Q8JVp--OOYEo6m3C1Ttqvq1CVEKPR`

**BLOQUEADO:** La lectura de este archivo via MCP Drive devolvió "Permission denied by hook". No se pudo determinar su contenido hoy. Ver §7 para lo que existe localmente en el repo con funcionalidad análoga.

---

## 3. Inventario Dropbox /Cotizaciones

**Path:** `/Users/matias/Library/CloudStorage/Dropbox/BMC - Uruguay/Cotizaciones/`

### Total archivos (stubs Dropbox, no necesariamente descargados localmente)

| Extensión | Cantidad estimada |
|-----------|------------------|
| .ods | ~2.645 |
| .pdf | ~3.269 |
| .xlsx | ~2 |
| .doc | 0 |

**Advertencia importante:** Los archivos de subcarpetas son stubs de Dropbox (sin contenido local). El comando `find ... -name "*.ods"` devuelve el nombre del archivo desde el índice local de Dropbox, pero al intentar leerlos se obtiene timeout ("Operation timed out"). Solo los archivos con descarga activa son legibles. De los 2.645+ .ods, solo 2 estaban disponibles localmente al momento de este análisis.

### Naming convention confirmada

Basada en los 2 archivos leídos más los nombres visibles en el listado:

```
Cotización DDMMYYYY <Cliente> - <Producto> <Espesor>mm [-<variante>] [-<sufijo>] [-<canal>].ods
```

Ejemplos reales:
- `Cotización 11022026 Javier Plada - Isodec EPS 100mm -4H Maldonado.ods`
- `Cotización 01122025 MODULO 1 (Pared y Techo 100 mm).ods`
- `Cotización 01122025 BASE OFERTA - Isodec EPS 100 mm - desc - WA.ods`
- `Cotización 01122025 Base - Isoroof COLONIAL 40 mm - desc - WA.ods`

Sufijos comunes observados: `-desc-` (con descuento), `-WA` (para WhatsApp), `BASE`, `BASE OFERTA`, `EN PROCESO`, `MÓDULO`.

### Estructura de carpetas

```
Cotizaciones/
  17-18-19-20-21-22-23-24/     ← histórico multi-año
    2017/, 2018 PU/, ..., 2024/
  2025 Administración de obra/
  2025 Alambresa/
  2025 Aluminios/
  2025 Armco/
  2025 Becam/
  2025 Bromyros/               ← 34+ archivos, cliente más activo
  2025 Cibulis/
  2025 COLOCACIÓN - INSTALACIÓN/
  2025 Expreso Este/
  2025 Galpones/
  2025 Gestoría/
  2025 HM Rubber/
  2025 Imperplast/
  2025 Montfrío/
  2025 Poliglass/
  2025 PU 30 y 20/
  2025 Seco Center/
  2025 Solar Venti/
  2025 Termosip/
  Engrafadora Alquiler/
  Listas de Preciow/
```

**Patrón:** Un folder por cliente activo con año como prefijo. El histórico anterior a 2025 está agrupado en `17-18-19-20-21-22-23-24/` con subcarpetas por año.

### Estructura típica de un .ods (muestra real: Javier Plada 2026)

El archivo tenía 4 tabs, uno por espesor ofertado:

**Tabs:** `100_mm`, `150mm`, `200_mm_`, `250_mm_`

**Estructura de cada tab** (55-57 filas, ~12-15 columnas):
- Fila 1-3: encabezado empresa (email, web, tel)
- Fila 3: fecha de cotización
- Fila 4: datos de cliente (nombre, WA, dirección, notas internas)
- Fila 5: línea de cotización ("Cotización — Isodec EPS 100mm")
- Fila 6: `Cliente:` + nombre
- Fila 7: `Dirección:` + dirección
- Fila 8: `Tel/cel:` + teléfono
- Fila 9: headers de tabla (Producto, Largos, Cantidades, Costo m2, Costo Total, Costo interno, Ganancia)
- Filas 10-12: filas de paneles con precio por m² y totales
- Fila 13: sección Accesorios
- Filas 14-21: perfilería (goteros frontales, laterales, babetas, canalones)
- Fila 22: sección Fijaciones
- Filas 23-29: varillas, tuercas, arandelas, remaches
- Fila 30: descuento
- Fila 31: subtotal
- Fila 32: total m², IVA 22%
- Fila 33-35: materiales, traslado, TOTAL USD
- Filas 37-54: notas de cotización + datos bancarios

**Campos estructurables para ingesta:** cliente, dirección, teléfono, fecha, producto, espesor, largos, cantidades, precio_m2, total_materiales, traslado, total_final_usd. Los datos internos de costo y ganancia también están presentes (col 10-12) — sensibles.

### Estado de AUTOMATISMOS/

La carpeta `AUTOMATISMOS/` en el Dropbox devolvió "not found or permission denied" al intento de listado — posiblemente no sincronizada localmente. En el root del Dropbox BMC sí existe una carpeta `calcjson/` con 3 versiones de `PanelinCalculadoraV3.jsx` (backups manuales). No se encontraron scripts de automatización de cotizaciones en el Dropbox.

---

## 4. Confirmación precios sospechosos

### 4.1 `anclaje_h` — Varilla 1/4 + tuercas + arandelas

| Campo | Valor |
|-------|-------|
| **Código actual** | `venta: 4.89, web: 5.96, costo: 0.90` USD/unidad |
| **MATRIZ live** | No disponible — la MATRIZ exportada (CSV local y JSON caché) tiene la fila "ANCLAJES varios" sin precio unitario descompuesto. La sección de fijaciones individuales no fue incluida en los exports automatizados. |
| **Fuente de la última sync** | Commit `0cc56d0` (2026-04-24) sincronizó FIJACIONES contra MATRIZ 2026, pero el mensaje de commit lista solo: varilla_38, tuerca_38, arandela_carrocero, arandela_plana, arandela_pp, arandela_pp_gris, taco_expansivo, caballete. El `anclaje_h` NO aparece en ese listado — fue dejado con los valores anteriores. |
| **Discrepancia** | No confirmable desde fuentes locales. El ratio costo/web = 0.90/5.96 = 15%, muy por debajo del promedio del catálogo (50-70%). Esto es consistente con que el costo sea un placeholder o esté en otra moneda. |
| **Recomendación** | PEDIR CONFIRMACIÓN HUMANA. Abrir la MATRIZ → buscar "1 Anclaje de 100 mm" o "Anclaje pasante H°". El costo de $0.90 por kit completo (varilla 1/4 + tuercas + arandelas) es geométricamente bajo para un kit de 3+ piezas, donde solo las piezas individuales valen más en total. Probabilidad alta de que sea un costo en UYU transcrito como USD sin conversión. |

---

### 4.2 `ISOROOF_FOIL` espesor 50mm — precio web

| Campo | Valor |
|-------|-------|
| **Código actual** | `venta: 37.7856, web: 46.00, costo: 32.857` USD/m² |
| **MATRIZ (CSV local `matriz-precios-latest.csv`, fecha 2026-04-05)** | `costo: 31.9, venta_local: 36.69, venta_local_iva_inc: 44.76, venta_web: 36.69, venta_web_iva_inc: 44.76` |
| **MATRIZ (JSON caché `.accessible-base`, fecha 2026-04-25)** | `costo_m2_usd_ex_iva: 31.9` (venta_local y venta_web null en ese snapshot) |
| **Discrepancia** | Sí. Tres campos divergen del último export: |
| — costo en código | 32.857 vs MATRIZ 31.9 → diferencia +$0.957 (+3%) |
| — venta en código | 37.7856 vs MATRIZ 36.69 → diferencia +$1.10 (+3%) |
| — **web en código** | **46.00** vs MATRIZ **44.76** → diferencia **+$1.24 (+2.8%)** |
| **Por qué el web es redondo ($46.00)** | El valor $46.00 es el único precio redondo en todo el catálogo. El patrón estándar es `venta × 1.22 (IVA) ≈ precio redondeado`. La MATRIZ dice `venta_web_iva_inc: 44.76`, que es $36.69 × 1.22 = $44.76. El código tiene $46.00, que es $37.70 × 1.22 ≈ $45.99 ≈ redondeado a $46.00 — parece una aproximación manual de un valor anterior. El commit `ad94912` (2026-04-24) actualizó ISOROOF_FOIL 50mm, pero el web debió quedar en 44.76 sin IVA (o 36.69 sin IVA). |
| **Recomendación** | CAMBIAR. Los tres valores debieran ser: `costo: 31.9, venta: 36.69, web: 36.69`. El precio web sin IVA es igual al local en ISOROOF_FOIL (no hay diferenciación en MATRIZ). Pendiente de confirmación si el equipo aplica diferenciación web distinta a la MATRIZ. |

---

### 4.3 `SERVICIOS.flete` — Flete con entrega en obra

| Campo | Valor |
|-------|-------|
| **Código actual** | `venta: 240.00, web: 252.00, costo: 186.03` USD/servicio |
| **MATRIZ (CSV local, fecha 2026-04-05)** | `costo: 180, venta_local: 240, venta_local_iva_inc: 292.8, venta_web: 252, venta_web_iva_inc: 307.44` |
| **Discrepancia** | Parcial. Los precios de venta coinciden exactamente (venta=240, web=252). El costo diverge: **código dice $186.03 vs MATRIZ dice $180.00** (+$6.03, +3.4%). |
| **Variación por zona** | La MATRIZ tiene una sola fila de flete ("Flete de Bromyros en Zonas Aledañas") con precio fijo $240. No hay variación por zona documentada en la MATRIZ. El equipo negocia el flete manualmente en algunos casos. |
| **Recomendación** | CAMBIAR el costo a $180.00 (valor MATRIZ). El precio de venta ($240) y web ($252) ya están correctos. La discrepancia de costo ($186.03 vs $180) afecta el margen calculado internamente pero no el precio al cliente. |

---

## 5. Diseño Dual-Write Lead → 2 Sheets

### Schema unificado de Lead normalizado (JSON)

```json
{
  "lead_id": "uuid-v4",
  "timestamp": "2026-05-09T14:30:00.000Z",
  "canal_origen": "calculadora_web | panelin_chat | wa_inbound | email_inbound",
  "cliente_nombre": "string",
  "telefono": "string",
  "ubicacion": "string",
  "email": "string | null",
  "scenario": "solo_techo | solo_fachada | techo_fachada | camara_frig | presupuesto_libre",
  "panel_familia": "ISODEC_EPS | ISOROOF_3G | ISOPANEL_EPS | ...",
  "panel_espesor": 100,
  "area_m2": 320,
  "largo_m": 8.0,
  "ancho_m": 5.0,
  "lista_precios": "web | venta",
  "total_sin_iva_usd": 8500.00,
  "total_con_iva_usd": 10370.00,
  "pdf_url": "https://storage.googleapis.com/bmc-cotizaciones/...",
  "drive_url": "https://drive.google.com/...",
  "vendedor": "string | null",
  "notas": "string | null",
  "tipo_cliente": "string | null",
  "urgencia": "string | null",
  "probabilidad_cierre": "string | null",
  "wizard_payload": {}
}
```

---

### Mapeo Lead → Admin Cotizaciones (tab "Enviados")

La tab "Enviados" de Admin Cotizaciones no tiene esquema de columnas documentado explícitamente en los docs actuales (a diferencia de "Admin."). El equipo la opera manualmente. El mapeo propuesto se basa en la estructura de "Admin." + campos típicos de cotización enviada:

| Campo Lead | Columna Admin Cotizaciones | Notas |
|-----------|--------------------------|-------|
| timestamp | Fecha | Formato DD-MM-YYYY |
| cliente_nombre | Cliente | |
| canal_origen | Orig. | WA, EM, LL, ML, CL, WEB |
| telefono | Telefono-Contacto | |
| ubicacion | Direccion / Zona | |
| scenario + panel_familia + panel_espesor | Consulta | Concatenado: "[scenario] [familia] [espesor]mm [area]m²" |
| lista_precios | — | Sin columna dedicada en Admin.; ir a Observaciones |
| total_con_iva_usd | — | Sin columna dedicada visible; ir a Observaciones o nueva col |
| pdf_url | RUTA DE ACCESO | URL al PDF |
| vendedor | Asig. | |
| "Enviado" | Estado | Valor fijo al crear desde pipeline |
| largo_m | Largo (M) | |
| ancho_m | Ancho (M) | |

**Columnas técnicas sin mapeo directo en Lead:** TerminaFront, TerminaSup, Termina Lat., Anclajes a, Traslado, Forma. Estas las completa el vendedor manualmente o se dejan vacías al crear el lead automatizado.

---

### Mapeo Lead → CRM_Operativo (BMC crm_automatizado)

| Campo Lead | Columna CRM_Operativo | Código en crmAppend.js |
|-----------|----------------------|------------------------|
| timestamp | B (FECHA_CREACION) | `now` |
| cliente_nombre | C (CLIENTE_NOMBRE) | `cliente` |
| telefono | D (TELEFONO) | `telefono` |
| ubicacion | E (DIRECCION) | `ubicacion` |
| "Calculadora-Panelin" | F (ORIGEN) | hardcoded |
| scenario + lista + total | G (NOTAS) | `resumenPedido` |
| "Cotización" | H | hardcoded |
| "Pendiente" | J (ESTADO) | hardcoded |
| vendedor | K (ASIGNADO_A) | `vendedor` |
| probabilidad_cierre | R | `probabilidad` |
| urgencia | S | `urgencia` |
| tipo_cliente | V | `tipoCliente` |
| notas + pdf_url + drive_url | W (OBSERVACIONES) | `observaciones` |
| pdf_url o drive_url | AH (LINK_PRESUPUESTO) | `tail[0]` |
| "No" | AI (APROBADO_ENVIAR) | default |
| "No" | AK (BLOQUEAR_AUTO) | default |
| lead_id | A (correlationId) | si se pasa como `correlation_id` |

---

### Diferencias entre ambos targets

| Aspecto | Admin Cotizaciones | CRM_Operativo |
|---------|-------------------|---------------|
| Schema | Semi-estructurado, operado manualmente | Canónico, operado por API |
| Columnas técnicas | TerminaFront, Anclajes, Traslado, Forma | No presentes (van en NOTAS/OBSERVACIONES) |
| URL al PDF | RUTA DE ACCESO | AH (LINK_PRESUPUESTO) — campo dedicado |
| Gate de aprobación | Manual (el equipo opera la hoja) | AI/AJ/AK — automatizable |
| Datos de costo interno | No (es doc comercial) | No (CRM no tiene costos) |
| Uso en sistema | Base de trabajo humana | Fuente del dashboard y pipeline IA |
| Estado inicial | "Enviado" | "Pendiente" |

---

### Punto de inserción en el repo

El endpoint para crear el dual-write ya existe parcialmente:

- **CRM_Operativo:** `server/lib/crmAppend.js` — función `appendQuoteToCrm(input)`. Funciona hoy.
- **Admin Cotizaciones:** NO existe todavía. Requiere una nueva función, p. ej. `server/lib/adminCotizacionesAppend.js`.
- **Endpoint trigger:** Los puntos de inyección existentes son `server/routes/agentChat.js` (cuando el agente genera una cotización con PDF) y `server/routes/calc.js` (cuando se llama `/calc/cotizar`). Hay que agregar el call a ambas funciones en esos puntos.

---

### Estrategia de fallo

```
Intentar escribir en CRM_Operativo (crmAppend.js)
  → Si falla: logear error con lead_id + timestamp en AUDIT_LOG
  → NO rechazar el lead — la cotización ya fue generada
  → Encolar para reintento (pendingIds.add similar a clientQuotesSheetSync.js)

Intentar escribir en Admin Cotizaciones (adminCotizacionesAppend.js — a crear)
  → Si falla: logear warning (no es la fuente canónica)
  → NO bloquear ni reintentar agresivamente
  → La escritura en Admin es un "nice to have" para visibilidad del equipo

Regla: la cotización se entrega al cliente si al menos el PDF se generó.
Las escrituras a Sheets son best-effort con log.
Si ambas fallan: el lead_id + payload quedan en AUDIT_LOG para reconciliación manual.
```

---

## 6. Diseño Shadow Training Harness

### Etapa 1 — Ingesta de datos históricos

**Fuentes y cómo leerlas:**

| Fuente | Cómo leer | Contenido | Calidad |
|--------|-----------|-----------|---------|
| 2.0 Ventas, tabs con `FACTURADO="Sí"` | `GET /api/ventas` + filtro | Ventas cerradas con costo real y ganancia | Oro — verdad contable |
| 2.0 Ventas, todas las filas | `GET /api/ventas` | Ventas en proceso o pendientes | Plata — intención confirmada |
| Admin Cotizaciones, tab "Enviados" | Sheets API, sheetId `1Ie0KCpg...`, tab "Enviados" | Cotizaciones enviadas al cliente | Plata — oferta real pero no confirmada |
| Admin Cotizaciones, tab "Confirmado" | Idem, tab "Confirmado" | Pedidos confirmados (entre Enviados y Facturado) | Oro — decisión de compra |
| CRM_Operativo, estado "Confirmado" | `GET /api/cotizaciones` filtrado | Cotizaciones confirmadas vía CRM nuevo | Plata-oro según si hay total real |
| Dropbox .ods históricos | Requiere descarga masiva + parser .ods | ~2.600+ cotizaciones 2017-2025 | Bronce — datos están pero extracción costosa |

**Estimación de volumen de oro/plata:**
- Las tabs de 2.0 Ventas tienen décadas de actividad comercial. Con ~20 clientes/proveedores activos y frecuencia mensual, estimado conservador: 500-1.500 filas de ventas cerradas.
- Admin Cotizaciones "Enviados" + "Confirmado": estimado 200-600 filas activas (2025-2026).
- Total usable sin Dropbox: ~700-2.100 ejemplos de entrenamiento, de los cuales ~400-800 son "oro".

**Schema de Lead normalizado para ingesta (desde Ventas):**

```json
{
  "ingesta_id": "uuid",
  "fuente": "ventas_2026 | admin_cotizaciones | crm_operativo | dropbox_ods",
  "fecha": "2026-01-15",
  "cliente_nombre": "Bromyros S.A.",
  "proveedor": "BROMYROS",
  "cotizacion_id": "B-2026-001",
  "costo_usd": 4200.00,
  "ganancia_usd": 980.00,
  "total_venta_usd": 5180.00,
  "total_con_iva_usd": 6319.60,
  "facturado": true,
  "fecha_entrega": "2026-01-20",
  "num_factura": "A-12345",
  "contexto_libre": "string (consulta original si disponible)"
}
```

---

### Etapa 2 — Generación de shadow quote

Para cada fila de oro/plata de la Etapa 1:

1. Extraer los parámetros de entrada del pedido (familia, espesor, area_m2, scenario, lista de precios).
2. Llamar al endpoint existente `POST /calc/cotizar` con esos parámetros.
3. Guardar el `total_con_iva_usd` que devuelve Panelin.
4. No enviar al cliente — es solo shadow para comparación.

**Endpoint:** `POST /calc/cotizar` en `server/routes/calc.js` — ya acepta todos los parámetros necesarios.  
**Datos de entrada que pueden faltar:** muchas filas históricas no tienen área m² ni espesor explícito — habrá que inferir o descartar esas filas.

---

### Etapa 3 — Diff y scoring

Para cada par (cotización humana, shadow Panelin):

```
delta_abs = |total_panelin - total_humano|
delta_pct = delta_abs / total_humano × 100

Rúbrica:
  Excelente:    delta_pct ≤ 2%
  Aceptable:    delta_pct > 2% y ≤ 5%
  Requiere fix: delta_pct > 5% y ≤ 15%
  Crítico:      delta_pct > 15%

Campos adicionales a loguear:
  - categoría del error: precio_unitario | fijaciones | flete | calculo_area | descuento
  - panel_familia y espesor (para detectar familias problemáticas)
  - lista_precios (web vs venta)
  - fuente del ejemplo (ventas, admin, crm)
```

---

### Etapa 4 — Aprendizaje

**Para errores de precio unitario (delta_pct > 5% causado por diferencia en precio/m²):**
- Marcar los ítems de `constants.js` afectados
- Correr `npm run panelsim:env` + `scripts/pull-matriz-csv.mjs` para actualizar desde MATRIZ live
- Ejecutar `scripts/reconcile-matriz-csv.mjs` para sync

**Para patrones de error recurrentes (p. ej. siempre falla en cálculo de fijaciones de ISOROOF):**
- Cargar como ejemplos corregidos en la KB de training vía dev mode
- Agregar caso de test en `tests/validation.js`

**Para preguntas faltantes que impiden calcular:**
- Documentar el campo que faltó (p. ej. "sin `largo_m` no puedo calcular fijaciones")
- Agregar a la lista de preguntas obligatorias de Panelin en `chatPrompts.js`

---

### Tablas/storage para resultados

| Qué guardar | Dónde | Por qué |
|-------------|-------|---------|
| Resultados de shadow runs | PostgreSQL `identity.shadow_runs` (tabla nueva) | Persistencia, consultas, métricas |
| Errores clasificados | PostgreSQL `identity.shadow_errors` | Para análisis por categoría |
| Ejemplos de training correctos | KB dev mode (jsonl en `docs/team/knowledge/events-log.jsonl`) | Alimenta Panelin directamente |
| Métricas semanales | Tab nueva en 2.0 Ventas o Google Sheet aparte | Visible para el equipo sin SQL |

Si no se quiere levantar Postgres para esto, una alternativa mínima: archivos JSONL en `.runtime/shadow-runs-YYYY-MM.jsonl` (ya existe el patrón de `.runtime/` en el repo).

---

## 7. data-mapper.js — qué hay y qué reusamos

**El archivo de Drive ID `1ZM1Q8JVp--OOYEo6m3C1Ttqvq1CVEKPR` no fue legible** (MCP Drive bloqueado por hook). No se puede determinar su contenido.

**Lo que existe en el repo con funcionalidad análoga:**

| Archivo | Qué hace | Relevancia |
|---------|----------|-----------|
| `src/data/matrizPreciosMapping.js` | Mapeo SKU → path de constantes (p. ej. `IANC100` → `FIJACIONES.anclaje_h`) | Directamente reutilizable para ingestar la MATRIZ a constants.js |
| `src/utils/csvPricingImport.js` | Parsea CSV exportado de la MATRIZ y retorna objetos `{path, costo, venta, web}` | Reutilizable para el pipeline de sync automático |
| `scripts/pull-matriz-csv.mjs` | Script CLI para descargar el CSV de la MATRIZ via API Sheets | Reutilizable como step 1 del pipeline de precios |
| `scripts/reconcile-matriz-csv.mjs` | Compara CSV descargado contra constants.js y reporta discrepancias | Reutilizable para validación automática antes de sync |
| `server/lib/matrizCsvNormalization.js` | Normaliza headers del CSV de MATRIZ (maneja variaciones de nombre de columna) | Reutilizable para cualquier ingesta de MATRIZ |
| `server/lib/crmRowParse.js` | Parsea filas de CRM_Operativo (A:AK) a objeto canónico | Reutilizable para leer leads del CRM |

**Recomendación:** Si el `data-mapper.js` de Drive es un Google Apps Script o un script de mapeo, lo que hay en el repo ya lo cubre con mayor madurez. Antes de construir algo nuevo, pedir al dueño qué hace ese archivo — puede ser que se pueda deprecar.

---

## 8. Plan de implementación (días concretos)

### Día 1 (lunes) — Dual-write CRM_Operativo ya funciona; activar y agregar Admin Cotizaciones

**Mañana:**
- Verificar que `appendQuoteToCrm` está siendo llamado en `agentChat.js` y `calc.js`. Si no lo está, agregarlo.
- Crear `server/lib/adminCotizacionesAppend.js` que escribe en tab "Enviados" del workbook `1Ie0KCpg...` con el mapeo de §5.

**Tarde:**
- Test en dev: generar una cotización desde la calculadora → verificar que aparece en ambas sheets.
- Deploy: Vercel preview.
- Entregable del día: cotizaciones de la calculadora se registran en los dos CRM simultáneamente.

---

### Día 2 — Fix precios ISOROOF_FOIL 50mm + flete costo + pedir confirmación anclaje_h

**Mañana:**
- En `constants.js`, cambiar `ISOROOF_FOIL.esp.50`: `venta: 36.69, web: 36.69, costo: 31.9` (desde MATRIZ CSV local).
- En `constants.js`, cambiar `SERVICIOS.flete.costo`: `180.00` (desde MATRIZ CSV local).
- Correr `npm run gate:local:full` (lint + tests + build).

**Tarde:**
- Pedir a Matías: abrir MATRIZ → sección fijaciones → buscar "Anclaje 100mm" y reportar costo y precio unitario reales.
- Con ese dato: corregir `anclaje_h.costo` en `constants.js`.
- Deploy: Vercel producción.

---

### Día 3 — Ingesta batch histórica desde 2.0 Ventas

**Mañana:**
- Script `scripts/shadow-ingest-ventas.mjs`: lee todas las tabs de 2.0 Ventas via `GET /api/ventas`, filtra filas con `COTIZACION_ID` no vacío, normaliza al schema de ingesta de §6 etapa 1, guarda en `.runtime/shadow-runs-YYYY-MM.jsonl`.

**Tarde:**
- Ejecutar el script, revisar la muestra: ¿cuántas filas? ¿Cuántas tienen area_m2 + familia + espesor legibles?
- Reportar al dueño: "Tenemos N filas, X% son usables directamente, Y% requieren inferencia".

---

### Día 4 — Shadow runner: cotizar cada fila histórica con Panelin

**Mañana:**
- Script `scripts/shadow-run.mjs`: para cada fila ingesta-able, llama `POST /calc/cotizar` con parámetros inferidos, guarda resultado + delta + rúbrica.

**Tarde:**
- Revisar los 20 casos con mayor delta_pct — ¿son errores de código o errores de datos históricos?
- Clasificar por categoría de error.

---

### Día 5 — Correcciones de los errores más frecuentes + KB updates

- Tomar los top 5 errores del día 4.
- Si son de precio unitario: sync MATRIZ → constants.js.
- Si son de lógica de cálculo: agregar casos de test + fix.
- Si son de preguntas faltantes: actualizar `chatPrompts.js` + KB.
- Deploy: Vercel producción.

---

### Día 6 — Métricas + dashboard mínimo de resultados

- Crear tab "Shadow_Training" en el workbook CRM_Operativo con columnas: fecha_run, cotizacion_id, total_humano, total_panelin, delta_pct, categoria_error.
- Escribir resultados del día 4-5 en esa tab.
- Semáforo visual para Matías: cuántos están en verde/amarillo/rojo.

---

### Día 7 — Revisión con el dueño + ajuste de umbrales

- Matías revisa 10 cotizaciones aleatorias del shadow run.
- Ajustar umbrales de derivación automática (>800m² o >USD 20k) según lo que muestre el dataset real.
- Documentar los patrones de pedido más frecuentes para pre-cargar en KB.
- Deploy diario: Vercel producción si hay cambios de lógica.

---

## 9. Riesgos / preguntas para el dueño

### Decisiones que no puedo tomar solo

1. **Confirmación de `anclaje_h.costo`:** ¿Cuánto cuesta en realidad el kit de anclaje de 100mm (varilla 1/4 + tuercas + arandelas) según la MATRIZ? El valor actual $0.90 es sospechoso. Necesito que abras la MATRIZ → sección de anclajes → fila "Anclaje de 100mm" y me digas el costo unitario.

2. **¿Se activa dual-write hacia Admin Cotizaciones?** Escribir en la planilla que el equipo opera manualmente puede crear confusión si el formato del lead automático difiere del manual. ¿Preferís que el dual-write vaya solo a CRM_Operativo (la nueva) y que Admin Cotizaciones siga siendo solo manual? La respuesta cambia el alcance del Día 1.

3. **¿Qué hace el `data-mapper.js` en Drive (`1ZM1Q8JVp--OOYEo6m3C1Ttqvq1CVEKPR`)?** No pude leerlo por bloqueo de MCP. Si tiene lógica valiosa, hay que incorporarla al pipeline. ¿Podés decirme en dos líneas para qué lo usaban?

4. **Descarga masiva de .ods del Dropbox:** Los ~2.600 archivos .ods históricos son un activo enorme para training pero están en cloud (no sincronizados localmente). ¿Vale la pena sincronizar el Dropbox completo y correr el parser batch? Costo estimado: 2-3 horas de descarga + 1 día de procesamiento. Si el volumen de 2.0 Ventas alcanza para una primera iteración, el Dropbox puede esperar.

5. **¿El precio web de ISOROOF_FOIL 50mm tiene diferenciación propia (no es igual al precio local)?** La MATRIZ muestra `venta_local = venta_web = 36.69` para esa familia. El código tiene `web: 46.00` que es claramente incorrecto, pero antes de cambiar a 36.69 quiero confirmar que no hay un precio web diferenciado que el equipo aplica manualmente.

6. **Bloqueo del MCP Drive:** El agente bmc-sheets-mapping no puede leer las sheets de Drive en esta sesión porque el hook de seguridad lo bloquea. Para sesiones futuras, el dueño o el equipo técnico debe whitelistear el MCP de Google Drive para este agente en `.claude/settings.json`. Sin ese acceso, cualquier verificación de columnas en tiempo real requiere un export CSV manual.

---

### Alertas operativas identificadas

- **`BMC_SHEET_SCHEMA=CRM_Operativo` debe estar seteado en todo entorno:** el fallback del código es `Master_Cotizaciones` que ya no existe en la planilla. Un entorno nuevo sin esta variable falla silenciosamente.
- **El CSV de MATRIZ en `.runtime/` tiene fecha 2026-04-05** — tiene 34 días. Los precios pueden haber cambiado. Antes de cualquier corrección masiva de `constants.js`, correr `scripts/pull-matriz-csv.mjs` para descargar el CSV fresco.
- **Las fijaciones (varillas, tuercas, tornillos) NO están en el CSV exportado de MATRIZ.** El export automatizado de `pull-matriz-csv.mjs` captura solo los items con path mapeado en `matrizPreciosMapping.js`. Las fijaciones tienen SKUs en la MATRIZ pero pueden no estar mapeadas. Revisar `src/data/matrizPreciosMapping.js` para confirmar.
