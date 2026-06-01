/**
 * COTIZAR BUTTON - Fase 1 Final (Production Ready)
 * 
 * Para la planilla "2.0 - Administrador de Cotizaciones"
 * 
 * MODELO: Híbrido Backoffice (Borrador Automático → Revisión Humana → Aprobado Oficial)
 * - Nunca escribe en columna K (oficial) desde el botón.
 * - Usa toda la inteligencia del presupOrchestrator.
 * - Capa de "IA Intelligence" en Apps Script: pre-validación, contexto rico, síntesis profesional, logging de costo/calidad.
 * 
 * INSTRUCCIONES:
 * 1. Ejecuta primero "Configurar columnas (MODO SEGURO)" desde el menú.
 * 2. Actualiza el CONFIG con los números reales de columna.
 * 3. Configura BACKEND_BASE_URL y PDF_DRIVE_FOLDER_ID.
 * 4. Reemplaza Sidebar.html por la versión final rica.
 */

// =====================================================
// CONFIG
// =====================================================

const CONFIG = {
  // Backend
  BACKEND_BASE_URL: 'https://panelin-calc-[tu-hash].a.run.app',
  ORCHESTRATOR_ENDPOINT: '/api/internal/presup/run',
  PDF_DRIVE_FOLDER_ID: 'TU_CARPETA_ID_AQUI',

  // Hoja
  TAB_NAME: 'Admin.',
  COL_CONSULTA: 9,
  COL_RESPUESTA: 10,
  COL_LINK_PRESUPUESTO: 11, // SOLO oficial
  COL_ESTADO: 3,

  // Columnas de Borrador y Revisión (rellenar después del setup)
  COL_BORRADOR_PDF: null,
  COL_BORRADOR_EXPLICACION: null,
  COL_FECHA_BORRADOR: null,
  COL_GENERADO_POR: null,
  COL_MODO: null,
  COL_DURACION: null,
  COL_REVISADO_POR: null,
  COL_FECHA_REVISION: null,
  COL_COMENTARIO_REVISION: null,

  // Inteligencia
  MIN_CONSULTA_LENGTH: 25,
  DEFAULT_MODE: 'profundo',
  LOG_SHEET_NAME: 'Log Cotizaciones'
};

// =====================================================
// SETUP (Modo Seguro - recomendado para hojas grandes)
// =====================================================

function writeCotizarHeadersSafe() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TAB_NAME);

  if (!sheet) {
    ui.alert('Hoja no encontrada.');
    return;
  }

  const startColStr = ui.prompt(
    'Escribir encabezados Cotizar (Modo Seguro)',
    '¿En qué columna empezamos? (Ej: 60)',
    ui.ButtonSet.OK_CANCEL
  );

  if (startColStr.getSelectedButton() !== ui.Button.OK) return;

  const startCol = parseInt(startColStr.getResponseText(), 10);
  if (isNaN(startCol) || startCol < 1) {
    ui.alert('Número inválido.');
    return;
  }

  const borrador = ['Borrador PDF', 'Borrador Explicación', 'Fecha Generación Borrador', 'Generado Por', 'Modo', 'Duración (seg)'];
  const revision = ['Revisado Por', 'Fecha Revisión', 'Comentario de Revisión'];

  try {
    const r1 = sheet.getRange(1, startCol, 1, borrador.length);
    r1.setValues([borrador]).setBackground('#fff2cc').setFontWeight('bold').setHorizontalAlignment('center');

    const r2 = sheet.getRange(1, startCol + borrador.length + 1, 1, revision.length);
    r2.setValues([revision]).setBackground('#d9ead3').setFontWeight('bold').setHorizontalAlignment('center');

    ui.alert(`Encabezados escritos desde columna ${startCol}.\nActualizá CONFIG.`);
  } catch (e) {
    ui.alert('Error: ' + e.message);
  }
}

// =====================================================
// FUNCIONES PRINCIPALES (con inteligencia)
// =====================================================

function getActiveRowInfo() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();
  return {
    row: row,
    cliente: sheet.getRange(row, 4).getValue(),
    consulta: sheet.getRange(row, CONFIG.COL_CONSULTA).getValue()
  };
}

