/**
 * CalendarioRecordatorio.gs — Workbook 5: Calendario de vencimientos
 * Instalar en: Extensions > Apps Script en el workbook "Calendario de vencimientos"
 * Proyecto: BMC_CalendarioRecordatorio_Automation
 *
 * Pre-condición: añadir columna "PAGADO" al final de cada tab mensual (ej. MARZO 2026).
 *
 * Triggers necesarios (manual — Extensions > Apps Script > Triggers):
 *   recordatorioVencimientosSemana  → Time-driven, weekly, Monday 8:00 AM
 *   onOpen                         → automático (se instala como trigger simple)
 */

var MESES_ES = {
  '01': 'ENERO', '02': 'FEBRERO', '03': 'MARZO', '04': 'ABRIL',
  '05': 'MAYO', '06': 'JUNIO', '07': 'JULIO', '08': 'AGOSTO',
  '09': 'SEPTIEMBRE', '10': 'OCTUBRE', '11': 'NOVIEMBRE', '12': 'DICIEMBRE'
};

/**
 * Añade menú "Vencimientos" con acción de revisión semanal.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vencimientos')
    .addItem('Revisar semana', 'recordatorioVencimientosSemana')
    .addToUi();
}

/**
 * Envía email con vencimientos de la semana actual que no están pagados.
 * Se ejecuta los lunes a las 8am.
 */
function recordatorioVencimientosSemana() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Build current month tab name
  var now = new Date();
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var year = now.getFullYear();
  var tabName = (MESES_ES[mm] || '') + ' ' + year; // e.g. "MARZO 2026"

  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    Logger.log('CalendarioRecordatorio: tab ' + tabName + ' no encontrada.');
    return;
  }

  // Get week range (Mon–Sun)
  var startWeek = _getStartOfWeek(now);
  var endWeek = new Date(startWeek);
  endWeek.setDate(endWeek.getDate() + 6);
  endWeek.setHours(23, 59, 59, 999);

  // Data starts at row 2 (headerRowOffset: 1)
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  var headers = data[1] ? data[1].map(function(h) { return String(h || '').trim(); }) : [];
  if (!headers.length) headers = data[0].map(function(h) { return String(h || '').trim(); });

  var conceptoCol = headers.findIndex(function(h) { return /CONCEPTO|Concepto/i.test(h); });
  var importeCol = headers.findIndex(function(h) { return /IMPORTE|NO PAGO/i.test(h); });
  var pagadoCol = headers.findIndex(function(h) { return /^PAGADO$/i.test(h); });
  var fechaCol = headers.findIndex(function(h) { return /^DIA$|^FECHA$|^Fecha$/i.test(h); });

  var vencimientosSemana = [];
  var dataStart = headers === data[0] ? 1 : 2;

  for (var i = dataStart; i < data.length; i++) {
    var concepto = conceptoCol >= 0 ? String(data[i][conceptoCol] || '').trim() : '';
    if (!concepto) continue;

    var importe = importeCol >= 0 ? parseFloat(data[i][importeCol]) : 0;
    if (!importe || importe <= 0) continue;

    var pagado = pagadoCol >= 0 ? String(data[i][pagadoCol] || '').trim() : '';
    if (pagado.toLowerCase() === 'sí' || pagado.toLowerCase() === 'si') continue;

    // Build date from DIA column or row position
    var fechaItem = null;
    if (fechaCol >= 0 && data[i][fechaCol]) {
      fechaItem = new Date(data[i][fechaCol]);
      if (isNaN(fechaItem.getTime())) {
        // Try parsing as day number within current month
        var dia = parseInt(data[i][fechaCol]);
        if (!isNaN(dia)) {
          fechaItem = new Date(year, now.getMonth(), dia);
        }
      }
    }

    if (fechaItem && !isNaN(fechaItem.getTime())) {
      if (fechaItem >= startWeek && fechaItem <= endWeek) {
        vencimientosSemana.push({
          concepto: concepto,
          importe: importe,
          fecha: Utilities.formatDate(fechaItem, Session.getScriptTimeZone(), 'dd/MM/yyyy')
        });
      }
    } else {
      // No date — include all unpaid with importe > 0 (fallback)
      vencimientosSemana.push({ concepto: concepto, importe: importe, fecha: '?' });
    }
  }

  if (vencimientosSemana.length === 0) {
    Logger.log('CalendarioRecordatorio: no hay vencimientos esta semana en ' + tabName + '.');
    return;
  }

  var emails = _getEquipoEmails(ss);
  if (emails.length === 0) {
    Logger.log('CalendarioRecordatorio: no hay emails configurados.');
    return;
  }

  var fechaInicioStr = Utilities.formatDate(startWeek, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var subject = 'BMC — ' + vencimientosSemana.length + ' vencimientos esta semana: ' + fechaInicioStr;
  var body = 'Vencimientos de la semana (' + tabName + '):\n\n';
  vencimientosSemana.forEach(function(v) {
    body += '  • ' + v.concepto + ' | ' + v.fecha + ' | $ ' + v.importe + '\n';
  });
  body += '\nAcceder al workbook: ' + ss.getUrl() + '\n\nSistema BMC.';

  emails.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, subject, body);
    } catch (e) {
      Logger.log('CalendarioRecordatorio error email: ' + e);
    }
  });

  Logger.log('CalendarioRecordatorio: ' + vencimientosSemana.length + ' vencimientos, digest enviado.');
}

function _getStartOfWeek(d) {
  var date = new Date(d);
  var day = date.getDay();
  var diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function _getEquipoEmails(ss) {
  var workbook1Id = PropertiesService.getScriptProperties().getProperty('WORKBOOK1_ID');
  if (workbook1Id) {
    try {
      var wb1 = SpreadsheetApp.openById(workbook1Id);
      var equipoSheet = wb1.getSheetByName('EQUIPOS');
      if (equipoSheet) {
        return equipoSheet.getDataRange().getValues().slice(1)
          .map(function(r) { return String(r[1] || '').trim(); }).filter(Boolean);
      }
    } catch (e) {
      Logger.log('CalendarioRecordatorio _getEquipoEmails error: ' + e);
    }
  }
  return [];
}
