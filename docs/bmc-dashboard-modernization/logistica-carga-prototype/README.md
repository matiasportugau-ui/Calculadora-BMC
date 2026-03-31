# BMC Logística — prototipo de carga (paralelo)

Herramienta **autocontenida** para planificar paradas, paneles y visualizar carga en el camión. **No está integrada** al dashboard `/finanzas` todavía; sirve como referencia de UX y motor reutilizable.

## Cómo abrir el prototipo

Los módulos ES requieren servir la carpeta por HTTP (no uses `file://` si el navegador bloquea imports).

Desde la **raíz del repo** `Calculadora-BMC` (no desde `~`):

```bash
cd docs/bmc-dashboard-modernization/logistica-carga-prototype
npx --yes serve . -l 3456
```

Abre la raíz del sitio, por ejemplo `http://localhost:3456/` (carga `index.html`). En esta carpeta hay un `serve.json` con `"cleanUrls": false` para que `serve` no redirija `*.html` a URLs sin extensión (evita el 404 al abrir rutas con nombre de archivo).

`prototype.html` solo redirige a `index.html` por compatibilidad con enlaces viejos.

## Reglas BMC (negocio + copy para operadores)

1. **Dos filas paralelas** de paneles (ancho útil del camión / ancho de fila). Etiquetas **Fila A / Fila B**.
2. **Altura máxima de pila:** 1,5 m por fila (línea roja en el diagrama).
3. **Saliente máximo:** 2 m más allá del largo de carrocería (advertencia si se excede).
4. **Orden de entrega:** P1, P2, … (primera parada = primera descarga en destino).
5. **Orden de carga:** **inverso** al de entrega: lo de la **última** parada va **al fondo** del camión; lo de la **primera** parada queda **arriba / cerca de la puerta** (según la convención del dibujo: puerta trasera a la izquierda en la vista isométrica).
6. **Paquetes:** no se mezclan pedidos distintos. Si la cantidad supera el máximo por espesor, se generan **varios paquetes** del mismo pedido.
7. **Disclaimer:** el modelo es una **guía operativa** (apilado simplificado). No certifica peso ni estabilidad legal del vehículo.

### Tabla máx. paneles por paquete (espesor mm)

| Espesor | Máx u/paquete |
|---------|----------------|
| 40 | 12 |
| 50 | 10 |
| 60 | 10 |
| 80 | 8 |
| 100 | 8 |
| 150 | 6 |
| 200 | 4 |
| 250 | 3 |

(Definición en código: `MAX_P` en [`lib/cargoEngine.js`](./lib/cargoEngine.js).)

### Leyenda visual (diagramas)

| Significado | Representación |
|-------------|----------------|
| Color sólido | Parada (cliente) asignada |
| Rojo | Paquete con violación de altura (`ov`) |
| Ámbar / rayas | Zona de saliente fuera de carrocería |
| Línea roja horizontal | Tope 1,5 m |

---

## Mapa de campos: API → parada (UI)

Filas devueltas por `GET /api/proximas-entregas` ya vienen normalizadas en el servidor (`CRM_Operativo` → campos BMC). El prototipo usa:

| Campo API (canónico) | Campo parada UI |
|----------------------|-----------------|
| `COTIZACION_ID` | `cotizacionId` |
| `CLIENTE_NOMBRE` | `cliente` |
| `TELEFONO` | `telefono` |
| `DIRECCION` | `direccion` |
| `ZONA` | `zona` |
| `LINK_UBICACION` | `linkUbicacion` |
| `FECHA_ENTREGA` | (mostrar en remito / notas si se desea; no afecta el motor) |

**Ubicación en mapas:** si `linkUbicacion` tiene URL, es el enlace principal; si no, se arma búsqueda Google Maps con `direccion` + `zona` (`mapsUrlFromStop` en el motor).

---

## Contrato JSON: importar desde próximas entregas

Para ensayar la integración sin acoplar el dashboard, el prototipo acepta **pegar JSON** con una de estas formas:

### A) Array de filas API (recomendado)

Mismo shape que cada elemento de `{ ok: true, data: [...] }` de `GET /api/proximas-entregas`:

```json
[
  {
    "COTIZACION_ID": "123",
    "CLIENTE_NOMBRE": "Cliente SA",
    "TELEFONO": "+598 99 123 456",
    "DIRECCION": "Ruta 39 km 12",
    "ZONA": "Maldonado",
    "LINK_UBICACION": "https://maps.google.com/?q=...",
    "FECHA_ENTREGA": "2026-03-31"
  }
]
```

