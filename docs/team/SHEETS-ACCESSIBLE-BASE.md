# BMC Workspace Sheets — Expert Sync Map + Accessible Base

**Generado:** 2026-04-23  
**Fuente:** exploración de código (`bmcDashboard.js`, `sheets-api-server.js`, `ml-crm-sync.js`, `crmOperativoLayout.js`, `crmRowParse.js`, `integrate-admin-cotizaciones.js`, `config.js`)  
**Mantener actualizado:** cuando se modifique cualquier columna, tab o env var de Sheets.

---

## Mapa de ecosistema (flujo completo)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  CANALES DE ENTRADA                                                          ║
╠══════════════╦═══════════════╦════════════════╦═══════════════╦═════════════╣
║  WhatsApp    ║  Mercado Libre║  Email (IMAP)  ║  Shopify      ║  Admin 2.0  ║
║  /webhooks   ║  /ml/questions║  /crm/ingest   ║  /shopify/    ║  (manual)   ║
║  /whatsapp   ║               ║  -email        ║  preguntas    ║  Wolfboard  ║
╚══════╤═══════╩═══════╤═══════╩════════╤═══════╩═══════╤═══════╩══════╤══════╝
       │               │                │               │              │
       ▼               ▼                ▼               ▼              ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  BMC_SHEET_ID  (crm_automatizado  /  1N-4ky...)                             ║
║                                                                              ║
║  ┌─────────────────────┐   ┌────────────────────┐   ┌──────────────────┐   ║
║  │  CRM_Operativo      │   │ Master_Cotizaciones │   │  AUDIT_LOG       │   ║
║  │  Header: row 3      │   │ Header: row 1       │   │  Append-only     │   ║
║  │  Data:   row 4+     │   │ Data:   row 2+      │   │                  │   ║
║  │  Cols B:AK (37 col) │   │ Cols A:Y (25 col)   │   │  Cols A:H        │   ║
║  │  ↑ ML sync          │   │ ↑ WA + API          │   │                  │   ║
║  │  ↑ WA webhook       │   │ → marcar-entregado  │   │                  │   ║
║  │  ↑ Email ingest     │   │   ↓ Ventas realizad │   │                  │   ║
║  │  ↕ Wolfboard sync   │   │                     │   │                  │   ║
║  └─────────────────────┘   └────────────────────┘   └──────────────────┘   ║
║                                                                              ║
║  ┌─────────────────────┐   ┌────────────────────┐   ┌──────────────────┐   ║
║  │  Metas_Ventas       │   │ Ventas realizadas   │   │  Enviados        │   ║
║  │  Opcional, read-only│   │ y entregadas        │   │  (Wolfboard K→)  │   ║
║  └─────────────────────┘   │ Destino de marcar-  │   │                  │   ║
║                             │ entregado           │   │                  │   ║
║                             └────────────────────┘   └──────────────────┘   ║
╚══════════════════════════════════════════════════════════════════════════════╝
       ↕                              ↕
╔══════════════════╗    ╔═════════════════════════════════════════════════════╗
║  WOLFB_ADMIN_    ║    ║  LIBROS SEPARADOS                                   ║
║  SHEET_ID        ║    ║                                                     ║
║  (1Ie0KCpg...)   ║    ║  BMC_PAGOS_SHEET_ID   BMC_VENTAS_SHEET_ID          ║
║                  ║    ║  (1AzHhals...)        (1KFNKWLQm...)               ║
║  Admin. tab      ║    ║  Pagos_Pendientes     23 tabs (por proveedor)       ║
║  I:consulta      ║    ║  Header: row 1        Header: row 2, data: row 3+  ║
║  J:respuesta     ║    ║  Cols: A-I            Cols: fuzzy-matched           ║
║  K:link          ║    ║                                                     ║
║  L:enviado       ║    ║  BMC_STOCK_SHEET_ID   BMC_MATRIZ_SHEET_ID          ║
║                  ║    ║  (1egtKJAG...)        (1oDMkBgW... default)        ║
║  ↕ Wolfboard     ║    ║  Header: row 3        Tab: BROMYROS                ║
║    /api/wolfboard║    ║  Cols: fuzzy          Cols: D,E,F,L,M,T,U          ║
╚══════════════════╝    ╚═════════════════════════════════════════════════════╝
       ↕                              ↕
╔══════════════════════════════════════════════════════════════════════════════╗
║  .accessible-base/  (snapshots JSON locales — auto-sync)                    ║
║                                                                              ║
║  manifest.json          crm_operativo.json       admin_cotizaciones.json    ║
║  master_cotizaciones    pagos_pendientes.json     metas_ventas.json          ║
║  ventas.json            stock.json                matriz_precios.json        ║
║  audit_log.json                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## Workbooks — referencia rápida

