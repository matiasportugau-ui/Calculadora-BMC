/**
 * VentasConsolidar.gs — Workbook 3: 2.0 - Ventas
 * Instalar en: Extensions > Apps Script en el workbook "2.0 - Ventas"
 * Proyecto: BMC_VentasConsolidar_Automation
 *
 * Pre-condición: crear manualmente la tab "Ventas_Consolidado" con columnas:
 *   COTIZACION_ID | PROVEEDOR | CLIENTE_NOMBRE | FECHA_ENTREGA | COSTO |
 *   GANANCIA | SALDO_CLIENTE | PAGO_PROVEEDOR | FACTURADO | NUM_FACTURA | FECHA_INGRESO
 *
 * Triggers necesarios (manual — Extensions > Apps Script > Triggers):
 *   consolidarVentasDiario       → Time-driven, daily, 7:00 AM
 *   alertarVentasSinFacturar     → Time-driven, weekly, Monday 9:00 AM
 */

var SKIP_TABS = ['Ventas y Coordinaciones', 'Ventas_Consolidado', 'Resumen Semanal'];
var CONSOLIDADO_HEADERS = [
  'COTIZACION_ID', 'PROVEEDOR', 'CLIENTE_NOMBRE', 'FECHA_ENTREGA',
  'COSTO', 'GANANCIA', 'SALDO_CLIENTE', 'PAGO_PROVEEDOR',
  'FACTURADO', 'NUM_FACTURA', 'FECHA_INGRESO'
];

/**
 * Upserta filas de todos los tabs de proveedor en "Ventas_Consolidado".
 * Match por COTIZACION_ID + PROVEEDOR — inserta si nuevo, actualiza si existe.
 */
function consolidarVentasDiario() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var consolidado = ss.getSheetByName('Ventas_Consolidado');
  if (!consolidado) {
    Logger.log('VentasConsolidar: tab Ventas_Consolidado no existe. Crearla manualmente primero.');
    return;
  }

  // Ensure header row
  var firstRow = consolidado.getRange(1, 1, 1, CONSOLIDADO_HEADERS.length).getValues()[0];
  if (!firstRow[0]) {
    consolidado.getRange(1, 1, 1, CONSOLIDADO_HEADERS.length).setValues([CONSOLIDADO_HEADERS]);
    consolidado.getRange(1, 1, 1, CONSOLIDADO_HEADERS.length).setFontWeight('bold');
  }

  // Build index of existing rows by COTIZACION_ID+PROVEEDOR
  var existingData = consolidado.getDataRange().getValues();
  var existingHeaders = existingData[0] || CONSOLIDADO_HEADERS;
  var idIdx = existingHeaders.indexOf('COTIZACION_ID');
  var provIdx = existingHeaders.indexOf('PROVEEDOR');
  var existingIndex = {};
  for (var i = 1; i < existingData.length; i++) {
    var key = String(existingData[i][idIdx] || '') + '|' + String(existingData[i][provIdx] || '');
    if (key !== '|') existingIndex[key] = i + 1; // spreadsheet row number
  }

  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var sheets = ss.getSheets();
  var newRows = 0, updatedRows = 0;

  sheets.forEach(function(sheet) {
    var tabName = sheet.getName();
    if (SKIP_TABS.indexOf(tabName) >= 0) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    // Header row is row 2 (index 1) for these sheets
    var headerRowIndex = data.length > 1 && !data[0][0] ? 1 : 0;
    var headers = data[headerRowIndex].map(function(h) { return String(h || '').trim(); });

    var idPedidoCol = _findCol(headers, ['ID. Pedido', 'Id. Pedido', 'ID Pedido']);
    var nombreCol = _findCol(headers, ['NOMBRE', 'Nombre']);
    var fechaEntregaCol = _findCol(headers, ['FECHA ENTREGA', 'Fecha entrega']);
    var costoCol = _findCol(headers, ['COSTO SIN IVA', 'MONTO SIN IVA', 'Costo']);
    var gananciaCol = _findCol(headers, ['GANANCIAS SIN IVA', 'Ganancia']);
    var saldoCol = _findCol(headers, ['SALDOS', 'Saldos']);
    var pagoProvCol = _findCol(headers, ['Pago a Proveedor']);
    var facturadoCol = _findCol(headers, ['FACTURADO', 'Facturado']);
    var numFactCol = _findCol(headers, ['Nº FACTURA', 'Nº Factura', 'NUM FACTURA']);

    for (var i = headerRowIndex + 1; i < data.length; i++) {
      var cotizId = idPedidoCol >= 0 ? String(data[i][idPedidoCol] || '').trim() : '';
      if (!cotizId) continue;

      var rowData = [
        cotizId,                                                   // COTIZACION_ID
        tabName,                                                   // PROVEEDOR
        nombreCol >= 0 ? data[i][nombreCol] : '',                  // CLIENTE_NOMBRE
        fechaEntregaCol >= 0 ? data[i][fechaEntregaCol] : '',      // FECHA_ENTREGA
        costoCol >= 0 ? data[i][costoCol] : '',                    // COSTO
        gananciaCol >= 0 ? data[i][gananciaCol] : '',              // GANANCIA
        saldoCol >= 0 ? data[i][saldoCol] : '',                    // SALDO_CLIENTE
        pagoProvCol >= 0 ? data[i][pagoProvCol] : '',              // PAGO_PROVEEDOR
        facturadoCol >= 0 ? data[i][facturadoCol] : '',            // FACTURADO
        numFactCol >= 0 ? data[i][numFactCol] : '',                // NUM_FACTURA
        hoy                                                         // FECHA_INGRESO
      ];

      var key = cotizId + '|' + tabName;
      if (existingIndex[key]) {
        // Update existing row (skip FECHA_INGRESO to preserve original)
        var updateRow = rowData.slice(0, 10);
        consolidado.getRange(existingIndex[key], 1, 1, 10).setValues([updateRow]);
        updatedRows++;
      } else {
        consolidado.appendRow(rowData);
        existingIndex[key] = consolidado.getLastRow();
        newRows++;
      }
    }
  });

  Logger.log('VentasConsolidar: ' + newRows + ' nuevas, ' + updatedRows + ' actualizadas en Ventas_Consolidado.');
}

