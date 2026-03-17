/**
 * BMC Dashboard Automation — Phase 1 (Data Layer) + Phase 2 (Automation)
 * Project: BMC Uruguay Dashboard Modernization
 * Paste this into Extensions > Apps Script in the workbook
 * "2.0 - Administrador de Cotizaciones" (Google Sheets).
 * Save project as "BMC_Dashboard_Automation".
 */

// ─── Phase 1: One-time setup ─────────────────────────────────────────────
function runInitialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create Master_Cotizaciones if not exists
  let master = ss.getSheetByName('Master_Cotizaciones');
  if (!master) {
    master = ss.insertSheet('Master_Cotizaciones');
  }
  _setupMasterCotizaciones(master);
  
  // Create EQUIPOS
  let equipos = ss.getSheetByName('EQUIPOS');
  if (!equipos) {
    equipos = ss.insertSheet('EQUIPOS');
  }
  _setupEquipos(equipos);
  
  // Set ASIGNADO_A dropdown from EQUIPOS NOMBRE column
  const equipoNames = equipos.getRange(2, 1, equipos.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
  if (equipoNames.length > 0) {
    const asignadoRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(equipoNames, true)
      .setAllowInvalid(false)
      .build();
    master.getRange('I2:I1000').setDataValidation(asignadoRule);
  }
  
  // Create AUDIT_LOG
  let audit = ss.getSheetByName('AUDIT_LOG');
  if (!audit) {
    audit = ss.insertSheet('AUDIT_LOG');
    audit.appendRow(['TIMESTAMP', 'ACTION', 'ROW', 'OLD_VALUE', 'NEW_VALUE', 'REASON', 'USER', 'SHEET']);
  }
  
  // Create ESTADOS_TRANSICION
  let estados = ss.getSheetByName('ESTADOS_TRANSICION');
  if (!estados) {
    estados = ss.insertSheet('ESTADOS_TRANSICION');
    _setupEstadosTransicion(estados);
  }
  
  // Create Ventas realizadas y entregadas (registros confirmados como entregados)
  let entregadas = ss.getSheetByName('Ventas realizadas y entregadas');
  if (!entregadas) {
    entregadas = ss.insertSheet('Ventas realizadas y entregadas');
    _setupVentasEntregadas(entregadas);
  }
  
  // Create Pagos_Pendientes (vencimientos y cobros)
  let pagos = ss.getSheetByName('Pagos_Pendientes');
  if (!pagos) {
    pagos = ss.insertSheet('Pagos_Pendientes');
    _setupPagosPendientes(pagos);
  }
  
  // Create Metas_Ventas (metas de ventas por periodo)
  let metas = ss.getSheetByName('Metas_Ventas');
  if (!metas) {
    metas = ss.insertSheet('Metas_Ventas');
    _setupMetasVentas(metas);
  }
  
  Logger.log('Phase 1 setup complete. Run migrateTwoRecords() to migrate data.');
}

