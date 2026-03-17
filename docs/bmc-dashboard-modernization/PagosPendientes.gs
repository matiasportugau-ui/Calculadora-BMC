/**
 * PagosPendientes.gs — Workbook 2: Pagos Pendientes 2026
 * Instalar en: Extensions > Apps Script en el workbook "Pagos Pendientes 2026"
 * Proyecto: BMC_PagosPendientes_Automation
 *
 * Triggers necesarios (manual — Extensions > Apps Script > Triggers):
 *   alertarPagosVencidos  → Time-driven, daily, 8:00 AM
 *   onEdit               → On edit (spreadsheet event)
 */

/**
 * Resalta filas vencidas y envía un email digest a los contactos en la tab CONTACTOS.
 * Se ejecuta diariamente a las 8am.
 */
function alertarPagosVencidos() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0]; // Pendientes_ tab
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var fechaCol = headers.findIndex(function(h) { return /^FECHA$|^Fecha$|^PLAZO$/i.test(h); });
  var estadoCol = headers.findIndex(function(h) { return /^ESTADO$/i.test(h); });
  var montoCol = headers.findIndex(function(h) { return /Saldo.*Proveedor.*USD|Pago.*Proveedor.*USD|Venta.*U\$S/i.test(h); });

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var vencidos = [];

  for (var i = 1; i < data.length; i++) {
    var estado = estadoCol >= 0 ? String(data[i][estadoCol] || '').trim() : '';
    if (estado.toLowerCase() === 'cobrado') continue;

    var fechaVal = fechaCol >= 0 ? data[i][fechaCol] : null;
    if (!fechaVal) continue;

    var fecha = new Date(fechaVal);
    fecha.setHours(0, 0, 0, 0);
    if (isNaN(fecha.getTime())) continue;

    if (fecha < today) {
      // Highlight row red
      sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#ffcccc');
      var monto = montoCol >= 0 ? data[i][montoCol] : '';
      vencidos.push({
        fila: i + 1,
        fecha: Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
        monto: monto,
        estado: estado
      });
    }
  }

  if (vencidos.length === 0) return;

  // Send digest email to CONTACTOS tab
  var contactos = _getContactos(ss);
  if (contactos.length === 0) {
    Logger.log('PagosPendientes: no hay contactos en tab CONTACTOS para enviar alerta.');
    return;
  }

  var fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var subject = 'BMC — ' + vencidos.length + ' pagos vencidos (' + fechaHoy + ')';
  var body = 'Se detectaron ' + vencidos.length + ' filas con pagos vencidos:\n\n';
  vencidos.forEach(function(v) {
    body += '  • Fila ' + v.fila + ' | Fecha: ' + v.fecha + ' | Monto: ' + v.monto + ' | Estado: ' + v.estado + '\n';
  });
  body += '\nAcceder al workbook: ' + ss.getUrl() + '\n\nSistema BMC.';

  contactos.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, subject, body);
    } catch (e) {
      Logger.log('PagosPendientes alertarPagosVencidos error email ' + email + ': ' + e);
    }
  });

  Logger.log('PagosPendientes: ' + vencidos.length + ' vencidos, digest enviado a ' + contactos.length + ' contactos.');
}

/**
 * onEdit: cuando ESTADO se edita a "Cobrado", registra FECHA_COBRO y pinta fila verde.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var newVal = String(e.range.getValue() || '').trim();

  if (row < 2) return; // header row

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });
  var estadoCol = headers.findIndex(function(h) { return /^ESTADO$/i.test(h); }) + 1;

  if (col !== estadoCol) return;

  if (newVal.toLowerCase() === 'cobrado') {
    // Paint row green
    sheet.getRange(row, 1, 1, headers.length).setBackground('#d9f7be');
    // Write FECHA_COBRO if column exists
    var fechaCobCol = headers.findIndex(function(h) { return /FECHA_COBRO|FECHA COBRO/i.test(h); }) + 1;
    if (fechaCobCol > 0) {
      sheet.getRange(row, fechaCobCol).setValue(
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
      );
    }
  }
}

/**
 * Lee emails de la tab CONTACTOS (columnas: NOMBRE | EMAIL).
 */
function _getContactos(ss) {
  var sheet = ss.getSheetByName('CONTACTOS');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var emails = [];
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][1] || '').trim();
    if (email && email.indexOf('@') > -1) emails.push(email);
  }
  return emails;
}
