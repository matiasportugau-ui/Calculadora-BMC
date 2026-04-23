/**
 * wolfboard-quote-trigger.gs — Google Apps Script para el sheet "Admin."
 *
 * SETUP (una sola vez):
 *   1. Abrir el sheet Admin. → Extensions → Apps Script
 *   2. Pegar este código completo
 *   3. Ejecutar setupConfig() y seguir las instrucciones (pide la URL del servidor y el API key)
 *   4. Ejecutar setupTrigger() para instalar el trigger automático
 *   5. Ejecutar setupMenu() para agregar el menú BMC al sheet (o recargar el sheet)
 *
 * MENÚ: "BMC Cotizaciones > Cotizar Todo" corre la cotización manualmente.
 * TRIGGER: onChange se dispara en cada guardado; el debounce de 60s evita spam.
 *
 * PROPIEDADES REQUERIDAS (Script Properties):
 *   QUOTE_BATCH_URL  — URL base del servidor Cloud Run, ej: https://panelin-calc-xxx.run.app
 *   API_AUTH_TOKEN   — Valor del env var API_AUTH_TOKEN del servidor (puede estar vacío si no hay auth)
 */

// ─── Configuración ────────────────────────────────────────────────────────────

var DEBOUNCE_MS = 60000;        // ms entre llamadas automáticas (60 s)
var ENDPOINT_PATH = '/api/wolfboard/quote-batch';
var TIMEOUT_MS = 240000;        // Apps Script UrlFetchApp timeout máximo: 4 min

// ─── Setup helpers ────────────────────────────────────────────────────────────

/** Ejecutá esto UNA SOLA VEZ para guardar la URL del servidor y el API key. */
function setupConfig() {
  var ui = SpreadsheetApp.getUi();

  var urlResponse = ui.prompt(
    'Configurar servidor BMC',
    'Ingresá la URL base del servidor Cloud Run\n(ej: https://panelin-calc-xxx.run.app)',
    ui.ButtonSet.OK_CANCEL
  );
  if (urlResponse.getSelectedButton() !== ui.Button.OK) return;
  var url = urlResponse.getResponseText().trim().replace(/\/$/, '');
  if (!url.startsWith('http')) {
    ui.alert('URL inválida. Debe comenzar con https://');
    return;
  }

  var keyResponse = ui.prompt(
    'Configurar API key',
    'Ingresá el API_AUTH_TOKEN del servidor\n(dejá vacío si el servidor no requiere autenticación)',
    ui.ButtonSet.OK_CANCEL
  );
  if (keyResponse.getSelectedButton() !== ui.Button.OK) return;
  var apiKey = keyResponse.getResponseText().trim();

  var props = PropertiesService.getScriptProperties();
  props.setProperty('QUOTE_BATCH_URL', url);
  props.setProperty('API_AUTH_TOKEN', apiKey);

  ui.alert('Configuración guardada.\nURL: ' + url + '\nAPI key: ' + (apiKey ? '(guardada)' : '(sin auth)'));
}

/** Instala el trigger onChange. Ejecutar UNA sola vez. */
function setupTrigger() {
  // Eliminar triggers existentes de onSheetChange para evitar duplicados
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onSheetChange') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger instalado.\nCada vez que el sheet se guarde (auto o manual), ' +
    'se cotizarán las filas con consulta pendiente (debounce: 60 s).'
  );
}

// ─── Menú ─────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('BMC Cotizaciones')
    .addItem('Cotizar Todo', 'quotarTodo')
    .addSeparator()
    .addItem('Reencolar filas con error (force)', 'quotarTodoForce')
    .addSeparator()
    .addItem('Configurar servidor', 'setupConfig')
    .addItem('Instalar trigger automático', 'setupTrigger')
    .addToUi();
}

// ─── Trigger automático ───────────────────────────────────────────────────────

/** Trigger onChange — se instala con setupTrigger(). Debounce 60 s. */
function onSheetChange(e) {
  var props = PropertiesService.getScriptProperties();
  var lastRun = parseInt(props.getProperty('lastQuoteRun') || '0', 10);
  var now = Date.now();
  if (now - lastRun < DEBOUNCE_MS) return;
  props.setProperty('lastQuoteRun', String(now));

  callQuoteBatch(false, /* showToast= */ true);
}

// ─── Funciones de menú ────────────────────────────────────────────────────────

/** Cotiza todas las filas pendientes (J vacío). */
function quotarTodo() {
  callQuoteBatch(false, /* showToast= */ true);
}

/** Reencola y requote filas que tienen ⚠ en J (errores previos). */
function quotarTodoForce() {
  callQuoteBatch(true, /* showToast= */ true);
}

// ─── Core ─────────────────────────────────────────────────────────────────────

function callQuoteBatch(force, showToast) {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('QUOTE_BATCH_URL');
  var apiKey  = props.getProperty('API_AUTH_TOKEN') || '';

  if (!baseUrl) {
    if (showToast) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'URL del servidor no configurada. Ejecutá "Configurar servidor" desde el menú.',
        'BMC Cotizaciones', 8
      );
    }
    return;
  }

  var url = baseUrl + ENDPOINT_PATH;
  var payload = JSON.stringify({ force: Boolean(force) });

  var headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  var options = {
    method: 'post',
    headers: headers,
    payload: payload,
    muteHttpExceptions: true,
  };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (showToast) ss.toast('Procesando consultas pendientes…', 'BMC Cotizaciones', -1);

  var response, result;
  try {
    response = UrlFetchApp.fetch(url, options);
    result = JSON.parse(response.getContentText());
  } catch (e) {
    if (showToast) ss.toast('Error de red: ' + e.message, 'BMC Cotizaciones', 8);
    return;
  }

  if (!result.ok) {
    if (showToast) ss.toast('Error del servidor: ' + (result.error || 'desconocido'), 'BMC Cotizaciones', 8);
    return;
  }

  if (result.processed === 0) {
    if (showToast) ss.toast('No hay filas pendientes.', 'BMC Cotizaciones', 4);
    return;
  }

  var msg = [
    'Procesadas: ' + result.processed,
    'Exitosas: ' + result.successful,
    (result.failed > 0 ? 'Con error (rojo): ' + result.failed : ''),
  ].filter(Boolean).join(' | ');

  if (showToast) ss.toast(msg, 'BMC Cotizaciones', 8);
}