function _setupPagosPendientes(sheet) {
  var headers = [
    'PAGO_ID', 'COTIZACION_ID', 'CLIENTE_NOMBRE', 'MONTO', 'MONEDA', 'FECHA_VENCIMIENTO',
    'ESTADO_PAGO', 'FECHA_COBRO', 'NOTAS'
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  var estadoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pendiente', 'Cobrado'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('G2:G1000').setDataValidation(estadoRule);
  var monedaRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['$', 'UES'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('E2:E1000').setDataValidation(monedaRule);
}

function _setupMetasVentas(sheet) {
  var headers = ['PERIODO', 'META_MONTO', 'MONEDA', 'TIPO', 'NOTAS'];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  var tipoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['mensual', 'semanal'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('D2:D500').setDataValidation(tipoRule);
  sheet.getRange('C2:C500').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['$', 'UES'], true).setAllowInvalid(false).build()
  );
  sheet.appendRow(['2026-03', '0', '$', 'mensual', 'Meta ventas marzo 2026']);
  sheet.appendRow(['Semana 12', '0', '$', 'semanal', 'Meta semana 12']);
}

function _setupVentasEntregadas(sheet) {
  const headers = [
    'COTIZACION_ID', 'FECHA_CREACION', 'FECHA_ACTUALIZACION', 'CLIENTE_ID', 'CLIENTE_NOMBRE',
    'TELEFONO', 'DIRECCION', 'ZONA', 'ASIGNADO_A', 'ESTADO', 'FECHA_ENVIO', 'FECHA_CONFIRMACION',
    'FECHA_ENTREGA', 'COMENTARIOS_ENTREGA', 'FECHA_ENTREGA_REAL', 'ORIGEN', 'MONTO_ESTIMADO', 'MONEDA', 'NOTAS', 'ETIQUETAS',
    'USUARIO_CREACION', 'USUARIO_ACTUALIZACION', 'VERSION', 'LINK_UBICACION', 'LINK_COTIZACION'
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}

function _setupMasterCotizaciones(sheet) {
  const headers = [
    'COTIZACION_ID', 'FECHA_CREACION', 'FECHA_ACTUALIZACION', 'CLIENTE_ID', 'CLIENTE_NOMBRE',
    'TELEFONO', 'DIRECCION', 'ZONA', 'ASIGNADO_A', 'ESTADO', 'FECHA_ENVIO', 'FECHA_CONFIRMACION',
    'FECHA_ENTREGA', 'COMENTARIOS_ENTREGA', 'DIAS_PENDIENTE', 'ORIGEN', 'MONTO_ESTIMADO', 'MONEDA', 'NOTAS', 'ETIQUETAS',
    'USUARIO_CREACION', 'USUARIO_ACTUALIZACION', 'VERSION', 'LINK_UBICACION', 'LINK_COTIZACION'
  ];
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  
  // Data validation: ESTADO (col J = 10) — incluye Entregado para mover a Ventas realizadas y entregadas
  const estadoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Borrador', 'Enviado', 'Pendiente', 'Confirmado', 'Rechazado', 'Entregado'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('J2:J1000').setDataValidation(estadoRule);
  
  // Data validation: MONEDA (col R = 18)
  const monedaRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['$', 'UES'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('R2:R1000').setDataValidation(monedaRule);
  
  // ASIGNADO_A (col I = 9): validation from EQUIPOS will be set in runInitialSetup after EQUIPOS exists
  
  // Formulas: K=FECHA_ENVIO, L=FECHA_CONFIRMACION; O=DIAS_PENDIENTE (FECHA_ENTREGA y COMENTARIOS_ENTREGA en M,N)
  sheet.getRange('K2').setFormula('=IF(J2="Enviado", TODAY(), "")');
  sheet.getRange('L2').setFormula('=IF(J2="Confirmado", TODAY(), "")');
  sheet.getRange('O2').setFormula('=IF(AND(K2<>"", J2="Pendiente"), DAYS(TODAY(), K2), "")');
  
  // Conditional formatting by ESTADO (col J) — Entregado = verde oscuro (ya movido a Ventas realizadas)
  const cfRules = [
    { state: 'Borrador', bg: '#f3f4f6' },
    { state: 'Enviado', bg: '#dbeafe' },
    { state: 'Pendiente', bg: '#fef9c3' },
    { state: 'Confirmado', bg: '#dcfce7' },
    { state: 'Rechazado', bg: '#fee2e2' },
    { state: 'Entregado', bg: '#bbf7d0' }
  ];
  cfRules.forEach(function (r, i) {
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(r.state)
      .setBackground(r.bg)
      .setRanges([sheet.getRange('J2:J1000')])
      .build();
    sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat([rule]));
  });
}

function _setupEquipos(sheet) {
  sheet.clear();
  sheet.appendRow(['NOMBRE', 'EMAIL', 'ROL', 'DEPARTAMENTO', 'ESTADO_ACTIVO']);
  sheet.appendRow(['Matías', 'matias@bmc.com', 'CEO', 'Dirección', 'TRUE']);
  sheet.appendRow(['Sandra', 'sandra@bmc.com', 'Admin', 'Administración', 'TRUE']);
  sheet.appendRow(['Ramiro', 'ramiro@bmc.com', 'Vendedor', 'Ventas', 'TRUE']);
  sheet.appendRow(['Martin', 'martin@bmc.com', 'Vendedor', 'Ventas', 'TRUE']);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
}

function _setupEstadosTransicion(sheet) {
  sheet.clear();
  sheet.appendRow(['ESTADO_ACTUAL', 'ESTADO_NUEVO', 'CONDICION', 'AUTO_ACCION', 'CAMPO_ACTUALIZAR', 'VALOR_NUEVO', 'DIAS_LIMITE']);
  sheet.appendRow(['Borrador', 'Enviado', 'Manual', 'Set FECHA_ENVIO', 'FECHA_ENVIO', 'TODAY()', '']);
  sheet.appendRow(['Enviado', 'Pendiente', 'Auto after 5 days', 'Send alert', 'ESTADO', 'Pendiente', '5']);
  sheet.appendRow(['Pendiente', 'Confirmado', 'Manual', 'Set FECHA_CONFIRMACION', 'FECHA_CONFIRMACION', 'TODAY()', '']);
  sheet.appendRow(['Pendiente', 'Rechazado', 'Manual', 'Log reason', 'ESTADO', 'Rechazado', '']);
  sheet.appendRow(['Confirmado', 'Rechazado', 'Manual', 'Log reason', 'ESTADO', 'Rechazado', '']);
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
}

// ─── Menú y diálogo: entregas con fecha ayer ─────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ventas')
    .addItem('Revisar entregas (fecha ayer)', 'showEntregasPendientesDialog')
    .addToUi();
}

/**
 * Obtiene las filas de Master_Cotizaciones con ESTADO = Confirmado y FECHA_ENTREGA = ayer.
 */
function getEntregasFechaAyer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Master_Cotizaciones');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var estadoCol = headers.indexOf('ESTADO');
  var fechaEntregaCol = headers.indexOf('FECHA_ENTREGA');
  var cotizIdCol = headers.indexOf('COTIZACION_ID');
  var clienteCol = headers.indexOf('CLIENTE_NOMBRE');
  if (estadoCol < 0 || fechaEntregaCol < 0 || cotizIdCol < 0) return [];
  var yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  var yesterdayStr = Utilities.formatDate(yesterday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var estado = data[i][estadoCol];
    var fechaEntrega = data[i][fechaEntregaCol];
    if (estado !== 'Confirmado' || !fechaEntrega) continue;
    var fe = new Date(fechaEntrega);
    fe.setHours(0, 0, 0, 0);
    var feStr = Utilities.formatDate(fe, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (feStr === yesterdayStr) {
      result.push({
        row: i + 1,
        cotizacionId: data[i][cotizIdCol],
        cliente: data[i][clienteCol] || ''
      });
    }
  }
  return result;
}

function showEntregasPendientesDialog() {
  var entregas = getEntregasFechaAyer();
  if (entregas.length === 0) {
    SpreadsheetApp.getUi().alert('No hay ventas con Fecha de entrega ayer para confirmar.');
    return;
  }
  var html = HtmlService.createTemplateFromFile('DialogEntregas');
  html.entregas = entregas;
  var dialog = html.evaluate().setWidth(520).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(dialog, 'Confirmar entregas (fecha ayer)');
}

/**
 * Llamado desde el diálogo: mueve las filas seleccionadas a Ventas realizadas y entregadas.
 * Procesa de abajo hacia arriba para no desalinear índices al borrar.
 * @param {Array<{cotizacionId: string, comentarios: string}>} seleccion
 */
function processEntregasConfirmadas(seleccion) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName('Master_Cotizaciones');
  if (!master || !seleccion || seleccion.length === 0) return;
  var data = master.getDataRange().getValues();
  var headers = data[0];
  var cotizIdCol = headers.indexOf('COTIZACION_ID');
  if (cotizIdCol < 0) return;
  var toMove = [];
  for (var s = 0; s < seleccion.length; s++) {
    var id = seleccion[s].cotizacionId;
    var comentarios = seleccion[s].comentarios || '';
    for (var i = 1; i < data.length; i++) {
      if (data[i][cotizIdCol] === id) {
        toMove.push({ row: i + 1, comentarios: comentarios });
        break;
      }
    }
  }
  toMove.sort(function (a, b) { return b.row - a.row; });
  for (var j = 0; j < toMove.length; j++) {
    moveRowToVentasEntregadas(toMove[j].row, toMove[j].comentarios);
  }
  SpreadsheetApp.getUi().alert('Listo: ' + toMove.length + ' venta(s) pasada(s) a Ventas realizadas y entregadas.');
}