function performCotizar(formState) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();

  if (!formState?.consulta) {
    return { success: false, message: 'Falta la consulta' };
  }

  // Pre-validación barata (IA Intelligence)
  if (formState.consulta.length < CONFIG.MIN_CONSULTA_LENGTH) {
    return { success: false, message: `Consulta muy corta (mínimo ${CONFIG.MIN_CONSULTA_LENGTH} caracteres)` };
  }

  const startTime = Date.now();

  try {
    const result = callPresupOrchestratorWithContext(formState);
    const duration = Math.round((Date.now() - startTime) / 1000);
    const mode = formState.speedMode ? 'Speed' : 'Normal';

    const pdfLink = extractPdfLink(result);
    const explanation = synthesizeProfessionalExplanation(formState, result, pdfLink, mode);

    // Escritura SOLO en columnas de Borrador (modelo híbrido)
    const b = getBorradorColumns();
    if (!b.pdf || !b.explicacion) {
      throw new Error('Faltan columnas de borrador en CONFIG. Ejecutá primero el setup.');
    }

    sheet.getRange(row, b.pdf).setValue(pdfLink || 'Procesando...');
    sheet.getRange(row, b.explicacion).setValue(explanation);
    sheet.getRange(row, b.fecha).setValue(new Date());
    sheet.getRange(row, b.generadoPor).setValue(Session.getActiveUser().getEmail());
    sheet.getRange(row, b.modo).setValue(mode);
    if (b.duracion) sheet.getRange(row, b.duracion).setValue(duration);

    if (CONFIG.COL_ESTADO) {
      sheet.getRange(row, CONFIG.COL_ESTADO).setValue('Borrador Automático');
    }

    // Logging estructurado
    logCotizacion({
      fila: row,
      mode: mode,
      durationSec: duration,
      pdfLink: pdfLink,
      requestId: result.requestId,
      totalCostUsd: result.totalCostUsd || 0,
      resultado: 'OK'
    });

    return {
      success: true,
      pdfLink: pdfLink,
      borradorExplanation: explanation,
      duration: duration,
      costUsd: result.totalCostUsd
    };

  } catch (e) {
    logCotizacion({ fila: row, resultado: 'ERROR', comentario: e.message });
    return { success: false, message: e.message };
  }
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
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error(res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function extractPdfLink(result) {
  return result?.artifacts?.pdfLink || result?.pdfLink || null;
}

function synthesizeProfessionalExplanation(formState, result, pdfLink, mode) {
  // Usa la estructura exacta de COTIZAR-BUTTON-BORRADOR-EXPLICACION.md
  let t = `**Presupuesto generado automáticamente basado en tu consulta**\n\n`;
  t += `**Tu consulta original:**\n> ${formState.consulta}\n\n`;
  t += `**Qué consideramos:**\n- Proyecto: ${formState.projectType || 'Techo'}\n- Superficie: ~${formState.cantidad || '?'} paños\n- Zona: ${formState.zona || ''}\n- Panel: ${formState.panelType || ''}\n`;
  if (formState.aclaraciones) t += `\n**Aclaraciones del equipo:** ${formState.aclaraciones}\n`;
  t += `\n**Total estimado:** $X.XXX USD + IVA\n\n**PDF:** ${pdfLink || '[En proceso]'}\n\n¿Necesitás ajustes?`;
  if (mode === 'Speed') t = t.replace('basado en tu consulta', 'basado en tu consulta (modo rápido)');
  return t;
}

function logCotizacion(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let log = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!log) log = ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    log.appendRow([
      new Date(),
      Session.getActiveUser().getEmail(),
      data.fila || '',
      data.mode || '',
      data.durationSec || '',
      data.totalCostUsd || '',
      data.pdfLink || '',
      data.requestId || '',
      data.resultado || '',
      data.comentario || ''
    ]);
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
    .addItem('Configurar columnas (MODO SEGURO - recomendado)', 'writeCotizarHeadersSafe')
    .addToUi();
}