| Env Var | Spreadsheet ID | Propósito | R/W |
|---------|---------------|-----------|-----|
| `BMC_SHEET_ID` | `1N-4ky...` (crm_automatizado) | CRM hub + entregas + audit | RW |
| `WOLFB_ADMIN_SHEET_ID` | `1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0` | Admin 2.0 cotizaciones | RW |
| `BMC_PAGOS_SHEET_ID` | `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI` | Pagos pendientes | R(+W) |
| `BMC_CALENDARIO_SHEET_ID` | `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk` | Vencimientos | R |
| `BMC_VENTAS_SHEET_ID` | `1KFNKWLQmBHj_v8BZJDzLklUtUPbNssbYEsWcmc0KPQA` | Ventas por proveedor | RW |
| `BMC_STOCK_SHEET_ID` | `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw` | Inventario e-commerce | RW |
| `BMC_MATRIZ_SHEET_ID` | `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` | Matriz precios 2026 | RW |

---

## Esquemas detallados por sheet

### 1. CRM_Operativo (BMC_SHEET_ID)

**Header row:** 3 (1-based) | **Data:** row 4+ | **Total cols:** A:AK (37)

| Col | Campo canónico | Tipo | Escribe | Notas |
|-----|----------------|------|---------|-------|
| B | `fecha_creacion` | date `DD/MM/YYYY` | ml-crm-sync, WA webhook | |
| C | `cliente` | string | todos los canales | nickname ML o nombre WA |
| D | `telefono` | string | WA, manual | |
| E | `ubicacion` | string | WA, manual | |
| F | `origen` | string enum | todos | `ML`, `WA`, `Email`, `Oficina`, `Tel` |
| G | `consulta` | string | todos | texto de pregunta/pedido; clave de match Wolfboard |
| H | `categoria` | string | ml-crm-sync (auto) | `Paneles Techo`, `Accesorios`, etc. |
| I | `urgencia` | string | WA, manual | |
| J | `estado` | string enum | todos | `Pendiente`, `Abierto`, `Descartado` |
| K | `responsable` | string | ml-crm-sync | `PANELSIM` para ML auto |
| W | `observaciones` | string | ml-crm-sync | contiene `Q:{id}` para deduplicar ML |
| AF | `respuesta_sugerida` | string | suggest-response, Wolfboard | texto IA al cliente |
| AG | `provider_ia` | string | suggest-response | `claude`, `openai`, `grok`, `gemini` |
| AH | `link_presupuesto` | url | Wolfboard, cockpit | link Drive PDF |
| AI | `aprobado_enviar` | `Sí`/`No` | cockpit, Wolfboard | gate humano antes de envío |
| AJ | `enviado_el` | datetime | cockpit/mark-sent | timestamp envío al canal |
| AK | `bloquear_auto` | `Sí`/`No` | manual | evita que automáticos toquen la fila |

**Escritores por canal:**
```
ML webhook     → B,C,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC,AD,AE,AF + tail AG:AK
WA webhook     → B,C,D,E,F,G + R,S,T + AF,AG + AH:AK
Email ingest   → B,C,D,E,F,G + similar a WA
Wolfboard sync → AF (respuesta_sugerida), AH (link), AI (aprobado)
Cockpit API    → AH (quote-link), AI (approval), AJ (enviado_el)
```

---

### 2. Master_Cotizaciones (BMC_SHEET_ID)

**Header row:** 1 | **Data:** row 2+ | **Total cols:** A:Y (25)

| Campo | Tipo | Notas |
|-------|------|-------|
| `cotizacion_id` | string `COT-NNN` | Clave primaria |
| `cliente_nombre` | string | Nombre del cliente |
| `telefono` | string | Contacto |
| `direccion` | string | |
| `zona` | string | |
| `estado` | string enum | `Confirmado` activa "próximas entregas" |
| `fecha_entrega` | date | Filtro semanal para logística |
| `monto_estimado` | number | |
| `link_ubicacion` | url | Google Maps |
| `link_cotizacion` | url | PDF o Calculadora |
| `notas` | string | Items summary |

---

### 3. Admin 2.0 — Wolfboard source (WOLFB_ADMIN_SHEET_ID)

**Tab:** `Admin.` | **Header:** row 2 | **Data:** row 3+ | **Cols relevantes:** H:K

| Col | Campo | Tipo | Notas |
|-----|-------|------|-------|
| H | `consulta` | string | match con CRM.G (normalizado) |
| I | `respuesta` | string | texto IA al cliente; sync con CRM.AF |
| J | `link_presupuesto` | url | sync con CRM.AH |
| K | `enviado` | boolean `TRUE/FALSE` | `K=TRUE` → mover a Enviados |