/** Migrate the two records from rows 15 and 17 (old sheet) into Master_Cotizaciones rows 2 and 3. */
function migrateTwoRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = ss.getSheetByName('Master_Cotizaciones');
  if (!master) {
    Logger.log('Run runInitialSetup() first.');
    return;
  }
  const data = [
    ['COT-20260314-001', '2026-03-13', '2026-03-13', '', 'Agustín Arbiza', '091 525 356', '', 'Sin Flete', '', 'Confirmado', '2026-03-13', '2026-03-13', '', 'Email', '', '', 'Isopanel EPS 100mm / Ver Planos (tabiquería y cielorrazo) / quiere presupuesto hor', '', 'system_migration', 'system_migration', 1],
    ['COT-20260314-002', '2026-03-12', '2026-03-12', '', 'UAM - Actualización', 'vvedores@uam.com', '', 'Envio a UAM - Paso de la Arena', '', 'Confirmado', '2026-03-12', '2026-03-12', '', 'Email', '', '', 'Actualizar a isopanel EPs 100mm + accesorios anteriores y anclajes y sellador', '', 'system_migration', 'system_migration', 1]
  ];
  data.forEach(function (row, i) {
    master.getRange(2 + i, 1, 2 + i, row.length).setValues([row]);
  });
  Logger.log('Migrated 2 records to Master_Cotizaciones.');
}

// ─── Phase 2: Automation ─────────────────────────────────────────────────
function autoUpdateQuotationStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Master_Cotizaciones');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const estadoCol = headers.indexOf('ESTADO');
  const fechaEnvioCol = headers.indexOf('FECHA_ENVIO');
  const cotizIdCol = headers.indexOf('COTIZACION_ID');
  const today = new Date();
  let updateCount = 0;
  for (var i = 1; i < data.length; i++) {
    var estado = data[i][estadoCol];
    var fechaEnvio = data[i][fechaEnvioCol];
    var cotizId = data[i][cotizIdCol];
    if (!cotizId || cotizId === '') continue;
    if (estado === 'Enviado' && fechaEnvio) {
      var daysSince = Math.floor((today - new Date(fechaEnvio)) / (1000 * 60 * 60 * 24));
      if (daysSince > 5) {
        sheet.getRange(i + 1, estadoCol + 1).setValue('Pendiente');
        logChange('Auto-Status', i + 1, estado, 'Pendiente', 'Auto-transition 5 days');
        updateCount++;
      }
    }
  }
  Logger.log('Auto-updated ' + updateCount + ' quotations');
}

