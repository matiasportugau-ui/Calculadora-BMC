# Shadow Training Harness V1 — Skeleton

**Fecha:** 2026-05-09
**Sprint:** Mayo 2026
**Estado:** Etapas 1 y 2 implementadas. Etapas 3 y 4 pendientes.

---

## Qué hace este skeleton

Este skeleton implementa las **Etapas 1 y 2** del pipeline de shadow training descripto en el §6 de `SHEETS-MAP-AND-PIPELINE.md`:

- **Etapa 1 (Ingesta):** Recorre el directorio Dropbox `Cotizaciones/` y descubre todos los archivos `.ods` históricos. Filtra los stubs de Dropbox (archivos no sincronizados localmente, con 0 bytes en disco) para evitar timeouts de red.

- **Etapa 2 (Normalización):** Extrae datos de cada archivo `.ods` combinando dos fuentes:
  1. **El nombre del archivo** — fuente principal para fecha, cliente, familia/espesor de panel (naming convention BMC: `Cotización DDMMYYYY <Cliente> - <Producto> <Espesor>mm`).
  2. **El contenido de la hoja** — enriquecimiento opcional para cliente, teléfono, dirección y totales (cuando el archivo está descargado localmente).

El resultado es un archivo `data/training/normalized-quotes.jsonl` con un Lead JSON por línea, listo para alimentar las etapas 3 y 4.

---

## Cómo correr el script

```bash
# Procesar solo 50 archivos, sin escribir (modo prueba)
node scripts/training/ingestDropboxQuotes.js --limit 50 --dry-run

# Procesar 200 archivos y escribir el output
node scripts/training/ingestDropboxQuotes.js --limit 200

# Procesar todos los archivos disponibles localmente
node scripts/training/ingestDropboxQuotes.js
```

### Variable de entorno

Por defecto el script busca en:
```
/Users/matias/Library/CloudStorage/Dropbox/BMC - Uruguay/Cotizaciones
```

Para cambiar el path sin modificar el código:
```bash
DROPBOX_COTIZACIONES_PATH="/otro/path/Cotizaciones" node scripts/training/ingestDropboxQuotes.js
```

### Idempotencia

El script es idempotente: en cada ejecución carga los `lead_id` ya escritos en el `.jsonl` y omite esos archivos. Correrlo dos veces no duplica entradas.

El `lead_id` se deriva del hash SHA-1 del path absoluto del archivo — estable entre ejecuciones.

---

## Estructura del output JSONL

Un lead por línea. Las 3 líneas siguientes son output real de un run con `--limit 10`:

