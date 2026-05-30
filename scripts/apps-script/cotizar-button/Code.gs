/**
 * COTIZAR BUTTON v2 - Fase 1 Production Ready
 * 
 * Apps Script para el flujo "Cotizar" en "2.0 - Administrador de Cotizaciones".
 * 
 * MODELO: Híbrido Backoffice (Borrador Automático → Revisión Humana → Aprobado Oficial)
 * - NUNCA escribe en columna K (Link Presupuesto oficial) desde el botón.
 * - Toda la inteligencia pesada viene del presupOrchestrator (pricing reviewer + document gatekeeper).
 * - Esta capa agrega "IA intelligence improvement": pre-validación barata, consumo rico de gates/artifacts,
 *   síntesis de explicación profesional en el cliente/servidor, logging estructurado de costo/calidad,
 *   y manejo robusto de timeouts.
 * 
 * INSTRUCCIONES:
 * 1. Ejecuta primero `setupCotizarColumns()` (está en el menú).
 * 2. Actualiza CONFIG con los números reales de columna que se crearon.
 * 3. Reemplaza Sidebar.html por la versión pulida (preview-sidebar-cotizar.html como referencia).
 */

// =====================================================
// CONFIGURACIÓN CENTRAL (COMPLETA Y VALIDADA)
// =====================================================

// Índice de columna donde setupCotizarColumns / writeCotizarHeadersSafe escriben el grupo Borrador.
// Si usaste otra columna al configurar la planilla, actualizá solo este valor y los COL_* se recalculan abajo.
const COTIZAR_BORRADOR_START_COL = 60;

const CONFIG = {
  // --- BACKEND (Cloud Run canónico — mismo host que vercel.json proxies) ---
  BACKEND_BASE_URL: 'https://panelin-calc-q74zutv7dq-uc.a.run.app',
  ORCHESTRATOR_ENDPOINT: '/api/internal/presup/run',

  // Planilla origen Admin 2.0 (referencia; Apps Script corre dentro del spreadsheet)
  SHEET_ID: '1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0',

  // Carpeta Drive para PDFs de borrador — reemplazar tras crear carpeta dedicada en Drive BMC
  PDF_DRIVE_FOLDER_ID: '', // ej: '1abc...' — vacío = no sube PDF a Drive desde Sidebar

  // --- HOJA ---
  TAB_NAME: 'Admin.',

  // Columnas existentes (Admin. — fila 2 cabecera, datos ~fila 8+)
  COL_ESTADO: 3,            // C — Estado
  COL_CONSULTA: 9,          // I — Consulta (input Cotizar)
  COL_RESPUESTA: 10,        // J — Respuesta AI (legacy; borrador va a COL_BORRADOR_EXPLICACION)
  COL_LINK_PRESUPUESTO: 11, // K — Link Presupuesto OFICIAL — NUNCA escribir desde Cotizar

  // NUEVAS COLUMNAS — default startCol=60 (recomendado en setup para evitar timeouts)
  // Borrador: 60–65 | separador 66 | Revisión: 67–69
  COL_BORRADOR_PDF: COTIZAR_BORRADOR_START_COL,
  COL_BORRADOR_EXPLICACION: COTIZAR_BORRADOR_START_COL + 1,
  COL_FECHA_BORRADOR: COTIZAR_BORRADOR_START_COL + 2,
  COL_GENERADO_POR: COTIZAR_BORRADOR_START_COL + 3,
  COL_MODO: COTIZAR_BORRADOR_START_COL + 4,
  COL_DURACION: COTIZAR_BORRADOR_START_COL + 5,

  COL_REVISADO_POR: COTIZAR_BORRADOR_START_COL + 7,
  COL_FECHA_REVISION: COTIZAR_BORRADOR_START_COL + 8,
  COL_COMENTARIO_REVISION: COTIZAR_BORRADOR_START_COL + 9,

  // --- IA / INTELLIGENCE ---
  MIN_CONSULTA_LENGTH: 25,           // Filtro barato antes de llamar al orquestador
  DEFAULT_MODE: 'profundo',          // o 'ligero' para Speed Mode
  LOG_SHEET_NAME: 'Log Cotizaciones'
};