function sendQuotationAlerts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Master_Cotizaciones');
  const equipoSheet = ss.getSheetByName('EQUIPOS');
  if (!sheet || !equipoSheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const clienteCol = headers.indexOf('CLIENTE_NOMBRE');
  const estadoCol = headers.indexOf('ESTADO');
  const asignadoCol = headers.indexOf('ASIGNADO_A');
  const fechaEnvioCol = headers.indexOf('FECHA_ENVIO');
  const cotizIdCol = headers.indexOf('COTIZACION_ID');
  const alertsByUser = {};
  const today = new Date();
  for (var i = 1; i < data.length; i++) {
    var estado = data[i][estadoCol];
    var asignado = data[i][asignadoCol];
    var fechaEnvio = data[i][fechaEnvioCol];
    var cliente = data[i][clienteCol];
    var cotizId = data[i][cotizIdCol];
    if (!asignado || !cliente || !cotizId) continue;
    var shouldAlert = false;
    var razon = '';
    var urgencia = 'warning';
    if (estado === 'Borrador') {
      shouldAlert = true;
      razon = 'Not sent yet';
    } else if (estado === 'Enviado' && fechaEnvio) {
      var days = Math.floor((today - new Date(fechaEnvio)) / (1000 * 60 * 60 * 24));
      if (days >= 7) {
        shouldAlert = true;
        razon = 'Sent ' + days + ' days ago';
        urgencia = days >= 14 ? 'critical' : 'warning';
      }
    } else if (estado === 'Pendiente') {
      shouldAlert = true;
      razon = 'Pending';
      urgencia = 'warning';
    }
    if (shouldAlert) {
      if (!alertsByUser[asignado]) alertsByUser[asignado] = [];
      alertsByUser[asignado].push({
        cotizId: cotizId,
        cliente: cliente,
        estado: estado,
        razon: razon,
        urgencia: urgencia
      });
    }
  }
  for (var usuario in alertsByUser) {
    var email = getEmailFromEquipo(usuario);
    if (email) {
      sendAlertEmail(email, usuario, alertsByUser[usuario]);
    }
  }
}

function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Master_Cotizaciones') return;
  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();
  var newValue = range.getValue();
  var oldValue = (e.oldValue !== undefined && e.oldValue !== null) ? e.oldValue : '';
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var columnName = headers[col - 1];
  logChange('Manual Edit', row, oldValue, newValue, 'User edited ' + columnName);
  if (columnName === 'ESTADO') {
    if (newValue === 'Entregado') {
      moveRowToVentasEntregadas(row);
      return;
    }
    syncCotizacionToVentas(row, newValue);
  }
  if (columnName === 'ASIGNADO_A' && newValue && newValue !== '') {
    notifyUserAssignment(newValue, row);
  }
  var actualizacionCol = headers.indexOf('FECHA_ACTUALIZACION') + 1;
  if (actualizacionCol > 0) {
    sheet.getRange(row, actualizacionCol).setValue(new Date());
  }
}

function logChange(action, row, oldValue, newValue, reason) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheet = ss.getSheetByName('AUDIT_LOG');
  if (!logSheet) {
    logSheet = ss.insertSheet('AUDIT_LOG');
    logSheet.appendRow(['TIMESTAMP', 'ACTION', 'ROW', 'OLD_VALUE', 'NEW_VALUE', 'REASON', 'USER', 'SHEET']);
  }
  logSheet.appendRow([
    new Date(),
    action,
    row,
    String(oldValue),
    String(newValue),
    reason,
    Session.getEffectiveUser().getEmail(),
    'Master_Cotizaciones'
  ]);
}

function getEmailFromEquipo(usuario) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var equipoSheet = ss.getSheetByName('EQUIPOS');
  if (!equipoSheet) return null;
  var data = equipoSheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === usuario) {
      return data[i][1];
    }
  }
  return null;
}

function sendAlertEmail(email, usuario, alerts) {
  var critical = alerts.filter(function (a) { return a.urgencia === 'critical'; });
  var warnings = alerts.filter(function (a) { return a.urgencia === 'warning'; });
  var subject = 'BMC Alerts - ' + critical.length + ' critical, ' + warnings.length + ' warnings';
  var body = 'Hola ' + usuario + ',\n\nTienes ' + alerts.length + ' cotizaciones:\n\n';
  if (critical.length > 0) {
    body += 'CRITICO:\n';
    critical.forEach(function (a) {
      body += '  • ' + a.cotizId + ' - ' + a.cliente + '\n';
      body += '    ' + a.estado + ' | ' + a.razon + '\n';
    });
    body += '\n';
  }
  if (warnings.length > 0) {
    body += 'ADVERTENCIA:\n';
    warnings.forEach(function (a) {
      body += '  • ' + a.cotizId + ' - ' + a.cliente + '\n';
      body += '    ' + a.estado + ' | ' + a.razon + '\n';
    });
  }
  body += '\nDashboard: http://localhost:3847/viewer/\n\nSistema BMC.';
  try {
    GmailApp.sendEmail(email, subject, body);
  } catch (e) {
    Logger.log('Error sendAlertEmail: ' + e);
  }
}

