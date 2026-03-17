# Automations by Workbook

**Propósito:** Scripts Apps Script y triggers por workbook BMC. Cada workbook puede tener su propio proyecto Apps Script.

**Referencias:** [SHEETS-MAPPING-5-WORKBOOKS.md](SHEETS-MAPPING-5-WORKBOOKS.md), [Code.gs](../bmc-dashboard-modernization/Code.gs).

---

## 1. BMC crm_automatizado

**Workbook ID:** `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg`

**Proyecto Apps Script:** BMC_Dashboard_Automation (Extensions > Apps Script en el workbook)

**Scripts existentes:** [docs/bmc-dashboard-modernization/Code.gs](../bmc-dashboard-modernization/Code.gs)

| Función | Propósito | Trigger |
|---------|-----------|---------|
| `runInitialSetup` | Crear tabs (Master_Cotizaciones, Pagos_Pendientes, AUDIT_LOG, etc.) | Manual |
| `showEntregasPendientesDialog` | Diálogo entregas fecha ayer | onOpen (menú Ventas) |
| `processEntregasConfirmadas` | Mover filas a Ventas realizadas | Desde diálogo |
| `getEntregasFechaAyer` | Filtrar entregas con FECHA_ENTREGA = ayer | — |

**Instalación:** Pegar Code.gs y DialogEntregas en el proyecto; ejecutar runInitialSetup una vez; configurar triggers si aplica.

---

## 2. Pagos Pendientes 2026

**Workbook ID:** `1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI`

**Script:** [docs/bmc-dashboard-modernization/PagosPendientes.gs](../bmc-dashboard-modernization/PagosPendientes.gs)

**Automatizaciones implementadas:**