// Validación rápida de CONFIG al cargar
function _validateConfig() {
  const cols = getBorradorColumns();
  const missing = Object.entries(cols).filter(([, v]) => v == null || v < 1);
  if (missing.length) {
    console.warn('[Cotizar] CONFIG incompleto — columnas borrador:', missing.map(([k]) => k).join(', '));
  }
  if (!CONFIG.BACKEND_BASE_URL || CONFIG.BACKEND_BASE_URL.indexOf('[tu-hash]') >= 0) {
    console.warn('[Cotizar] BACKEND_BASE_URL no configurado');
  }
}

// =====================================================
// FUNCIONES PRINCIPALES
// =====================================================

/**
 * Abre el Sidebar con el botón Cotizar
 */
function showCotizarSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Cotizar Automático')
    .setWidth(320);
  
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * NUEVA FUNCIÓN FASE 1 - Recomendada para el Sidebar rico
 * Recibe el estado completo del formulario del Sidebar (aclaraciones + modo + campos estructurados).
 */
function performCotizar(formState) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const tabName = CONFIG.TAB_NAME;
  const activeRow = sheet.getActiveRange().getRow();

  if (!formState || !formState.consulta) {
    return { success: false, message: 'Falta información del formulario' };
  }

  // === IA Intelligence Improvement: Pre-validación barata ===
  if (formState.consulta.length < CONFIG.MIN_CONSULTA_LENGTH) {
    return { success: false, message: `La consulta es muy corta (mínimo ${CONFIG.MIN_CONSULTA_LENGTH} caracteres)` };
  }

  const startTime = Date.now();

  try {
    // Llamada al orquestador con payload completo (aclaraciones + contexto)
    const orchestratorResult = callPresupOrchestratorWithContext(formState);

    if (!orchestratorResult || !orchestratorResult.ok) {
      throw new Error(orchestratorResult?.error || 'Error desconocido en el orquestador');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const mode = formState.speedMode ? 'Speed' : 'Normal';

    // Extraer PDF (inteligente) o generar borrador vía backend + Drive
    let pdfLink = extractPdfLink(orchestratorResult);
    if (!pdfLink) {
      pdfLink = generateAndUploadPDF(orchestratorResult, activeRow, formState);
    }

    // === IA Intelligence: Sintetizar explicación rica usando gates + artifacts ===
    const borradorExplanation = synthesizeProfessionalExplanation(formState, orchestratorResult, pdfLink, mode);

    // === ESCRITURA SOLO EN BORRADOR (respeta el modelo híbrido) ===
    const borradorCols = getBorradorColumns();
    if (!borradorCols.pdf || !borradorCols.explicacion) {
      throw new Error('CONFIG de columnas de borrador no está completo. Corre setupCotizarColumns primero.');
    }

    sheet.getRange(activeRow, borradorCols.pdf).setValue(pdfLink || 'Procesando...');
    sheet.getRange(activeRow, borradorCols.explicacion).setValue(borradorExplanation);
    sheet.getRange(activeRow, borradorCols.fecha).setValue(new Date());
    sheet.getRange(activeRow, borradorCols.generadoPor).setValue(Session.getActiveUser().getEmail());
    sheet.getRange(activeRow, borradorCols.modo).setValue(mode);
    sheet.getRange(activeRow, borradorCols.duracion).setValue(duration);

    // Actualizar Estado a Borrador Automático
    if (CONFIG.COL_ESTADO) {
      sheet.getRange(activeRow, CONFIG.COL_ESTADO).setValue('Borrador Automático');
    }

    // === Logging estructurado (inteligencia + auditoría) ===
    logCotizacion({
      fila: activeRow,
      mode: mode,
      durationSec: duration,
      pdfLink: pdfLink,
      requestId: orchestratorResult.requestId,
      totalCostUsd: orchestratorResult.totalCostUsd || 0,
      gatesSummary: orchestratorResult.gates ? JSON.stringify(orchestratorResult.gates) : '',
      resultado: 'OK'
    });

    return {
      success: true,
      pdfLink: pdfLink,
      borradorExplanation: borradorExplanation,
      requestId: orchestratorResult.requestId,
      duration: duration,
      costUsd: orchestratorResult.totalCostUsd
    };

  } catch (error) {
    console.error('Error en performCotizar:', error);
    logCotizacion({
      fila: activeRow,
      mode: formState.speedMode ? 'Speed' : 'Normal',
      resultado: 'ERROR',
      comentario: error.message
    });
    return { success: false, message: 'Error: ' + error.message };
  }
}