---

### 4. Pagos Pendientes (BMC_PAGOS_SHEET_ID)

**Tab:** dinámica (primera hoja) | **Header:** row 1 | **Filtro:** `estado_pago ≠ Pagado`

| Campo | Tipo | KPI |
|-------|------|-----|
| `fecha_vencimiento` | date | Agrupa por estaSemana / proximaSemana / esteMes |
| `monto` | number | Suma por moneda |
| `moneda` | string | `$`, `UES`, etc. |
| `estado_pago` | string | Filtro: excluir `Pagado` |
| `cliente` | string | Display |
| `cotizacion_id` | string | Referencia |

---

### 5. Ventas 2.0 (BMC_VENTAS_SHEET_ID)

**Tabs:** 23 (una por proveedor) | **Header:** row 2 | **Data:** row 3+  
**Column matching:** fuzzy — `"COSTO SIN IVA"` / `"MONTO SIN IVA"` → `costo`

| Campo canónico | Fuente header | KPI |
|----------------|---------------|-----|
| `cotizacion_id` | "ID. Pedido" | |
| `cliente_nombre` | "NOMBRE" | |
| `fecha_entrega` | "FECHA ENTREGA" | |
| `costo` | "COSTO SIN IVA" | realAcumulado |
| `ganancia` | "GANANCIAS SIN IVA" | realAcumulado |
| `saldo_cliente` | "SALDOS" | |
| `pago_proveedor` | "Pago a Proveedor" | |
| `facturado` | "FACTURADO" | Alerta sin facturar |
| `link_carpeta` | "CARPETA" | PDF Drive |
| `proveedor` | (tab name) | Filtro |

---

### 6. Stock E-Commerce (BMC_STOCK_SHEET_ID)

**Header:** row 3 | **Data:** row 4+ | **Alerta:** `stock < 5`

| Campo | KPI |
|-------|-----|
| `codigo` | Clave |
| `producto` | |
| `costo_usd` | valorInventario = Σ(costo × stock) |
| `margen_pct` | |
| `venta_usd` | |
| `stock` | bajoStock: count(< 5) |
| `pedido_pendiente` | |

---

### 7. MATRIZ Precios 2026 (BMC_MATRIZ_SHEET_ID)

**Tab:** `BROMYROS` | **Header:** row 1 | **Data:** row 2+

| Col | Campo | Notas |
|-----|-------|-------|
| D | `sku` | Clave para calculadora CSV |
| E | `descripcion` | |
| F | `costo_m2_usd_ex_iva` | Precio costo → calculadora |
| L | `venta_local` | Precio local |
| M | `venta_local_iva_inc` | Solo lectura |
| T | `venta_web_usd` | Precio web → calculadora |
| U | `venta_web_iva_inc` | Solo lectura |

---

## Accessible Base — especificación

### Qué es

Un **snapshot local en JSON** de todos los sheets del workspace, escrito en `.accessible-base/`. Permite que los agentes lean datos de las hojas **sin hacer llamadas a Sheets API** y con **esquema normalizado** (campos en `snake_case`, booleans como `true/false`, IDs de ML extraídos).

### Estructura de archivos

```
.accessible-base/
├── manifest.json              ← índice: timestamp, rowCount, spreadsheetId por sheet
├── crm_operativo.json         ← CRM_Operativo normalizado
├── master_cotizaciones.json
├── admin_cotizaciones.json    ← Admin 2.0 (Wolfboard source)
├── pagos_pendientes.json      ← solo filas pendientes (estado_pago ≠ Pagado)
├── metas_ventas.json
├── ventas.json                ← todas las tabs mergeadas, + campo _tab
├── stock.json
├── matriz_precios.json
└── audit_log.json
```

### Formato de cada snapshot

```json
{
  "_meta": {
    "key": "crm_operativo",
    "label": "CRM Operativo — hub principal de leads y respuestas",
    "synced_at": "2026-04-23T15:30:00.000Z",
    "row_count": 142,
    "spreadsheet_id": "1N-4ky...",
    "source_env": "BMC_SHEET_ID"
  },
  "rows": [
    {
      "_row": 4,
      "fecha_creacion": "23/04/2026",
      "cliente": "comprador_ml_123",
      "origen": "ML",
      "consulta": "¿Tienen panel de 100mm para techo?",
      "estado": "Pendiente",
      "respuesta_sugerida": "Sí, contamos con ISODEC EPS 100mm...",
      "aprobado_enviar": false,
      "enviado_el": "",
      "bloquear_auto": false,
      "_ml_question_id": "13562857868"
    }
  ]
}
```

### Manifest