| Función | Descripción | Trigger |
|---------|-------------|---------|
| `alertarPagosVencidos` | Resalta filas vencidas (#ffcccc) + email digest a tab CONTACTOS | Time-driven daily 8:00 AM |
| `onEdit` | Cuando ESTADO → "Cobrado": pinta verde + escribe FECHA_COBRO | On edit |

**Checklist instalación:**
- [ ] Crear tab `CONTACTOS` con columnas: NOMBRE \| EMAIL
- [ ] Instalar triggers: `alertarPagosVencidos` (time-driven daily 8am) + `onEdit` (on edit)

---

## 3. 2.0 - Ventas

**Workbook ID:** `1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue`

**Script:** [docs/bmc-dashboard-modernization/VentasConsolidar.gs](../bmc-dashboard-modernization/VentasConsolidar.gs)

**Automatizaciones implementadas:**

| Función | Descripción | Trigger |
|---------|-------------|---------|
| `consolidarVentasDiario` | Upserta todos los tabs proveedor → Ventas_Consolidado (match por COTIZACION_ID+PROVEEDOR) | Time-driven daily 7:00 AM |
| `alertarVentasSinFacturar` | Email con ventas entregadas hace >30 días sin número de factura | Time-driven weekly Monday 9:00 AM |

**Pre-condición:** Crear manualmente tab `Ventas_Consolidado` con columnas:
`COTIZACION_ID | PROVEEDOR | CLIENTE_NOMBRE | FECHA_ENTREGA | COSTO | GANANCIA | SALDO_CLIENTE | PAGO_PROVEEDOR | FACTURADO | NUM_FACTURA | FECHA_INGRESO`

**Checklist instalación:**
- [ ] Crear tab `Ventas_Consolidado` con los 11 headers
- [ ] Instalar triggers: `consolidarVentasDiario` (daily 7am) + `alertarVentasSinFacturar` (weekly Monday 9am)
- [ ] Opcional: configurar Script Property `WORKBOOK1_ID` = ID del workbook CRM para emails desde EQUIPOS

---

## 4. Stock E-Commerce

**Workbook ID:** `1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw`

**Script:** [docs/bmc-dashboard-modernization/StockAlertas.gs](../bmc-dashboard-modernization/StockAlertas.gs)

**Automatizaciones implementadas:**

| Función | Descripción | Trigger |
|---------|-------------|---------|
| `alertarBajoStock` | Resalta filas con STOCK < 5 (#fff3cd) + email digest si count > 0 | Time-driven daily 8:30 AM |
| `onEdit` | Cuando columna STOCK se edita a < 5: resalta fila (sin email) | On edit |

**Checklist instalación:**
- [ ] Añadir columna `SHOPIFY_SYNC_AT` al final de la hoja principal
- [ ] Instalar triggers: `alertarBajoStock` (daily 8:30am) + `onEdit` (on edit)
- [ ] Opcional: configurar Script Property `WORKBOOK1_ID` para emails desde EQUIPOS

---

## 5. Calendario de vencimientos

**Workbook ID:** `1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk`

**Script:** [docs/bmc-dashboard-modernization/CalendarioRecordatorio.gs](../bmc-dashboard-modernization/CalendarioRecordatorio.gs)

**Automatizaciones implementadas:**

| Función | Descripción | Trigger |
|---------|-------------|---------|
| `recordatorioVencimientosSemana` | Email con vencimientos de la semana actual no pagados | Time-driven weekly Monday 8:00 AM |
| `onOpen` | Agrega menú "Vencimientos > Revisar semana" | On open (automático) |

**Pre-condición:** Añadir columna `PAGADO` al final de cada tab mensual (empezar con MARZO 2026).

**Checklist instalación:**
- [ ] Añadir columna `PAGADO` a cada tab mensual (Sí / vacío)
- [ ] Instalar trigger: `recordatorioVencimientosSemana` (weekly Monday 8am)
- [ ] Configurar Script Property `WORKBOOK1_ID` para emails desde EQUIPOS

---

## 6. Code.gs — sendWeeklyAlarmDigest (Workbook 1)

**Script:** [docs/bmc-dashboard-modernization/Code.gs](../bmc-dashboard-modernization/Code.gs)

| Función | Descripción | Trigger |
|---------|-------------|---------|
| `sendWeeklyAlarmDigest` | Email HTML cross-workbook con 5 secciones: pagos vencidos, cotizaciones, ventas sin facturar, bajo stock, vencimientos calendario | Time-driven weekly Monday 8:00 AM |

**Script Properties a configurar en el proyecto Apps Script de Workbook 1:**
| Key | Valor |
|-----|-------|
| `PAGOS_SHEET_ID` | ID del workbook Pagos Pendientes 2026 |
| `VENTAS_SHEET_ID` | ID del workbook 2.0 - Ventas |
| `STOCK_SHEET_ID` | ID del workbook Stock E-Commerce |
| `CALENDARIO_SHEET_ID` | ID del workbook Calendario de vencimientos |
| `DASHBOARD_URL` | URL del dashboard desplegado |

---

## 7. Resumen de triggers — checklist global

| Script | Función | Trigger | Tiempo |
|--------|---------|---------|--------|
| PagosPendientes.gs | `alertarPagosVencidos` | Time-driven daily | 8:00 AM |
| PagosPendientes.gs | `onEdit` | On edit | — |
| VentasConsolidar.gs | `consolidarVentasDiario` | Time-driven daily | 7:00 AM |
| VentasConsolidar.gs | `alertarVentasSinFacturar` | Time-driven weekly | Monday 9:00 AM |
| StockAlertas.gs | `alertarBajoStock` | Time-driven daily | 8:30 AM |
| StockAlertas.gs | `onEdit` | On edit | — |
| CalendarioRecordatorio.gs | `recordatorioVencimientosSemana` | Time-driven weekly | Monday 8:00 AM |
| Code.gs (workbook 1) | `sendWeeklyAlarmDigest` | Time-driven weekly | Monday 8:00 AM |

---

## 8. Instalación por workbook

1. Abrir el workbook en Google Sheets.
2. Extensiones > Apps Script.
3. Crear nuevo proyecto o usar existente.
4. Pegar el script correspondiente.
5. Guardar (Ctrl+S).
6. Para triggers: Editar > Activadores del proyecto actual > Añadir activador.
7. Seleccionar función, tipo (time-driven o al editar), frecuencia.

---

## 9. Service account y permisos

Los scripts Apps Script se ejecutan con permisos del usuario propietario del workbook. No requieren la service account del dashboard. La service account (`bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`) es solo para la API Node.js que lee los sheets.

---

**Última actualización:** 2026-03-16