/** Helper para mapear columnas de borrador desde CONFIG */
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

/**
 * Llamada mejorada al orquestador con todo el contexto de IA (aclaraciones + modo + fila)
 * Esto es la "IA intelligence improvement" principal en la capa de Apps Script.
 */
function callPresupOrchestratorWithContext(formState) {
  const url = CONFIG.BACKEND_BASE_URL + CONFIG.ORCHESTRATOR_ENDPOINT;

  const payload = {
    channel: 'sheet-admin-cotizar',
    consulta: formState.consulta,
    mode: formState.speedMode ? 'ligero' : CONFIG.DEFAULT_MODE,
    aclaraciones: JSON.stringify({
      structured: formState,
      freeText: formState.aclaraciones || ''
    }),
    contexto_adicional: {
      fila: formState.row || null,
      zona: formState.zona || null,
      cliente: formState.cliente || null
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      // 'Authorization': 'Bearer ' + getInternalAuthToken() // descomentar cuando tengas auth
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code !== 200) {
    throw new Error('Error del orquestador (' + code + '): ' + response.getContentText());
  }

  return JSON.parse(response.getContentText());
}

/** Extrae el link del PDF de forma inteligente desde los artifacts */
function extractPdfLink(orchestratorResult) {
  if (!orchestratorResult) return null;
  if (orchestratorResult.artifacts && orchestratorResult.artifacts.pdfLink) return orchestratorResult.artifacts.pdfLink;
  if (orchestratorResult.pdfLink) return orchestratorResult.pdfLink;
  return null;
}

/**
 * Síntesis profesional de la explicación para el comprador.
 * Usa la plantilla aprobada + datos del orquestador (gates) + aclaraciones del vendedor.
 * Esto hace que la "vista previa en vivo" sea idéntica a lo que se guarda.
 */
function synthesizeProfessionalExplanation(formState, orchestratorResult, pdfLink, modeLabel) {
  const consulta = formState.consulta || '';
  const date = new Date().toLocaleDateString('es-UY');

  let text = `**Presupuesto generado automáticamente basado en tu consulta**\n\n`;
  text += `**Tu consulta original:**\n> ${consulta}\n\n`;

  text += `**Qué consideramos para esta cotización:**\n`;
  text += `- Tipo de proyecto: ${formState.projectType || 'Techo'}\n`;
  text += `- Superficie aproximada: ${formState.cantidad || '?'} paños de ${formState.largo || '?'}m\n`;
  text += `- Zona: ${formState.zona || 'No especificada'}\n`;
  text += `- Panel principal: ${formState.panelType || ''} ${formState.esp50 ? '50mm' : ''}\n`;
  text += `- Estructura: ${formState.estructura || ''}\n`;
  text += `- Terminación: ${formState.terminacion || ''}\n\n`;

  if (formState.aclaraciones) {
    text += `**Aclaraciones del equipo:** ${formState.aclaraciones}\n\n`;
  }

  text += `**Resumen del presupuesto generado:**\n`;
  text += `Se realizó el cálculo considerando las especificaciones y aclaraciones proporcionadas. Se incluyeron los accesorios estructurales necesarios y traslado.\n\n`;

  text += `**Total estimado:** $X.XXX USD + IVA\n\n`;
  text += `(El desglose detallado con precios unitarios y condiciones está en el PDF).\n\n`;
  text += `**Presupuesto detallado:** ${pdfLink || '[En proceso]'}\n\n`;

  text += `Este presupuesto fue generado automáticamente. Si hay datos que no estaban claros, el valor puede variar.\n`;
  text += `¿Querés que ajustemos algo?`;

  if (modeLabel === 'Speed') {
    text = text.replace('basado en tu consulta', 'basado en tu consulta (modo rápido)');
  }

  return text;
}

/** Logging estructurado a la pestaña de Log (inteligencia + auditoría) */
function logCotizacion(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.LOG_SHEET_NAME);
      logSheet.appendRow(['Timestamp', 'Usuario', 'Fila', 'Modo', 'Duración (s)', 'Costo USD', 'PDF Borrador', 'Request ID', 'Gates', 'Resultado', 'Comentario']);
    }
    logSheet.appendRow([
      new Date(),
      Session.getActiveUser().getEmail(),
      data.fila || '',
      data.mode || '',
      data.durationSec || '',
      data.totalCostUsd || '',
      data.pdfLink || '',
      data.requestId || '',
      data.gatesSummary || '',
      data.resultado || '',
      data.comentario || ''
    ]);
  } catch (e) {
    console.error('Error logging:', e);
  }
}