```json
{
  "version": 1,
  "last_sync": "2026-04-23T15:30:00.000Z",
  "sheets": {
    "crm_operativo": {
      "synced_at": "2026-04-23T15:30:00.000Z",
      "row_count": 142,
      "spreadsheet_id": "1N-4ky...",
      "label": "CRM Operativo — hub principal de leads y respuestas"
    },
    "admin_cotizaciones": { "synced_at": "...", "row_count": 18 }
  }
}
```

### Gitignore

Los snapshots JSON son **locales** (no se versionan — datos de negocio).  
Solo `manifest.json` puede commitearse si se desea trazabilidad de sync times.

```
.accessible-base/*.json
!.accessible-base/manifest.json
```

---

## Comandos

```bash
# Sync completo (todos los sheets)
npm run sheets:sync

# Sync sin escribir — ver qué cambiaría
npm run sheets:sync:dry

# Sync un solo sheet
npm run sheets:sync -- --sheet=crm_operativo
npm run sheets:sync -- --sheet=admin_cotizaciones
npm run sheets:sync -- --sheet=pagos_pendientes

# Watch mode (polling cada 3 min)
npm run sheets:sync:watch

# Sheets disponibles:
# crm_operativo | master_cotizaciones | admin_cotizaciones
# pagos_pendientes | metas_ventas | ventas | stock | matriz_precios | audit_log
```

---

## Propagación automática de cambios

### Trigger desde la API

Después de cualquier **write** en `bmcDashboard.js` o `sheets-api-server.js`, se puede disparar una re-sync del sheet afectado sin bloquear la respuesta HTTP:

```js
import { spawn } from 'child_process';

function triggerSheetSync(sheetKey) {
  const child = spawn('node', ['scripts/accessible-base-sync.js', `--sheet=${sheetKey}`], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  });
  child.unref();
}

// Ejemplo: después de escribir en CRM_Operativo
await sheets.spreadsheets.values.update({ ... });
triggerSheetSync('crm_operativo'); // fire-and-forget
```

### Watch mode (agente autónomo)

```bash
# En una terminal separada o LaunchAgent:
npm run sheets:sync:watch   # polling cada 3 min
```

### Webhook de Sheets (opcional, avanzado)

Google Sheets no tiene webhooks nativos, pero Apps Script puede detectar cambios y POSTear a nuestro servidor:

```js
// En Apps Script (ligado al libro CRM):
function onEdit(e) {
  UrlFetchApp.fetch('https://panelin-calc.../api/accessible-base/sync', {
    method: 'POST',
    payload: JSON.stringify({ sheet: 'crm_operativo' }),
    contentType: 'application/json',
  });
}
```

El endpoint `/api/accessible-base/sync` llama a `triggerSheetSync(body.sheet)`.

---

## Cross-reference — cómo se relacionan los sheets

```
CRM_Operativo.G  ←match→  Admin_Cotizaciones.H  (Wolfboard sync key)
CRM_Operativo.AF ←sync→   Admin_Cotizaciones.I  (respuesta)
CRM_Operativo.AH ←sync→   Admin_Cotizaciones.J  (link)
CRM_Operativo.W  contains  Q:{ml_question_id}    (ML dedup key)

Master_Cotizaciones → (marcar-entregado) → Ventas_realizadas_y_entregadas
Master_Cotizaciones.COTIZACION_ID = Pagos_Pendientes.cotizacion_id
Master_Cotizaciones.COTIZACION_ID = Ventas_2.0.cotizacion_id

MATRIZ_Precios.sku → Calculadora.constants.js (via /api/actualizar-precios-calculadora CSV)
Stock.codigo → Shopify sync (SHOPIFY_SYNC_AT timestamp)
```

---

## Checklist de permisos service account

| Sheet | Scope mínimo |
|-------|-------------|
| BMC_SHEET_ID | **Editor** (escribe CRM, marcar-entregado, audit) |
| WOLFB_ADMIN_SHEET_ID | **Editor** (sync bidireccional, K=TRUE, delete row) |
| BMC_PAGOS_SHEET_ID | Editor (POST /api/pagos) |
| BMC_VENTAS_SHEET_ID | Editor (POST /api/ventas) |
| BMC_STOCK_SHEET_ID | Editor (POST /api/stock) |
| BMC_MATRIZ_SHEET_ID | Editor (POST /api/matriz/push-pricing-overrides) |
| BMC_CALENDARIO_SHEET_ID | Lector |
| Accessible Base sync | Lector (solo lee para snapshots) |

---

*Mantener este documento sincronizado con cambios en `bmcDashboard.js`, `sheets-api-server.js`, `ml-crm-sync.js` y `crmOperativoLayout.js`.*