/**
 * Envía email digest de ventas sin facturar con FECHA_ENTREGA hace más de 30 días.
 * Se ejecuta los lunes a las 9am.
 */
function alertarVentasSinFacturar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var consolidado = ss.getSheetByName('Ventas_Consolidado');
  if (!consolidado) return;

  var data = consolidado.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var facturadoIdx = headers.indexOf('FACTURADO');
  var fechaEntregaIdx = headers.indexOf('FECHA_ENTREGA');
  var cotizIdIdx = headers.indexOf('COTIZACION_ID');
  var clienteIdx = headers.indexOf('CLIENTE_NOMBRE');
  var proveedorIdx = headers.indexOf('PROVEEDOR');

  var hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  var sinFacturar = [];

  for (var i = 1; i < data.length; i++) {
    var facturado = String(data[i][facturadoIdx] || '').trim();
    if (facturado && facturado.toLowerCase() !== 'no' && facturado !== '') continue;

    var fechaEntrega = fechaEntregaIdx >= 0 ? data[i][fechaEntregaIdx] : null;
    if (!fechaEntrega) continue;
    var fe = new Date(fechaEntrega);
    if (isNaN(fe.getTime()) || fe > hace30Dias) continue;

    sinFacturar.push({
      cotizId: cotizIdIdx >= 0 ? data[i][cotizIdIdx] : '',
      cliente: clienteIdx >= 0 ? data[i][clienteIdx] : '',
      proveedor: proveedorIdx >= 0 ? data[i][proveedorIdx] : '',
      fecha: Utilities.formatDate(fe, Session.getScriptTimeZone(), 'dd/MM/yyyy')
    });
  }

  if (sinFacturar.length === 0) return;

  var sheet1Id = PropertiesService.getScriptProperties().getProperty('WORKBOOK1_ID');
  var emails = sheet1Id ? _getEquipoEmailsExternal(sheet1Id) : _getLocalEquipoEmails(ss);
  if (emails.length === 0) return;

  var fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var subject = 'BMC — ' + sinFacturar.length + ' ventas sin facturar (' + fechaHoy + ')';
  var body = 'Ventas entregadas hace más de 30 días sin número de factura:\n\n';
  sinFacturar.forEach(function(v) {
    body += '  • ' + v.cotizId + ' | ' + v.cliente + ' | ' + v.proveedor + ' | entrega: ' + v.fecha + '\n';
  });
  body += '\nAcceder al workbook: ' + ss.getUrl() + '\n\nSistema BMC.';

  emails.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, subject, body);
    } catch (e) {
      Logger.log('VentasConsolidar alertarVentasSinFacturar error: ' + e);
    }
  });
}

function _findCol(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function _getLocalEquipoEmails(ss) {
  var equipoSheet = ss.getSheetByName('EQUIPOS');
  if (!equipoSheet) return [];
  var data = equipoSheet.getDataRange().getValues();
  var emails = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1]) emails.push(String(data[i][1]).trim());
  }
  return emails;
}

function _getEquipoEmailsExternal(workbook1Id) {
  try {
    var ss = SpreadsheetApp.openById(workbook1Id);
    return _getLocalEquipoEmails(ss);
  } catch (e) {
    Logger.log('VentasConsolidar _getEquipoEmailsExternal error: ' + e);
    return [];
  }
}