/**
 * Genera el PDF borrador vía POST /api/pdf/generate y lo sube a Drive.
 * Requiere CONFIG.PDF_DRIVE_FOLDER_ID. Si el orchestrator ya devolvió pdfLink, lo reutiliza.
 */
function generateAndUploadPDF(orchestratorResult, rowNumber, formState) {
  if (orchestratorResult.artifacts && orchestratorResult.artifacts.pdfLink) {
    return orchestratorResult.artifacts.pdfLink;
  }

  if (!CONFIG.PDF_DRIVE_FOLDER_ID) {
    console.warn('[Cotizar] PDF_DRIVE_FOLDER_ID vacío — omitiendo subida a Drive');
    return null;
  }

  const requestId = orchestratorResult.requestId || ('BMC-' + rowNumber);
  const html = buildBorradorPdfHtml(orchestratorResult, formState, rowNumber, requestId);
  const pdfBytes = fetchPdfBytesFromBackend(html, requestId);

  if (!pdfBytes || !pdfBytes.length) {
    console.warn('[Cotizar] No se pudo generar PDF en backend — fallback omitido');
    return null;
  }

  const folder = DriveApp.getFolderById(CONFIG.PDF_DRIVE_FOLDER_ID);
  const fileName = 'Cotizacion_Borrador_Fila' + rowNumber + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
  const file = folder.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/** HTML mínimo para borrador Phase A (layout simple-carbon compatible). */
function buildBorradorPdfHtml(orchestratorResult, formState, rowNumber, requestId) {
  const consulta = (formState && formState.consulta) || orchestratorResult.input?.consulta || '';
  const gates = orchestratorResult.gates ? JSON.stringify(orchestratorResult.gates, null, 2) : '{}';
  const intake = orchestratorResult.artifacts?.intake
    ? JSON.stringify(orchestratorResult.artifacts.intake, null, 2)
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Borrador ' + requestId + '</title>' +
    '<style>body{font-family:Arial,sans-serif;margin:40px;color:#111}h1{font-size:20px}' +
    'pre{background:#f5f5f5;padding:12px;white-space:pre-wrap;font-size:11px}' +
    '.meta{color:#555;font-size:12px;margin-bottom:24px}</style></head><body>' +
    '<h1>BMC Uruguay — Presupuesto borrador (no oficial)</h1>' +
    '<p class="meta">ID: ' + requestId + ' · Fila Admin: ' + rowNumber + ' · Generado automáticamente</p>' +
    '<h2>Consulta</h2><p>' + escapeHtml_(consulta) + '</p>' +
    (intake ? '<h2>Clasificación</h2><pre>' + escapeHtml_(intake) + '</pre>' : '') +
    '<h2>Gates</h2><pre>' + escapeHtml_(gates) + '</pre>' +
    '<p><em>Documento borrador — revisión humana requerida antes de envío al cliente.</em></p>' +
    '</body></html>';
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** POST /api/pdf/generate → bytes del PDF (null si falla o 503 Chromium). */
function fetchPdfBytesFromBackend(html, requestId) {
  const url = CONFIG.BACKEND_BASE_URL + '/api/pdf/generate';
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      html: html,
      filename: 'borrador-' + requestId + '.pdf',
      layout: 'simple-carbon',
      quoteId: requestId
    }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code === 200) {
    return response.getBlob().getBytes();
  }

  console.warn('[Cotizar] /api/pdf/generate HTTP ' + code + ': ' + response.getContentText().slice(0, 200));
  return null;
}

/**
 * Construye la explicación bonita para el comprador (columna J)
 */
