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

const PAGOS_SHEET_ID = process.env.BMC_PAGOS_SHEET_ID;
const VENTAS_SHEET_ID = process.env.BMC_VENTAS_SHEET_ID;

async function verifySheetExists(spreadsheetId, sheetName) {
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    const sheet = (res.data.sheets || []).find(s => s.properties?.title === sheetName);
    if (sheet) {
      console.log(`✅ VERIFICADO: El tab "${sheetName}" existe en el workbook ${spreadsheetId}.`);
      return true;
    } else {
      console.error(`❌ ERROR: El tab "${sheetName}" NO existe en el workbook ${spreadsheetId}.`);
      return false;
    }
  } catch (err) {
    console.error(`Error al verificar el workbook ${spreadsheetId}:`, err.message);
    return false;
  }
}

async function main() {
  if (!PAGOS_SHEET_ID || !VENTAS_SHEET_ID) {
    console.error('Asegúrate de que las variables de entorno BMC_PAGOS_SHEET_ID y BMC_VENTAS_SHEET_ID estén configuradas.');
    process.exit(1);
  }

  console.log('Iniciando verificación de tabs en Google Sheets...');

  const results = await Promise.all([
    verifySheetExists(PAGOS_SHEET_ID, 'CONTACTOS'),
    verifySheetExists(VENTAS_SHEET_ID, 'Ventas_Consolidado'),
  ]);

  const allVerified = results.every(res => res);

  if (allVerified) {
    console.log('\nVerificación completada con éxito. Todos los tabs esperados existen.');
    process.exit(0);
  } else {
    console.error('\nFalló la verificación. Faltan uno o más tabs.');
    process.exit(1);
  }
}

main().catch(err => {
    console.error("Error inesperado durante la verificación:", err);
    process.exit(1);
});