### B) Envoltorio con `data`

```json
{ "data": [ { "COTIZACION_ID": "…", "CLIENTE_NOMBRE": "…" } ] }
```

### C) Formato de persistencia del prototipo (`localStorage`)

Ver sección *Persistencia* y archivo [`examples/planificador-state-ejemplo.json`](./examples/planificador-state-ejemplo.json).

### Esquema informal (fila mínima para parada)

| Campo | Tipo | Requerido |
|-------|------|-----------|
| `COTIZACION_ID` o `ID` | string | no |
| `CLIENTE_NOMBRE` | string | no |
| `TELEFONO` | string | no |
| `DIRECCION` | string | no |
| `ZONA` | string | no |
| `LINK_UBICACION` | string (URL) | no |

---

## Contrato futuro: búsqueda de cliente (servidor)

**No implementado aquí.** Cuando exista, debe ser `GET /api/...` con sheet/tab desde `config` / env (nunca IDs de planilla en el cliente). Respuesta sugerida por fila:

```json
{
  "cotizacionId": "",
  "nombre": "",
  "telefono": "",
  "direccion": "",
  "zona": "",
  "linkUbicacion": "",
  "linkPdf": ""
}
```

Documentar columnas en `docs/google-sheets-module/` al implementar.

---

## Pegar fila desde planilla (Sheets / Excel)

1. En la planilla, seleccioná **una fila** y copiá (`Ctrl+C` / `Cmd+C`).
2. En el prototipo, pegá en **“Pegar fila desde planilla”** y elegí la plantilla de columnas si pegás **solo datos** (sin fila de títulos):
   - **Ventas Dashboard (índices heredados):** columna `0` = pedido/ID, `7` = cliente, `8` = dirección, `9` = link PDF/foto/Drive, `14` = teléfono. Ajustá índices en [`lib/sheetPaste.js`](./lib/sheetPaste.js) (`SHEET_PASTE_PRESETS`) si tu pestaña difiere.
   - **Opción con mapa en col. 15:** preset `ventasDashboardLegacyMapa15`.
3. **Dos filas:** si copiás encabezados + una fila de datos, el parser intenta mapear por **nombre de columna** (cliente, dirección, tel, pedido, link mapa, PDF, etc.).
4. **Mapa:** si cualquier celda contiene un `https://` de Google Maps / `maps.app.goo.gl` / Waze, se rellena **Link ubicación**.
5. **Foto / PDF:** la celda de adjunto (p. ej. col. 9) o la primera URL http que no sea mapa se guarda en **Link PDF / foto / Drive**. La **miniatura** usa `https://drive.google.com/thumbnail?id=…` para enlaces de Drive; **no hay servidor** que “entre” al link: si el archivo es privado, la imagen puede no cargar (abrí el enlace). No se incrustan precios.

Botones **Previsualizar** (tabla de campos + miniatura si aplica) e **Importar como nueva parada**.

## Texto del adjunto → paneles y accesorios

### Opción A — Cargar PDF desde tu disco

En cada parada:

- **Elegir PDF → texto:** abre el archivo, extrae la **capa de texto** con [PDF.js](https://mozilla.github.io/pdf.js/) (se descarga desde **jsDelivr** la primera vez; hace falta **internet** en ese momento) y rellena el cuadro para revisión.
- **PDF → añadir / PDF → reemplazar:** extrae el texto y aplica el mismo parser que el pegado manual a **Paneles** y **Accesorios**.

**Limitaciones:** PDF **escaneados** (solo imagen) suelen no tener texto: el cuadro quedará vacío o muy corto; usá copiar/pegar, la planilla u OCR externo. PDF con contraseña o dañado puede fallar.

### Opción B — Pegar texto o tabla

Abrí el adjunto, copiá la **tabla de productos** o las **líneas** y pegá en **“Texto copiado del adjunto”**.

- **Añadir desde texto:** agrega al final de **Paneles** / **Accesorios**.
- **Reemplazar listas:** vacía paneles y accesorios y carga solo lo detectado en el pegado.

El **link** de Drive sigue siendo referencia para abrir en otra pestaña; no sustituye subir el PDF acá si querés extracción automática.

Parser: [`lib/adjuntoLineParse.js`](./lib/adjuntoLineParse.js) (`parseLogisticaFromAdjuntoText`). PDF: [`lib/pdfTextExtract.js`](./lib/pdfTextExtract.js).

**Paneles:** tipos **ISODEC**, **ISOPANEL**, **ISOROOF**, **ISOWALL**, **ISOFRIG**, **ISOFRIG_PIR** (texto libre o columna *Producto* en TSV). **Espesor (mm)** 40–250, **largo (m)** 3–12, **cantidad** (incluye `12 x ISOPANEL …` al inicio de línea).

**Tabla TSV:** primera fila con encabezados tipo *Producto*, *Espesor*, *Largo*, *Cantidad*.

**Accesorios:** líneas sin tipo panel (`Perfil U 2,4 m - 24`, `500 tornillos`, etc.) o filas de tabla con *Producto* + *Cantidad*.

Revisá siempre el resultado: depende del formato del PDF/cotización.

## WhatsApp para el transportista

El botón **WhatsApp** genera un mensaje **sin precios**, alineado a lo que el transportista espera ver en el chat:

- Cabecera de envío (número, fecha, transportista, patente, notas).
- Por cada parada: **Cliente**, **Dirección** (dirección + zona), **Tel/cel**.
- Tabla en texto: **Paneles** (producto = tipo + espesor, largo en metros con coma, cantidad) y **Accesorios** (descripción libre + cantidad).
- Bloque **Datos logísticos**: **Pedido Nº** (`cotizacionId`), **Ubicación**, **Mapa** (URL desde `linkUbicacion` o búsqueda Google con dirección+zona), **Contacto**.
- Referencia opcional de **paquetes** de carga (apilado) al final de cada parada.
- Cierre con resumen de pkgs / paradas / largo de camión.

La pestaña **Remito** incluye la misma información en la tarjeta **Vista transportista (sin precios)** para imprimir o revisar antes de enviar.

## Persistencia local (prototipo)

- Clave: `bmc-carga-ruta-v1`
- Guarda: `info`, `stops`, `truckL`
- Botones **Guardar borrador** / **Cargar borrador** en el formulario

---

## Handoff: integración al dashboard `/finanzas`

1. **Copiar o importar** [`lib/cargoEngine.js`](./lib/cargoEngine.js) a `docs/bmc-dashboard-modernization/dashboard/lib/` (o empaquetar con el mismo `app.js` vía bundler en el futuro).
2. **HTML:** nueva sección con ancla `#logistica-carga` junto a `#operaciones`, o subpestaña dentro de Operaciones.
3. **`app.js`:** tras `fetchProximasEntregas`, exponer `proximasEntregas` al planificador; botón **“Añadir al planificador”** que mapee filas seleccionadas con `stopFromProximaRow` (o equivalente).
4. **WhatsApp:** reutilizar texto de `buildCoordinacionLogisticaText` para la semana; el remito del prototipo puede alinearse a ese formato.
5. **API nueva** solo si hace falta búsqueda global de clientes: añadir ruta en `server/routes/bmcDashboard.js`, env vars en `server/config.js`, y entrada en `server/agentCapabilitiesManifest.js` si aplica.
6. **Capabilities / contrato:** actualizar `scripts/validate-api-contracts.js` si se agregan rutas.

---

## Archivos

| Archivo | Rol |
|---------|-----|
| `lib/cargoEngine.js` | Constantes, `buildPkgs`, `placeCargo`, helpers mapa/parada |
| `lib/sheetPaste.js` | Parser TSV / pegado de fila, presets de columnas, Drive thumbnail |
| `lib/adjuntoLineParse.js` | Texto pegado desde PDF/cotización → paneles + accesorios |
| `lib/pdfTextExtract.js` | Lectura de capa de texto de un PDF local (PDF.js vía CDN) |
| `index.html` | Shell + pestañas (entrada principal) |
| `prototype.css` | Estilos |
| `prototype.app.js` | Estado, SVG, remito, import JSON |
| `examples/import-proximas-ejemplo.json` | Ejemplo import tipo A |
| `examples/planificador-state-ejemplo.json` | Ejemplo estado guardado |
| `examples/import-contract.schema.json` | Esquema JSON informal (fila API / CRM) |

---

## Riesgos

- **CSV público / gviz:** no usar en integración; el servidor usa Service Account.
- **Ruta multi-parada en Google Maps:** orden óptimo requiere API / app; fuera del alcance inicial.
