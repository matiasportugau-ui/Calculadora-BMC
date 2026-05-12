# Integración BMC PDF en Calculadora-BMC

Tu app ya tiene el dropdown "BMC PDF — Blueprint Técnico" y el slot
en `TEMPLATE_MAP` (`src/pdf-templates/index.js`):

```js
'bmc-pdf': () => import('./bmc-pdf.js'),
```

Solo falta el archivo `bmc-pdf.js` (el adapter), el HTML empaquetado, y
los assets. Cuatro pasos:

---

## 1. Copiar los dos archivos del template a tu repo

```
src/pdf-templates/
├── bmc-pdf.js                    ← desde handoff/integration/bmc-pdf.js
└── bmc-pdf-template.html.js      ← desde handoff/integration/bmc-pdf-template.html.js
```

`bmc-pdf-template.html.js` es el HTML del template empaquetado como ES
module (string). Se regenera con el script al final si cambia el
template fuente.

## 2. Copiar los assets a `/public`

```
public/bmc-pdf/
└── assets/
    ├── bmc-logo.png              ← desde handoff/assets/bmc-logo.png
    └── products/                 ← (vacío por ahora; agregar fotos si querés)
```

El template referencia `assets/bmc-logo.png` y `assets/products/*.jpg`
relativos al `<base href="/bmc-pdf/">` que inyecta el adapter. Por eso
viven bajo `/public/bmc-pdf/`.

## 3. Verificar el contrato con `buildQuotationModel`

El adapter consume el modelo `q` que tu `buildQuotationModel` ya
construye. **De este modelo, lee los siguientes campos — todos los
expone hoy `index.js`:**

| Campo `q` | Uso |
|---|---|
| `q.ref`, `q.fecha`, `q.validez` | Cabecera |
| `q.escenario` (label) | Subtítulo |
| `q.panelDescLine` | Resumen del panel (string ya formateado) |
| `q.areaTotalM2`, `q.panelCount`, `q.apoyoCount`, `q.fijacionCount` | KPIs |
| `q.bomDetailGroups[].groupName/groupTotal/items[].desc/qty/unit/pu/total` | Tabla BOM |
| `q.subtotalSinIva`, `q.ivaAmount`, `q.totalConIva` | Totales |
| `q.zoneRows[].desc/largo/ancho/paneles/au` | Tabla de zonas |
| `q.conditionsText` | Condiciones |

### Datos opcionales (`q.bmcExtra`)

`buildQuotationModel` **no expone hoy** ciertos datos crudos que
mejoran el PDF: cliente detallado, perímetro por lado, desglose
fijaciones por estructura, fotos del panel, ficha técnica.

El adapter los lee desde un passthrough opcional `q.bmcExtra`. **Si no
lo agregás, el PDF funciona igual** con fallbacks ("—" en cliente,
perímetro derivado del BOM, etc.). Para activar la versión completa,
agregar en `buildQuotationModel`:

```js
// src/pdf-templates/index.js → buildQuotationModel
return {
  ...existingModel,

  // ── Passthrough opcional para BMC PDF ────────────────────────────
  bmcExtra: {
    client: data.client,                       // razonSocial, direccion, telefono…
    globalBorders: data.appendix?.globalBorders, // {frente, fondo, latIzq, latDer}
    panelAu: data.appendix?.panelAu,
    pendientePct: data.appendix?.pendientePct,
    ptsHorm:   data.appendix?.ptsHorm,
    ptsMetal:  data.appendix?.ptsMetal,
    ptsMadera: data.appendix?.ptsMadera,
    panel: {
      url: panel?.url,
      photo: panel?.photo,         // ej. 'assets/products/AISLAPOL-T-50mm.jpg'
      detalle: panel?.detalle,     // ficha técnica si la tenés en data/
    },
  },
};
```

(Los campos no se incluyen si no existen — `JSON.stringify` los
elimina; el adapter ya valida.)

## 4. Probar

1. Abrir la calculadora.
2. Llenar una cotización (escenario `solo_techo`).
3. Bottom bar → "Diseño PDF" → seleccionar **"BMC PDF — Blueprint Técnico"**.
4. Click **"PDF Cliente"** → debería abrir el preview con el template
   diseñado, datos reales inyectados.

---

## Caveats / próximos pasos

- **Cliente**: aparece "—" hasta que pases `bmcExtra.client`. Es la
  mejora con más impacto visible — agregarla primero.

- **Perímetro**: si no pasás `bmcExtra.globalBorders`, el adapter
  intenta derivar los nombres de los perfiles desde el grupo
  PERFILERÍA del BOM (regex sobre `desc`). Funciona razonablemente
  si las descripciones siguen el patrón "Perfil X: …".

- **Foto de producto**: el adapter rebase paths relativos a
  `/bmc-pdf/`. Si pasás `bmcExtra.panel.photo = 'assets/products/AISLAPOL-T-50mm.jpg'`,
  resuelve a `/bmc-pdf/assets/products/AISLAPOL-T-50mm.jpg`. Para
  paths absolutos (`/foo.jpg`) o URLs (`https://…`) los respeta tal cual.

- **Multi-zona**: el adapter ya itera `q.zoneRows`. Si más adelante
  cada cuerpo tiene perfiles distintos (`zonasBorders[]`), por ahora
  todos comparten `bmcExtra.globalBorders`; ampliable luego.

- **Validar campos faltantes**: el adapter es defensivo — números no
  finitos → 0, arrays ausentes → []. No rompe el render aunque
  `q.bomDetailGroups` venga vacío.

---

## Regenerar el template HTML empaquetado

Si actualizás `handoff/bmc-pdf-template.html`, regenerar
`bmc-pdf-template.html.js` con:

```js
// scripts/build-bmc-template.js
const fs = require('fs');
const html = fs.readFileSync('handoff/bmc-pdf-template.html', 'utf8');
const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');
fs.writeFileSync(
  'src/pdf-templates/bmc-pdf-template.html.js',
  `export const BMC_PDF_TEMPLATE_HTML = \`${escaped}\`;\n`,
);
```
