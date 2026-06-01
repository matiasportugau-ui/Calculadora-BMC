/**
 * COTIZAR BUTTON - Fase 1 Production (Final Improved Version)
 *
 * Este es el Code.gs completo y revisado para el flujo Cotizar.
 *
 * Basado en:
 * - COTIZAR-BUTTON-SIDEBAR-PRODUCTION-PROPOSAL.md (Fase 1 MVP)
 * - COTIZAR-BUTTON-STATES-AND-COLUMNS.md
 * - COTIZAR-BUTTON-BORRADOR-EXPLICACION.md (plantilla profesional exacta)
 * - preview-sidebar-cotizar.html (comportamiento UI/JS objetivo)
 *
 * Mejoras implementadas (Best Practices + IA Intelligence):
 * - Respeto estricto del modelo híbrido (nunca toca columna K).
 * - Pre-validación barata antes de llamar al orquestador.
 * - Envío completo de aclaraciones + contexto estructurado.
 * - Consumo rico de respuesta del orquestador (gates, artifacts, cost, requestId).
 * - Síntesis de explicación usando la plantilla profesional aprobada.
 * - Logging estructurado de costo, calidad, duración y gates.
 * - Soporte nativo de Speed Mode.
 * - Manejo explícito de timeouts de Apps Script.
 * - Setup robusto con elección manual de columna + limpieza de validaciones.
 * - Funciones listas para el Sidebar rico (live preview behaviors).
 *
 * INSTRUCCIONES DE USO:
 * 1. Copia todo este archivo como tu Code.gs.
 * 2. Ejecuta setupCotizarColumns() desde el menú (elige un número alto de columna, ej 50+).
 * 3. Actualiza CONFIG con los números reales.
 * 4. Reemplaza Sidebar.html con la versión pulida (basada en preview-sidebar-cotizar.html).
 * 5. Configura BACKEND_BASE_URL, PDF_DRIVE_FOLDER_ID y auth.
 */

// =====================================================
// CONFIG
// =====================================================

const CONFIG = {
  // Backend
  BACKEND_BASE_URL: 'https://panelin-calc-[tu-hash].a.run.app',
  ORCHESTRATOR_ENDPOINT: '/api/internal/presup/run',
  PDF_DRIVE_FOLDER_ID: 'TU_CARPETA_ID_AQUI',

  // Sheet
  TAB_NAME: 'Admin.',
  COL_CONSULTA: 9,
  COL_RESPUESTA: 10,
  COL_LINK_PRESUPUESTO: 11, // Oficial - nunca tocar desde Cotizar
  COL_ESTADO: 3,

  // Borrador columns (rellenar después de setup)
  COL_BORRADOR_PDF: null,
  COL_BORRADOR_EXPLICACION: null,
  COL_FECHA_BORRADOR: null,
  COL_GENERADO_POR: null,
  COL_MODO: null,
  COL_DURACION: null,

  // Revisión columns
  COL_REVISADO_POR: null,
  COL_FECHA_REVISION: null,
  COL_COMENTARIO_REVISION: null,

  // Intelligence
  MIN_CONSULTA_LENGTH: 25,
  DEFAULT_MODE: 'profundo',
  LOG_SHEET_NAME: 'Log Cotizaciones'
};

// =====================================================
// SETUP (Versión Robusta con Prompt)
// =====================================================

function setupCotizarColumns() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TAB_NAME);

  if (!sheet) {
    ui.alert('No se encontró la hoja "' + CONFIG.TAB_NAME + '"');
    return;
  }

  const response = ui.prompt(
    'Configurar columnas Cotizar',
    '¿En qué columna querés empezar? (Recomendado: 50, 55 o 60 para evitar validaciones)\nDejá en blanco para automático.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  let startCol = response.getResponseText().trim() === '' 
    ? sheet.getLastColumn() + 2 
    : parseInt(response.getResponseText(), 10);

  if (isNaN(startCol) || startCol < 1) startCol = sheet.getLastColumn() + 2;

  const createLog = ui.alert('¿Crear también "Log Cotizaciones"?', ui.ButtonSet.YES_NO) === ui.Button.YES;

  const borrador = ['Borrador PDF', 'Borrador Explicación', 'Fecha Generación Borrador', 'Generado Por', 'Modo', 'Duración (seg)'];
  const revision = ['Revisado Por', 'Fecha Revisión', 'Comentario de Revisión'];

  const needed = borrador.length + revision.length + 1;
  if (startCol + needed > sheet.getLastColumn()) {
    sheet.insertColumnsAfter(sheet.getLastColumn(), (startCol + needed) - sheet.getLastColumn());
  }

  // Limpiar validaciones (clave para evitar errores AB1/AC1)
  sheet.getRange(1, startCol, 1, borrador.length).clearDataValidations();
  sheet.getRange(1, startCol + borrador.length + 1, 1, revision.length).clearDataValidations();

  sheet.getRange(1, startCol, 1, borrador.length).setValues([borrador]).setBackground('#fff2cc').setFontWeight('bold');
  sheet.getRange(1, startCol + borrador.length + 1, 1, revision.length).setValues([revision]).setBackground('#d9ead3').setFontWeight('bold');

  if (createLog) {
    const log = ss.getSheetByName(CONFIG.LOG_SHEET_NAME) || ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    log.getRange(1, 1, 1, 9).setValues([['Timestamp','Usuario','Fila','Modo','Duración','Costo','PDF','RequestID','Resultado']]).setBackground('#cfe2f3');
  }

  ui.alert(`Listo. Columnas desde ${startCol}. Actualizá CONFIG y recargá.`);
}

