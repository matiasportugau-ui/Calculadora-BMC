# Planilla principal para el dashboard BMC

**Objetivo:** Una planilla que integre y genere la información importante para el dashboard. El servidor del dashboard lee datos vía Google Sheets API usando una service account.

---

## 1. Workbook principal (CRM y cotizaciones)

| Dato | Valor |
|------|--------|
| **Nombre** | BMC crm_automatizado |
| **ID** | `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` |
| **URL** | [Abrir en Google Sheets](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit?usp=sharing) |
| **Variable de entorno** | `BMC_SHEET_ID` |

**Tabs que alimentan el dashboard desde este workbook:**
- **CRM_Operativo** → Cotizaciones, entregas, coordinación logística (#operaciones)
- **Parametros** → Catálogos y dropdowns (uso interno)
- **AUDIT_LOG** → Audit log (#audit)
- **Admin_Cotizaciones** → Integrada desde "2.0 - Administrador de Cotizaciones" (script `npm run integrate-admin-cotizaciones`). Ver [INTEGRACION-ADMIN-COTIZACIONES.md](INTEGRACION-ADMIN-COTIZACIONES.md).
- **Manual, Dashboard, Automatismos** → Uso operativo; no leídos por la API hoy

---

## 2. Acceso con Service Account

Para que el dashboard (servidor Node en 3001/3849) pueda leer y escribir en la planilla, la **service account** debe tener acceso al documento (compartir la planilla con el email de la cuenta como “Editor” o “Lector” según lo que necesite la API).

| Dato | Valor |
|------|--------|
| **Service account (lectura/escritura dashboard)** | `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` |

**Comprobación:** En Google Sheets → Archivo → Compartir, debe aparecer esta dirección con el permiso adecuado. Las credenciales (JSON de la service account) no se guardan en el repo; se usan vía `.env` o ruta local (por ejemplo `GOOGLE_APPLICATION_CREDENTIALS`).

---

## 3. Integración con el resto del dashboard

Hoy el dashboard obtiene datos de **5 workbooks** (multi-workbook). La planilla principal (`BMC_SHEET_ID`) es el núcleo de CRM y cotizaciones; el resto aporta finanzas, ventas, stock y calendario:

| Workbook | Env var | Qué aporta al dashboard |
|----------|---------|---------------------------|
| **BMC crm_automatizado** (esta planilla) | BMC_SHEET_ID | Cotizaciones, entregas, coordinación, audit |
| Pagos Pendientes 2026 | BMC_PAGOS_SHEET_ID | KPI financiero, pagos pendientes, breakdown |
| 2.0 - Ventas | BMC_VENTAS_SHEET_ID | Tabla Ventas 2.0 por proveedor |
| Stock E-Commerce | BMC_STOCK_SHEET_ID | Stock, bajo stock, valor inventario |
| Calendario vencimientos | BMC_CALENDARIO_SHEET_ID | Calendario de vencimientos por mes |

Si quieres que **una sola planilla integre y genere** toda la información del dashboard, hay dos enfoques:

1. **Mantener 5 workbooks** (estado actual): la “integración” la hace el servidor (bmcDashboard.js) leyendo los 5 y exponiendo una API unificada; la planilla principal sigue siendo la de CRM/cotizaciones.
2. **Concentrar en un solo workbook**: crear en **BMC crm_automatizado** (o en un nuevo workbook “Dashboard BMC”) tabs o hojas que:
   - Repliquen/agreguen datos de Pagos, Ventas, Stock y Calendario (por ejemplo con IMPORTRANGE o con scripts que copien/resuman), y  
   - Sean la única fuente que lee el dashboard (una sola `BMC_SHEET_ID` con muchas tabs).

En ambos casos, la service account `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` debe tener acceso a **cada** workbook que el dashboard vaya a leer.

---

## 4. Referencias

- Inventario de tabs y API: [planilla-inventory.md](planilla-inventory.md)
- Mapeo 5 workbooks: [SHEETS-MAPPING-5-WORKBOOKS.md](SHEETS-MAPPING-5-WORKBOOKS.md)
- Qué bloque del dashboard lee qué: [DASHBOARD-INTERFACE-MAP.md](../bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md) §5 (Cross-reference)