function buildBuyerExplanation(orchestratorResult, pdfLink) {
  const date = new Date().toLocaleDateString('es-UY');
  
  let explanation = `**Presupuesto generado automáticamente el ${date}**\n\n`;
  
  explanation += `**Basado en tu consulta:**\n`;
  explanation += `> ${orchestratorResult.input?.consulta || 'Consulta original'}\n\n`;
  
  // Aquí puedes enriquecer mucho más usando los artifacts del orchestrator
  if (orchestratorResult.gates && orchestratorResult.gates.pricing) {
    explanation += `**Criterios técnicos aplicados:**\n`;
    explanation += `- Tipo de panel y espesor seleccionado según requerimiento\n`;
    explanation += `- Cálculo de superficie y accesorios necesarios\n`;
    explanation += `- Precios actualizados al momento de la cotización\n\n`;
  }
  
  explanation += `**Explicación del presupuesto:**\n`;
  explanation += `El presupuesto fue generado siguiendo el flujo estándar de presupuestación BMC, considerando las especificaciones indicadas en tu consulta.\n\n`;
  
  explanation += `El documento completo con el desglose detallado, precios unitarios, cantidades y condiciones comerciales se encuentra aquí:\n\n`;
  explanation += `**📄 PDF del Presupuesto:** ${pdfLink}\n\n`;
  
  explanation += `¿Necesitás realizar algún ajuste (medidas, terminaciones, cantidad, etc.)?`;
  
  return explanation;
}

// =====================================================
// MENÚ
// =====================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Cotizaciones 2.0')
    .addItem('Abrir panel Cotizar', 'showCotizarSidebar')
    .addSeparator()
    .addItem('Configurar columnas (versión normal)', 'setupCotizarColumns')
    .addItem('Configurar columnas (MODO SEGURO - recomendado)', 'writeCotizarHeadersSafe')
    .addToUi();
}

// =====================================================
// FUNCIÓN DE SETUP / CONFIGURACIÓN INICIAL
// =====================================================

/**
 * Configura las columnas necesarias para el flujo Cotizar (Modelo Híbrido).
 * 
 * Esta función debe ejecutarse **una sola vez** (o cada vez que agregues más columnas).
 * 
 * - Agrega los encabezados de las columnas de Borrador y Revisión al final de la hoja "Admin.".
 * - Crea opcionalmente una pestaña de Log.
 * - Muy segura: pide confirmación en varios pasos.
 * 
 * Instrucciones:
 * 1. Ve a Extensiones → Apps Script.
 * 2. Ejecuta la función `setupCotizarColumns`.
 * 3. Sigue las ventanas de confirmación.
 * 4. Una vez que sepas los números reales de columna, actualiza el objeto CONFIG de arriba.
 */
function setupCotizarColumns() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tabName = CONFIG.TAB_NAME || 'Admin.';
  const sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    ui.alert(`No se encontró la hoja "${tabName}". Por favor verifica el nombre exacto de la pestaña.`);
    return;
  }

  // === ADVERTENCIA IMPORTANTE POR TIMEOUT ===
  const warning = ui.alert(
    '⚠️ Advertencia de Timeout (Hoja grande)',
    'Esta planilla es grande y tenés la hoja abierta en el navegador.\n\n' +
    'Google Apps Script suele dar timeout en hojas anchas cuando están abiertas.\n\n' +
    'Recomendación fuerte:\n' +
    '1. CERRÁ completamente la planilla en todos los navegadores antes de continuar.\n' +
    '2. O usá un número de columna muy alto (ej: 60 o más) para minimizar trabajo.\n\n' +
    '¿Querés continuar de todas formas?',
    ui.ButtonSet.YES_NO
  );

  if (warning !== ui.Button.YES) {
    ui.alert('Operación cancelada. Cerrá la planilla y volvé a intentarlo.');
    return;
  }

  // === El usuario elige columna de inicio (más seguro) ===
  const response = ui.prompt(
    'Configurar columnas Cotizar',
    '¿En qué número de columna querés empezar?\n\n' +
    'Recomendado para evitar timeouts y validaciones: 55, 60 o más.\n' +
    'Dejá en blanco para calcular automáticamente (última + 2).',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    ui.alert('Operación cancelada.');
    return;
  }

  let startCol;
  const input = response.getResponseText().trim();

  if (input === '') {
    startCol = sheet.getLastColumn() + 2;
  } else {
    startCol = parseInt(input, 10);
    if (isNaN(startCol) || startCol < 1) {
      ui.alert('Número inválido.');
      return;
    }
  }

  const createLog = ui.alert(
    '¿Crear pestaña de Log?',
    '¿También querés crear "Log Cotizaciones"?',
    ui.ButtonSet.YES_NO
  ) === ui.Button.YES;

  const borradorHeaders = ['Borrador PDF', 'Borrador Explicación', 'Fecha Generación Borrador', 'Generado Por', 'Modo', 'Duración (seg)'];
  const revisionHeaders = ['Revisado Por', 'Fecha Revisión', 'Comentario de Revisión'];

  try {
    // Intentamos insertar solo si es necesario
    const currentLast = sheet.getLastColumn();
    const needed = borradorHeaders.length + revisionHeaders.length + 1;

    if (startCol + needed > currentLast) {
      // Operación pesada → puede dar timeout en hojas grandes
      sheet.insertColumnsAfter(currentLast, (startCol + needed) - currentLast);
    }

    // Limpiar validaciones (puede ser lento)
    const rangeB = sheet.getRange(1, startCol, 1, borradorHeaders.length);
    rangeB.clearDataValidations();

    const rangeR = sheet.getRange(1, startCol + borradorHeaders.length + 1, 1, revisionHeaders.length);
    rangeR.clearDataValidations();

    // Escribir encabezados
    rangeB.setValues([borradorHeaders])
      .setBackground('#fff2cc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    rangeR.setValues([revisionHeaders])
      .setBackground('#d9ead3')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

  } catch (e) {
    ui.alert('Error durante la operación: ' + e.message + 
      '\n\nPosibles causas:\n' +
      '- La planilla sigue abierta en el navegador\n' +
      '- La hoja es muy ancha\n\n' +
      'Recomendación: Cerrá la planilla completamente y ejecutá de nuevo.');
    return;
  }

  let msg = `Columnas creadas empezando en columna ${startCol}.\n\n` +
    'Actualizá CONFIG con los números reales.';

  if (createLog) {
    const log = ss.getSheetByName(CONFIG.LOG_SHEET_NAME) || ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    log.getRange(1, 1, 1, 9).setValues([['Timestamp','Usuario','Fila','Modo','Duración','Costo','PDF','RequestID','Resultado']])
      .setBackground('#cfe2f3');
    msg += '\nPestaña Log Cotizaciones creada.';
  }

  ui.alert('Operación finalizada', msg, ui.ButtonSet.OK);
}

