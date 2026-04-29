import { google } from 'googleapis';
import 'dotenv/config';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS no está configurada. Apunta al JSON de la cuenta de servicio.');
  process.exit(1);
}

// Configuración de autenticación via ADC (Application Default Credentials)
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function verifySheetExists(spreadsheetId, sheetName) {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = (res.data.sheets || []).find(s => s.properties?.title === sheetName);
    if (sheet) {
      console.log(`✅ VERIFICADO: El tab "${sheetName}" existe en el workbook ${spreadsheetId}.`);
      return true;
    } else {
      const tabs = (res.data.sheets || []).map(s => s.properties?.title);
      console.error(`❌ ERROR: El tab "${sheetName}" NO existe en ${spreadsheetId}. Tabs actuales: ${JSON.stringify(tabs)}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ ERROR al acceder al workbook ${spreadsheetId}: ${err.message}`);
    return false;
  }
}

async function checkAccessible(envName, id) {
  if (!id) { console.log(`⚠️  SKIP: ${envName} no configurada`); return true; }
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
    const tabs = (res.data.sheets || []).map(s => s.properties?.title);
    const preview = tabs.slice(0, 4).join(', ') + (tabs.length > 4 ? '...' : '');
    console.log(`✅ ACCESIBLE: ${envName} — ${tabs.length} tabs (${preview})`);
    return true;
  } catch (err) {
    console.error(`❌ ERROR: ${envName} (${id}) — ${err.message}`);
    return false;
  }
}

async function main() {
  const BMC_SHEET_ID = process.env.BMC_SHEET_ID;
  const schema = process.env.BMC_SHEET_SCHEMA || 'Master_Cotizaciones';

  if (!BMC_SHEET_ID) {
    console.error('ERROR: BMC_SHEET_ID no está configurada.');
    process.exit(1);
  }

  console.log('Iniciando verificación de tabs en Google Sheets...\n');

  let allOk = true;

  // 1. Workbook principal: verificar tab primaria según schema
  const primaryTab = schema === 'CRM_Operativo' ? 'CRM_Operativo' : 'Master_Cotizaciones';
  console.log(`[BMC_SHEET_ID] Schema: ${schema} → buscando tab "${primaryTab}"`);
  allOk = await verifySheetExists(BMC_SHEET_ID, primaryTab) && allOk;

  // 2. Workbooks opcionales: verificar acceso (tab dinámica con getFirstSheetName en prod)
  console.log('');
  for (const [envName, id] of [
    ['BMC_PAGOS_SHEET_ID',     process.env.BMC_PAGOS_SHEET_ID],
    ['BMC_VENTAS_SHEET_ID',    process.env.BMC_VENTAS_SHEET_ID],
    ['BMC_STOCK_SHEET_ID',     process.env.BMC_STOCK_SHEET_ID],
    ['BMC_CALENDARIO_SHEET_ID', process.env.BMC_CALENDARIO_SHEET_ID],
  ]) {
    allOk = await checkAccessible(envName, id) && allOk;
  }

  console.log('');
  if (allOk) {
    console.log('✅ Verificación completada. Todos los workbooks configurados son accesibles.');
    process.exit(0);
  } else {
    console.error('❌ Verificación fallida. Revisar errores arriba.');
    process.exit(1);
  }
}

main().catch(err => {
    console.error("Error inesperado durante la verificación:", err);
    process.exit(1);
});