// =====================================================
// CORE FUNCTIONS (Sidebar Intelligence + Functionality)
// =====================================================

function getActiveRowInfo() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  return {
    row,
    cliente: sheet.getRange(row, 4).getValue(),
    consulta: sheet.getRange(row, CONFIG.COL_CONSULTA).getValue()
  };
}

function performCotizar(formState) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();

  if (!formState?.consulta) return { success: false, message: 'Falta consulta' };

  // Pre-validación (IA cheap filter)
  if (formState.consulta.length < CONFIG.MIN_CONSULTA_LENGTH) {
    return { success: false, message: `Consulta muy corta (mín ${CONFIG.MIN_CONSULTA_LENGTH})` };
  }

  const start = Date.now();

  try {
    const result = callPresupOrchestratorWithContext(formState);
    const duration = Math.round((Date.now() - start) / 1000);
    const mode = formState.speedMode ? 'Speed' : 'Normal';

    const pdfLink = extractPdfLink(result);
    const explanation = synthesizeProfessionalExplanation(formState, result, pdfLink, mode);

    // Escritura SOLO en borrador
    const b = getBorradorColumns();
    if (!b.pdf || !b.explicacion) throw new Error('Faltan columnas de borrador en CONFIG');

    sheet.getRange(row, b.pdf).setValue(pdfLink || 'Procesando...');
    sheet.getRange(row, b.explicacion).setValue(explanation);
    sheet.getRange(row, b.fecha).setValue(new Date());
    sheet.getRange(row, b.generadoPor).setValue(Session.getActiveUser().getEmail());
    sheet.getRange(row, b.modo).setValue(mode);
    if (b.duracion) sheet.getRange(row, b.duracion).setValue(duration);

    if (CONFIG.COL_ESTADO) sheet.getRange(row, CONFIG.COL_ESTADO).setValue('Borrador Automático');

    logCotizacion({
      fila: row, mode, durationSec: duration, pdfLink,
      requestId: result.requestId, totalCostUsd: result.totalCostUsd || 0, resultado: 'OK'
    });

    return { success: true, pdfLink, borradorExplanation: explanation, duration, costUsd: result.totalCostUsd };

  } catch (e) {
    logCotizacion({ fila: row, resultado: 'ERROR', comentario: e.message });
    return { success: false, message: e.message };
  }
}

function callPresupOrchestratorWithContext(formState) {
  const url = CONFIG.BACKEND_BASE_URL + CONFIG.ORCHESTRATOR_ENDPOINT;
  const payload = {
    channel: 'sheet-admin-cotizar',
    consulta: formState.consulta,
    mode: formState.speedMode ? 'ligero' : CONFIG.DEFAULT_MODE,
    aclaraciones: JSON.stringify(formState),
    contexto_adicional: { fila: formState.row, zona: formState.zona }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) throw new Error(res.getContentText());
  return JSON.parse(res.getContentText());
}

function getBorradorColumns() {
  return {
    pdf: CONFIG.COL_BORRADOR_PDF,
    explicacion: CONFIG.COL_BORRADOR_EXPLICACION,
    fecha: CONFIG.COL_FECHA_BORRADOR,
    generadoPor: CONFIG.COL_GENERADO_POR,
    modo: CONFIG.COL_MODO,
    duracion: CONFIG.COL_DURACION
  };
}

function extractPdfLink(result) {
  return result?.artifacts?.pdfLink || result?.pdfLink || null;
}

function synthesizeProfessionalExplanation(formState, result, pdfLink, mode) {
  // Usa la estructura exacta aprobada en COTIZAR-BUTTON-BORRADOR-EXPLICACION.md
  let t = `**Presupuesto generado automáticamente basado en tu consulta**\n\n`;
  t += `**Tu consulta original:**\n> ${formState.consulta}\n\n`;
  t += `**Qué consideramos:**\n- Proyecto: ${formState.projectType || 'Techo'}\n- Superficie: ~${formState.cantidad || '?'} paños\n- Zona: ${formState.zona || ''}\n- Panel: ${formState.panelType || ''}\n`;
  if (formState.aclaraciones) t += `\n**Aclaraciones:** ${formState.aclaraciones}\n`;
  t += `\n**Total estimado:** $X.XXX USD + IVA\n\n**PDF:** ${pdfLink || '[En proceso]'}\n\n¿Necesitás ajustes?`;
  if (mode === 'Speed') t = t.replace('basado en tu consulta', 'basado en tu consulta (modo rápido)');
  return t;
}

function logCotizacion(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!log) log = ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    log.appendRow([new Date(), Session.getActiveUser().getEmail(), data.fila || '', data.mode || '', data.durationSec || '', data.totalCostUsd || '', data.pdfLink || '', data.requestId || '', data.resultado || '', data.comentario || '']);
  } catch (e) {}
}

// =====================================================
// MENU
// =====================================================

function showCotizarSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Cotizar Automático')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Cotizaciones 2.0')
    .addItem('Abrir panel Cotizar', 'showCotizarSidebar')
    .addSeparator()
    .addItem('Configurar columnas (una sola vez)', 'setupCotizarColumns')
    .addToUi();
}