function syncCotizacionToVentas(cotizacionRow, nuevoEstado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cotizSheet = ss.getSheetByName('Master_Cotizaciones');
  var ventasSheet = ss.getSheetByName('2.0 - Ventas');
  if (!ventasSheet || !cotizSheet) return;
  var cotizacionId = cotizSheet.getRange(cotizacionRow, 1).getValue();
  var ventasData = ventasSheet.getDataRange().getValues();
  var ventasHeaders = ventasData[0];
  var estadoColVentas = ventasHeaders.indexOf('ESTADO_GRAL_DE_VENTA');
  if (estadoColVentas === -1) return;
  for (var i = 1; i < ventasData.length; i++) {
    if (ventasData[i][0] === cotizacionId) {
      ventasSheet.getRange(i + 1, estadoColVentas + 1).setValue(nuevoEstado);
      logChange('Sync', i + 1, '', nuevoEstado, 'Synced from Master_Cotizaciones');
      break;
    }
  }
}

/**
 * Mueve una fila de Master_Cotizaciones a Ventas realizadas y entregadas.
 * Se usa cuando ESTADO = Entregado (manual o desde el diálogo de confirmación).
 */
function moveRowToVentasEntregadas(masterRow, comentariosEntregas) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var master = ss.getSheetByName('Master_Cotizaciones');
  var dest = ss.getSheetByName('Ventas realizadas y entregadas');
  if (!master || !dest) return;
  var rowData = master.getRange(masterRow, 1, masterRow, master.getLastColumn()).getValues()[0];
  var headers = master.getRange(1, 1, 1, master.getLastColumn()).getValues()[0];
  var diasPendienteIdx = headers.indexOf('DIAS_PENDIENTE');
  var comentariosIdx = headers.indexOf('COMENTARIOS_ENTREGA');
  if (comentariosEntregas !== undefined && comentariosEntregas !== null && comentariosIdx >= 0) {
    rowData[comentariosIdx] = comentariosEntregas;
  }
  var destHeaders = dest.getRange(1, 1, 1, dest.getLastColumn()).getValues()[0];
  var idxEntregaReal = destHeaders.indexOf('FECHA_ENTREGA_REAL');
  var destRow = rowData.slice();
  if (idxEntregaReal >= 0) destRow[idxEntregaReal] = new Date();
  dest.appendRow(destRow);
  master.deleteRow(masterRow);
  logChange('Move to Entregadas', masterRow, 'Master_Cotizaciones', 'Ventas realizadas y entregadas', 'Confirmado entregado');
}

function notifyUserAssignment(usuario, row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Master_Cotizaciones');
  var rowData = sheet.getRange(row, 1, row, sheet.getLastColumn()).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var clienteIdx = headers.indexOf('CLIENTE_NOMBRE');
  var cotizIdIdx = headers.indexOf('COTIZACION_ID');
  var cliente = rowData[clienteIdx];
  var cotizId = rowData[cotizIdIdx];
  var email = getEmailFromEquipo(usuario);
  if (email) {
    var subject = 'Nueva tarea: ' + cotizId + ' - ' + cliente;
    var body = 'Hola ' + usuario + ',\n\nNueva tarea:\n\nCotización: ' + cotizId + '\nCliente: ' + cliente + '\n\nDashboard: http://localhost:3847/viewer/';
    try {
      GmailApp.sendEmail(email, subject, body);
    } catch (e) {
      Logger.log('Error notifyUserAssignment: ' + e);
    }
  }
}

// ─── Financial KPI: pagos pendientes y metas ─────────────────────────────
/**
 * Obtiene filas de Pagos_Pendientes con ESTADO_PAGO = Pendiente (o vacío).
 */
function getPagosPendientes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pagos_Pendientes');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var estadoCol = headers.indexOf('ESTADO_PAGO');
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var estado = (data[i][estadoCol] || '').toString().trim();
    if (estado === '' || estado.toLowerCase() === 'pendiente') {
      var row = {};
      headers.forEach(function (h, j) { row[h] = data[i][j]; });
      result.push(row);
    }
  }
  return result;
}

/**
 * Obtiene filas de Metas_Ventas.
 */
function getMetasVentas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Metas_Ventas');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function (h, j) { row[h] = data[i][j]; });
    result.push(row);
  }
  return result;
}

/**
 * Agrupa montos pendientes por fecha de vencimiento y por periodo (esta semana, próxima, este mes).
 */
