/**
 * StockAlertas.gs — Workbook 4: Stock E-Commerce
 * Instalar en: Extensions > Apps Script en el workbook "Stock E-Commerce"
 * Proyecto: BMC_StockAlertas_Automation
 *
 * Triggers necesarios (manual — Extensions > Apps Script > Triggers):
 *   alertarBajoStock  → Time-driven, daily, 8:30 AM
 *   onEdit           → On edit (spreadsheet event)
 */

var STOCK_UMBRAL = 5;

/**
 * Lee la hoja principal (2 filas de encabezado), resalta filas con STOCK < 5
 * y envía email digest solo si hay productos en esa condición.
 */
function alertarBajoStock() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];

  // Stock sheet has 2 header rows — data starts at row 4 (index 3)
  var data = sheet.getDataRange().getValues();
  if (data.length < 4) return;

  var headers = data[2].map(function(h) { return String(h || '').trim(); }); // row 3 = index 2
  var stockCol = headers.findIndex(function(h) { return /^Stock$/i.test(h); });
  var productoCol = headers.findIndex(function(h) { return /^Producto$/i.test(h); });
  var codigoCol = headers.findIndex(function(h) { return /Codigo|Código/i.test(h); });

  if (stockCol < 0) {
    Logger.log('StockAlertas: columna Stock no encontrada.');
    return;
  }

  var bajoStock = [];

  for (var i = 3; i < data.length; i++) { // data rows start at index 3 (row 4)
    var producto = productoCol >= 0 ? String(data[i][productoCol] || '').trim() : '';
    if (!producto) continue;

    var stock = parseFloat(data[i][stockCol]);
    if (isNaN(stock) || stock < 0) continue;

    if (stock < STOCK_UMBRAL) {
      sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#fff3cd');
      bajoStock.push({
        codigo: codigoCol >= 0 ? data[i][codigoCol] : '',
        producto: producto,
        stock: stock
      });
    }
  }

  if (bajoStock.length === 0) return; // no noise

  var emails = _getEquipoEmails(ss);
  if (emails.length === 0) {
    Logger.log('StockAlertas: no hay emails configurados para alertas.');
    return;
  }

  var fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var subject = 'BMC — ' + bajoStock.length + ' productos bajo stock (' + fechaHoy + ')';
  var body = 'Productos con stock < ' + STOCK_UMBRAL + ':\n\n';
  bajoStock.forEach(function(p) {
    body += '  • [' + p.codigo + '] ' + p.producto + ' — stock: ' + p.stock + '\n';
  });
  body += '\nAcceder al workbook: ' + ss.getUrl() + '\n\nSistema BMC.';

  emails.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, subject, body);
    } catch (e) {
      Logger.log('StockAlertas alertarBajoStock error email: ' + e);
    }
  });

  Logger.log('StockAlertas: ' + bajoStock.length + ' productos bajo stock, alerta enviada.');
}

/**
 * onEdit: cuando la columna STOCK se edita a un valor < 5, resalta la fila (sin email).
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();

  if (row <= 3) return; // header rows

  // Find STOCK column in row 3 (headers)
  var headers = sheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  var stockCol = headers.findIndex(function(h) { return /^Stock$/i.test(h); }) + 1;

  if (col !== stockCol) return;

  var newVal = parseFloat(e.range.getValue());
  if (!isNaN(newVal) && newVal >= 0 && newVal < STOCK_UMBRAL) {
    sheet.getRange(row, 1, 1, headers.length).setBackground('#fff3cd');
  } else if (!isNaN(newVal) && newVal >= STOCK_UMBRAL) {
    // Clear highlight if restocked
    sheet.getRange(row, 1, 1, headers.length).setBackground(null);
  }
}

/**
 * Obtiene emails del EQUIPOS tab del workbook 1 via PropertiesService o fallback.
 */
function _getEquipoEmails(ss) {
  var workbook1Id = PropertiesService.getScriptProperties().getProperty('WORKBOOK1_ID');
  if (workbook1Id) {
    try {
      var wb1 = SpreadsheetApp.openById(workbook1Id);
      var equipoSheet = wb1.getSheetByName('EQUIPOS');
      if (equipoSheet) {
        var data = equipoSheet.getDataRange().getValues();
        var emails = [];
        for (var i = 1; i < data.length; i++) {
          if (data[i][1]) emails.push(String(data[i][1]).trim());
        }
        return emails;
      }
    } catch (e) {
      Logger.log('StockAlertas _getEquipoEmails external error: ' + e);
    }
  }
  // Fallback: check if this workbook has EQUIPOS tab
  var localEquipos = ss.getSheetByName('EQUIPOS');
  if (!localEquipos) return [];
  var localData = localEquipos.getDataRange().getValues();
  return localData.slice(1).map(function(r) { return String(r[1] || '').trim(); }).filter(Boolean);
}