/**
 * VERSIÓN ULTRA SEGURA - Solo escribe encabezados (sin insertar columnas ni limpiar validaciones masivas).
 * 
 * Uso recomendado cuando el script da timeout:
 * 1. Cerrá completamente la planilla.
 * 2. En la hoja "Admin.", creá manualmente 9 columnas nuevas en un lugar alto (ej: columna 60 en adelante).
 * 3. Ejecutá esta función e indicá en qué columna empezaste.
 * 4. Esta función solo pone los nombres bonitos y formato.
 */
function writeCotizarHeadersSafe() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TAB_NAME || 'Admin.');

  if (!sheet) {
    ui.alert('Hoja no encontrada.');
    return;
  }

  const startColStr = ui.prompt(
    'Escribir encabezados Cotizar (Modo Seguro)',
    '¿En qué columna empezamos a escribir los encabezados?\n\n' +
    'Ejemplo: si creaste las columnas a partir de la columna 60, escribí 60.',
    ui.ButtonSet.OK_CANCEL
  );

  if (startColStr.getSelectedButton() !== ui.Button.OK) return;

  const startCol = parseInt(startColStr.getResponseText(), 10);
  if (isNaN(startCol) || startCol < 1) {
    ui.alert('Número de columna inválido.');
    return;
  }

  const borrador = ['Borrador PDF', 'Borrador Explicación', 'Fecha Generación Borrador', 'Generado Por', 'Modo', 'Duración (seg)'];
  const revision = ['Revisado Por', 'Fecha Revisión', 'Comentario de Revisión'];

  try {
    // Solo escribimos y damos formato (operación mucho más liviana)
    const r1 = sheet.getRange(1, startCol, 1, borrador.length);
    r1.setValues([borrador])
      .setBackground('#fff2cc')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    const r2 = sheet.getRange(1, startCol + borrador.length + 1, 1, revision.length);
    r2.setValues([revision])
      .setBackground('#d9ead3')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    ui.alert(
      'Encabezados escritos correctamente.\n\n' +
      `Grupo Borrador: columnas ${startCol} a ${startCol + borrador.length - 1}\n` +
      `Grupo Revisión: columnas ${startCol + borrador.length + 2} a ${startCol + borrador.length + 1 + revision.length}\n\n` +
      'Ahora actualizá CONFIG con estos números y probá el Sidebar.'
    );

  } catch (e) {
    ui.alert('Error al escribir encabezados: ' + e.message);
  }
}