function getResumenPagosPorPeriodo(pagos) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var startWeek = getStartOfWeek(today);
  var endWeek = new Date(startWeek);
  endWeek.setDate(endWeek.getDate() + 6);
  endWeek.setHours(23, 59, 59, 999);
  var nextWeekStart = new Date(endWeek);
  nextWeekStart.setDate(nextWeekStart.getDate() + 1);
  var nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
  nextWeekEnd.setHours(23, 59, 59, 999);
  var endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  var byDate = {};
  var estaSemana = 0;
  var proximaSemana = 0;
  var esteMes = 0;
  var total = 0;
  for (var i = 0; i < pagos.length; i++) {
    var monto = parseFloat(pagos[i].MONTO) || 0;
    var moneda = pagos[i].MONEDA || '$';
    var key = moneda;
    var vencio = null;
    if (pagos[i].FECHA_VENCIMIENTO) {
      vencio = new Date(pagos[i].FECHA_VENCIMIENTO);
      vencio.setHours(0, 0, 0, 0);
      var dateStr = Utilities.formatDate(vencio, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      if (!byDate[dateStr]) byDate[dateStr] = { $: 0, UES: 0 };
      byDate[dateStr][key] = (byDate[dateStr][key] || 0) + monto;
    }
    total += monto;
    if (vencio) {
      var t = vencio.getTime();
      if (t >= startWeek.getTime() && t <= endWeek.getTime()) estaSemana += monto;
      else if (t >= nextWeekStart.getTime() && t <= nextWeekEnd.getTime()) proximaSemana += monto;
      if (t <= endMonth.getTime()) esteMes += monto;
    } else {
      esteMes += monto;
    }
  }
  return {
    byDate: byDate,
    estaSemana: estaSemana,
    proximaSemana: proximaSemana,
    esteMes: esteMes,
    total: total
  };
}

function getStartOfWeek(d) {
  var date = new Date(d);
  var day = date.getDay();
  var diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Envía el reporte de pagos pendientes y metas (Lunes, Jueves, Viernes).
 * Configurar triggers: time-driven, día de la semana Lunes/Jueves/Viernes, 8:00–9:00.
 */
function sendPendingPaymentsUpdate() {
  var pagos = getPagosPendientes();
  var metas = getMetasVentas();
  var resumen = getResumenPagosPorPeriodo(pagos);
  var equipoSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('EQUIPOS');
  var emails = [];
  if (equipoSheet) {
    var data = equipoSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][1]) emails.push(data[i][1]);
    }
  }
  if (emails.length === 0) {
    Logger.log('No hay emails en EQUIPOS para enviar reporte.');
    return;
  }
  var subject = 'BMC — Resumen pagos pendientes y metas (' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy') + ')';
  var body = 'Resumen financiero — Pagos pendientes y metas de ventas\n\n';
  body += '═══ PAGOS PENDIENTES ═══\n\n';
  body += 'Total pendiente: $' + resumen.total.toFixed(2) + '\n';
  body += '  • Esta semana: $' + resumen.estaSemana.toFixed(2) + '\n';
  body += '  • Próxima semana: $' + resumen.proximaSemana.toFixed(2) + '\n';
  body += '  • Este mes: $' + resumen.esteMes.toFixed(2) + '\n\n';
  body += 'Por fecha de vencimiento:\n';
  var dates = Object.keys(resumen.byDate).sort();
  for (var d = 0; d < dates.length; d++) {
    var dayTotal = (resumen.byDate[dates[d]].$ || 0) + (resumen.byDate[dates[d]].UES || 0);
    body += '  ' + dates[d] + ': $' + dayTotal.toFixed(2) + '\n';
  }
  body += '\nDetalle (todos los pendientes):\n';
  for (var p = 0; p < pagos.length; p++) {
    body += '  • ' + (pagos[p].CLIENTE_NOMBRE || '—') + ' | ' + (pagos[p].FECHA_VENCIMIENTO ? Utilities.formatDate(new Date(pagos[p].FECHA_VENCIMIENTO), Session.getScriptTimeZone(), 'dd/MM/yyyy') : '—') + ' | ' + (pagos[p].MONEDA || '$') + ' ' + (pagos[p].MONTO || '0') + ' | ' + (pagos[p].COTIZACION_ID || '') + '\n';
  }
  body += '\n═══ METAS DE VENTAS ═══\n\n';
  for (var m = 0; m < metas.length; m++) {
    body += '  • ' + (metas[m].PERIODO || '—') + ' (' + (metas[m].TIPO || '') + '): ' + (metas[m].MONEDA || '$') + ' ' + (metas[m].META_MONTO || '0') + (metas[m].NOTAS ? ' — ' + metas[m].NOTAS : '') + '\n';
  }
  body += '\nDashboard: abrir el panel de KPIs financieros para ver el calendario de vencimientos.\n\nSistema BMC.';
  try {
    for (var e = 0; e < emails.length; e++) {
      GmailApp.sendEmail(emails[e], subject, body);
    }
  } catch (err) {
    Logger.log('Error sendPendingPaymentsUpdate: ' + err);
  }
}

// ─── Weekly alarm digest (cross-workbook) ────────────────────────────────

/**
 * Obtiene todos los emails de la tab EQUIPOS (workbook 1).
 * Usado como fuente centralizada de destinatarios.
 */
function getAllEquipoEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EQUIPOS');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1)
    .map(function(r) { return String(r[1] || '').trim(); })
    .filter(function(e) { return e && e.indexOf('@') > -1; });
}

/**
 * Obtiene pagos vencidos del workbook Pagos Pendientes (Pendientes_ tab).
 */