```jsonl
{"lead_id":"c92a6ee9448cefb6","fecha":"2017-03-14","timestamp":"2017-03-14T00:00:00.000Z","anio":2017,"canal_origen":"dropbox_ods_historic","fuente":"dropbox_ods","filepath":"/Users/matias/.../2017/03 - Marzo/Cotización 14032017 Wilson Batista - Gris : Cielorraso Blanco.ods","filename":"Cotización 14032017 Wilson Batista - Gris : Cielorraso Blanco.ods","cliente_nombre":"Wilson Batista","telefono":null,"ubicacion":null,"email":null,"scenario":null,"panel_familia":null,"panel_espesor":null,"area_m2":null,"largo_m":null,"ancho_m":null,"lista_precios":null,"total_sin_iva_usd":null,"total_con_iva_usd":null,"pdf_url":null,"drive_url":null,"vendedor":null,"notas":null,"tipo_cliente":null,"urgencia":null,"probabilidad_cierre":null,"wizard_payload":{}}
{"lead_id":"3bfdf6c11f1f5df5","fecha":"2017-06-16","timestamp":"2017-06-16T00:00:00.000Z","anio":2017,"canal_origen":"dropbox_ods_historic","fuente":"dropbox_ods","filepath":"/Users/matias/.../2017/06 - Junio/Cotización 16062017 Hugo Camacho :: con Punta mecha p:metal.ods","filename":"Cotización 16062017 Hugo Camacho :: con Punta mecha p:metal.ods","cliente_nombre":"Hugo Camacho :: con Punta mecha p:metal","telefono":null,"ubicacion":null,"email":null,"scenario":null,"panel_familia":null,"panel_espesor":null,"area_m2":null,"largo_m":null,"ancho_m":null,"lista_precios":null,"total_sin_iva_usd":null,"total_con_iva_usd":null,"pdf_url":null,"drive_url":null,"vendedor":null,"notas":null,"tipo_cliente":null,"urgencia":null,"probabilidad_cierre":null,"wizard_payload":{}}
{"lead_id":"c94fd2d02db378fc","fecha":"2017-07-03","timestamp":"2017-07-03T00:00:00.000Z","anio":2017,"canal_origen":"dropbox_ods_historic","fuente":"dropbox_ods","filepath":"/Users/matias/.../2017/07 - Julio/Cotización 03072017 Javier S. e:inmediata.ods","filename":"Cotización 03072017 Javier S. e:inmediata.ods","cliente_nombre":"Javier S. e:inmediata","telefono":null,"ubicacion":null,"email":null,"scenario":null,"panel_familia":null,"panel_espesor":null,"area_m2":null,"largo_m":null,"ancho_m":null,"lista_precios":null,"total_sin_iva_usd":null,"total_con_iva_usd":null,"pdf_url":null,"drive_url":null,"vendedor":null,"notas":null,"tipo_cliente":null,"urgencia":null,"probabilidad_cierre":null,"wizard_payload":{}}
```

**Nota sobre el sample:** Los archivos del histórico 2017 no usan la naming convention moderna (no incluyen familia/espesor en el nombre). Por eso `panel_familia`, `panel_espesor` y `scenario` son null. Los archivos 2025 sí generan esos campos desde el filename (validado en 26 tests sintéticos). La extracción de datos desde el contenido de la hoja (teléfono, totales) también está null en estos archivos 2017 — posiblemente usan una estructura diferente a la documentada en §3 de SHEETS-MAP-AND-PIPELINE.md (estructura del 2026).

**Limitación conocida:** El parser de `cliente_nombre` es looser en filenames viejos — en el ejemplo de Hugo Camacho extrae `"Hugo Camacho :: con Punta mecha p:metal"` porque la anotación de la orden está en el filename, no separada limpiamente. Para los archivos históricos pre-2022 el cliente requiere limpieza manual o una regexp más específica por período.

### Campos del schema

| Campo | Origen | Notas |
|-------|--------|-------|
| `lead_id` | SHA-1 del filepath (16 chars hex) | Estable entre ejecuciones |
| `fecha` | Filename (DDMMYYYY) o sheetData | ISO "YYYY-MM-DD" |
| `timestamp` | Derivado de `fecha` | Siempre medianoche UTC |
| `anio` | Derivado de `fecha` | Para distribución y filtrado |
| `canal_origen` | Fijo: "dropbox_ods_historic" | Distinción vs leads live |
| `fuente` | Fijo: "dropbox_ods" | Schema §6 SHEETS-MAP |
| `panel_familia` | Filename (regex por familia) | Ej: ISODEC_EPS, ISOROOF_3G |
| `panel_espesor` | Filename (número antes de "mm") | Entero, mm |
| `scenario` | Inferido de familia + señales | solo_techo, camara_frig, etc. |
| `area_m2`, `largo_m`, `ancho_m` | sheetData (cuando disponible) | Null si archivo no descargado |
| `total_sin_iva_usd`, `total_con_iva_usd` | sheetData | Parsea formato UY "1.234,56" |
| `lista_precios` | sheetData | Normalizado a "web" o "venta" |

### Campos siempre null en esta versión