function _getPagosVencidosExternal() {
  var pagoId = PropertiesService.getScriptProperties().getProperty('PAGOS_SHEET_ID');
  if (!pagoId) return [];
  try {
    var ss = SpreadsheetApp.openById(pagoId);
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0].map(function(h) { return String(h || '').trim(); });
    var fechaCol = headers.findIndex(function(h) { return /^FECHA$|^Fecha$|^PLAZO$/i.test(h); });
    var estadoCol = headers.findIndex(function(h) { return /^ESTADO$/i.test(h); });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var vencidos = [];
    for (var i = 1; i < data.length; i++) {
      var estado = estadoCol >= 0 ? String(data[i][estadoCol] || '').toLowerCase() : '';
      if (estado === 'cobrado') continue;
      var fv = fechaCol >= 0 ? new Date(data[i][fechaCol]) : null;
      if (fv && !isNaN(fv.getTime()) && fv < today) vencidos.push(data[i]);
    }
    return vencidos;
  } catch (e) {
    Logger.log('_getPagosVencidosExternal error: ' + e);
    return [];
  }
}

/**
 * Obtiene ventas sin facturar del workbook Ventas (Ventas_Consolidado tab).
 */
function _getVentasSinFacturarExternal() {
  var ventasId = PropertiesService.getScriptProperties().getProperty('VENTAS_SHEET_ID');
  if (!ventasId) return [];
  try {
    var ss = SpreadsheetApp.openById(ventasId);
    var sheet = ss.getSheetByName('Ventas_Consolidado');
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = data[0].map(function(h) { return String(h || '').trim(); });
    var facturadoIdx = headers.indexOf('FACTURADO');
    var sinFact = [];
    for (var i = 1; i < data.length; i++) {
      var f = facturadoIdx >= 0 ? String(data[i][facturadoIdx] || '').trim() : '';
      if (!f || f.toLowerCase() === 'no') sinFact.push(data[i]);
    }
    return sinFact;
  } catch (e) {
    Logger.log('_getVentasSinFacturarExternal error: ' + e);
    return [];
  }
}

/**
 * Obtiene productos con bajo stock del workbook Stock (tab principal).
 */
function _getBajoStockExternal() {
  var stockId = PropertiesService.getScriptProperties().getProperty('STOCK_SHEET_ID');
  if (!stockId) return [];
  try {
    var ss = SpreadsheetApp.openById(stockId);
    var sheet = ss.getSheets()[0];
    var data = sheet.getDataRange().getValues();
    if (data.length < 4) return [];
    var headers = data[2].map(function(h) { return String(h || '').trim(); });
    var stockCol = headers.findIndex(function(h) { return /^Stock$/i.test(h); });
    var productoCol = headers.findIndex(function(h) { return /^Producto$/i.test(h); });
    if (stockCol < 0) return [];
    var bajo = [];
    for (var i = 3; i < data.length; i++) {
      var prod = productoCol >= 0 ? String(data[i][productoCol] || '').trim() : '';
      if (!prod) continue;
      var stock = parseFloat(data[i][stockCol]);
      if (!isNaN(stock) && stock >= 0 && stock < 5) bajo.push({ producto: prod, stock: stock });
    }
    return bajo;
  } catch (e) {
    Logger.log('_getBajoStockExternal error: ' + e);
    return [];
  }
}

/**
 * Obtiene vencimientos de esta semana del workbook Calendario.
 */
function _getVencimientosSemanaExternal() {
  var calId = PropertiesService.getScriptProperties().getProperty('CALENDARIO_SHEET_ID');
  if (!calId) return [];
  try {
    var ss = SpreadsheetApp.openById(calId);
    var now = new Date();
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var MESES = {
      '01':'ENERO','02':'FEBRERO','03':'MARZO','04':'ABRIL','05':'MAYO','06':'JUNIO',
      '07':'JULIO','08':'AGOSTO','09':'SEPTIEMBRE','10':'OCTUBRE','11':'NOVIEMBRE','12':'DICIEMBRE'
    };
    var tabName = (MESES[mm] || '') + ' ' + now.getFullYear();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    var headers = (data[1] || data[0]).map(function(h) { return String(h || '').trim(); });
    var conceptoCol = headers.findIndex(function(h) { return /CONCEPTO/i.test(h); });
    var importeCol = headers.findIndex(function(h) { return /IMPORTE|NO PAGO/i.test(h); });
    var pagadoCol = headers.findIndex(function(h) { return /^PAGADO$/i.test(h); });
    var venc = [];
    var dataStart = data[1] ? 2 : 1;
    for (var i = dataStart; i < data.length; i++) {
      var concepto = conceptoCol >= 0 ? String(data[i][conceptoCol] || '').trim() : '';
      var importe = importeCol >= 0 ? parseFloat(data[i][importeCol]) : 0;
      var pagado = pagadoCol >= 0 ? String(data[i][pagadoCol] || '').toLowerCase() : '';
      if (concepto && importe > 0 && pagado !== 'sí' && pagado !== 'si') {
        venc.push({ concepto: concepto, importe: importe });
      }
    }
    return venc;
  } catch (e) {
    Logger.log('_getVencimientosSemanaExternal error: ' + e);
    return [];
  }
}

/**
 * Resumen semanal cross-workbook — envía un único email HTML con 5 secciones.
 * Trigger: time-driven, weekly, Monday 8:00 AM.
 * PropertiesService keys (configurar en Apps Script > Project Settings > Script properties):
 *   PAGOS_SHEET_ID, VENTAS_SHEET_ID, STOCK_SHEET_ID, CALENDARIO_SHEET_ID, DASHBOARD_URL
 */
function sendWeeklyAlarmDigest() {
  var pagosVencidos = _getPagosVencidosExternal();
  var ventasSinFact = _getVentasSinFacturarExternal();
  var bajoStock = _getBajoStockExternal();
  var vencimientosCal = _getVencimientosSemanaExternal();
  var pagosPendientes = getPagosPendientes();

  var totalAlarmas = pagosVencidos.length + ventasSinFact.length + bajoStock.length + vencimientosCal.length;
  var emails = getAllEquipoEmails();
  if (emails.length === 0) {
    Logger.log('sendWeeklyAlarmDigest: no hay emails en EQUIPOS.');
    return;
  }

  var fechaHoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var dashboardUrl = PropertiesService.getScriptProperties().getProperty('DASHBOARD_URL') || 'http://localhost:3847/finanzas';
  var subject = 'BMC — Resumen semanal: ' + totalAlarmas + ' alarmas (' + fechaHoy + ')';

  var html = '<h2 style="font-family:sans-serif">BMC — Resumen semanal ' + fechaHoy + '</h2>';
  html += '<p style="font-family:sans-serif;color:#666">Total alarmas: <strong>' + totalAlarmas + '</strong></p>';

  // Sección 1: Pagos vencidos
  html += '<h3 style="font-family:sans-serif;color:#c00">1. Pagos vencidos (' + pagosVencidos.length + ')</h3>';
  if (pagosVencidos.length > 0) {
    html += '<ul style="font-family:sans-serif">';
    pagosVencidos.forEach(function(r) { html += '<li>' + JSON.stringify(r).slice(0, 120) + '</li>'; });
    html += '</ul>';
  } else { html += '<p style="font-family:sans-serif;color:#090">Sin pagos vencidos ✓</p>'; }

  // Sección 2: Cotizaciones pendientes (de workbook 1)
  var cotizPendientes = pagosPendientes.filter(function(p) {
    return String(p.ESTADO_PAGO || '').toLowerCase() === 'pendiente';
  });
  html += '<h3 style="font-family:sans-serif;color:#c60">2. Cotizaciones/Pagos pendientes (' + cotizPendientes.length + ')</h3>';
  if (cotizPendientes.length > 0) {
    html += '<ul style="font-family:sans-serif">';
    cotizPendientes.slice(0, 10).forEach(function(p) {
      html += '<li>' + (p.CLIENTE_NOMBRE || '—') + ' | ' + (p.FECHA_VENCIMIENTO || '—') + ' | ' + (p.MONEDA || '$') + ' ' + (p.MONTO || 0) + '</li>';
    });
    if (cotizPendientes.length > 10) html += '<li>...y ' + (cotizPendientes.length - 10) + ' más</li>';
    html += '</ul>';
  } else { html += '<p style="font-family:sans-serif;color:#090">Sin pendientes ✓</p>'; }

  // Sección 3: Ventas sin facturar
  html += '<h3 style="font-family:sans-serif;color:#c60">3. Ventas sin facturar (' + ventasSinFact.length + ')</h3>';
  if (ventasSinFact.length > 0) {
    html += '<p style="font-family:sans-serif">' + ventasSinFact.length + ' ventas en Ventas_Consolidado sin número de factura.</p>';
  } else { html += '<p style="font-family:sans-serif;color:#090">Todas facturadas ✓</p>'; }

  // Sección 4: Bajo stock
  html += '<h3 style="font-family:sans-serif;color:#c60">4. Bajo stock (' + bajoStock.length + ')</h3>';
  if (bajoStock.length > 0) {
    html += '<ul style="font-family:sans-serif">';
    bajoStock.forEach(function(p) { html += '<li>' + p.producto + ' — stock: ' + p.stock + '</li>'; });
    html += '</ul>';
  } else { html += '<p style="font-family:sans-serif;color:#090">Stock OK ✓</p>'; }

  // Sección 5: Calendario vencimientos semana
  html += '<h3 style="font-family:sans-serif;color:#c60">5. Vencimientos Calendario esta semana (' + vencimientosCal.length + ')</h3>';
  if (vencimientosCal.length > 0) {
    html += '<ul style="font-family:sans-serif">';
    vencimientosCal.forEach(function(v) { html += '<li>' + v.concepto + ' — $ ' + v.importe + '</li>'; });
    html += '</ul>';
  } else { html += '<p style="font-family:sans-serif;color:#090">Sin vencimientos esta semana ✓</p>'; }

  html += '<hr><p style="font-family:sans-serif;font-size:12px;color:#999">Dashboard: <a href="' + dashboardUrl + '">' + dashboardUrl + '</a> · Sistema BMC</p>';

  emails.forEach(function(email) {
    try {
      GmailApp.sendEmail(email, subject, '', { htmlBody: html });
    } catch (err) {
      Logger.log('sendWeeklyAlarmDigest error email ' + email + ': ' + err);
    }
  });

  Logger.log('sendWeeklyAlarmDigest: enviado a ' + emails.length + ' destinatarios, ' + totalAlarmas + ' alarmas.');
}