`pdf_url`, `drive_url`, `tipo_cliente`, `urgencia`, `probabilidad_cierre` — no disponibles en los .ods históricos. Se completan en etapas futuras cuando se cruza con CRM.

---

## Advertencia sobre datos de Dropbox

**~11.800 archivos .ods** aparecen en el índice de Dropbox, pero la mayoría son stubs (no descargados localmente). El script detecta stubs por tamaño < 1024 bytes y los omite silenciosamente.

Para aumentar la cantidad de archivos procesables: sincronizar el Dropbox manualmente (clic derecho en la carpeta → "Disponible sin conexión"). El script re-corre idempotentemente sobre los nuevos archivos descargados.

**Los datos son sensibles** (clientes reales, precios). El directorio `data/training/` está en `.gitignore` y no debe commitearse.

---

## Dependencia nueva: xlsx (SheetJS)

El script usa `xlsx` (SheetJS `^0.18.5`) para parsear archivos `.ods`. Se instaló como `devDependency` porque:
- jszip (ya en deps) solo lee el ZIP interno del .ods, requeriría parsear XML ODF a mano
- xlsx tiene soporte nativo de ODS y la interfaz `sheet_to_json` simplifica la extracción de celdas
- Es una dependencia de desarrollo (scripts de training, no producción)

```bash
npm install --save-dev xlsx
```

---

## Archivos del skeleton

```
scripts/training/
  ingestDropboxQuotes.js    ← script principal (Etapas 1 + 2)
  normalizeLead.js          ← módulo helper de normalización (exportable, testeable)

tests/training/
  normalizeLead.test.js     ← 26 tests sintéticos (no requieren archivos .ods reales)

data/training/
  normalized-quotes.jsonl   ← output generado (en .gitignore)

docs/sprint-mayo/
  SHADOW-HARNESS-V1.md      ← este documento
```

---

## Qué falta (Etapas 3 y 4)

### Etapa 3 — Generación shadow quote

Para cada lead del `.jsonl` que tenga `panel_familia`, `panel_espesor` y `area_m2` no nulos:

1. Llamar `POST /calc/cotizar` con esos parámetros.
2. Guardar el `total_con_iva_usd` que devuelve Panelin.
3. Comparar con `total_con_iva_usd` del lead histórico (el precio que cotizó un humano).

Script a crear: `scripts/training/shadowRunner.js`

### Etapa 4 — Diff y scoring

Para cada par (cotización humana, shadow Panelin):
- `delta_pct = |total_panelin - total_humano| / total_humano × 100`
- Rúbrica: Excelente ≤ 2% / Aceptable ≤ 5% / Requiere fix ≤ 15% / Crítico > 15%
- Output: `.runtime/shadow-runs-YYYY-MM.jsonl` (patrón existente del repo)

Script a crear: `scripts/training/shadowScore.js`

### Integración con el plan general

Este skeleton es el **Día 3** del plan de implementación de `SHEETS-MAP-AND-PIPELINE.md §8`. Encaja en la secuencia:

```
Día 1: dual-write CRM_Operativo (existente) + Admin Cotizaciones (a crear)
Día 2: fix precios ISOROOF_FOIL 50mm + flete costo
Día 3: ← este skeleton (ingesta batch .ods históricos) ← IMPLEMENTADO
Día 4: shadow runner (cotizar con Panelin)
Día 5: scoring + correcciones top errores
```

### Limitación actual: pocos archivos disponibles localmente

La mayoría de los ~11.800 .ods están como stubs en Dropbox. El valor del skeleton se realiza cuando el operador sincroniza las carpetas de clientes clave (Bromyros, Montfrío, HM Rubber) localmente. La recomendación es: sincronizar primero `2025 Bromyros/` completo y correr con `--limit 200` para validar la calidad de los leads extraídos antes de procesar todo el histórico.

---

*Documento generado: 2026-05-09. Próxima acción: sincronizar Dropbox + correr `--limit 50 --dry-run`.*
