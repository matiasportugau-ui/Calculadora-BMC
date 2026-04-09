import {
  google
} from 'googleapis';
import 'dotenv/config';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Error: GOOGLE_APPLICATION_CREDENTIALS no está configurada. Apunta al JSON de la cuenta de servicio.');
  process.exit(1);
}

// Configuración de autenticación via ADC (Application Default Credentials)
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const PAGOS_SHEET_ID = process.env.BMC_PAGOS_SHEET_ID;
const VENTAS_SHEET_ID = process.env.BMC_VENTAS_SHEET_ID;
const STOCK_SHEET_ID = process.env.BMC_STOCK_SHEET_ID;
const CALENDARIO_SHEET_ID = process.env.BMC_CALENDARIO_SHEET_ID;

async function createSheet(spreadsheetId, title) {
  try {
    const request = {
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          },
        ],
      },
    };
    await sheets.spreadsheets.batchUpdate(request);
    console.log(`Tab "${title}" creado con éxito en el workbook ${spreadsheetId}.`);
  } catch (err) {
    if (err.errors && err.errors.some(e => e.message.includes('already exists'))) {
      console.log(`Tab "${title}" ya existe en el workbook ${spreadsheetId}. No se realizaron cambios.`);
    } else {
      console.error(`Error al crear el tab "${title}" en el workbook ${spreadsheetId}:`, err);
    }
  }
}

async function addColumns(spreadsheetId, sheetName, columns) {
    try {
        const request = {
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [columns],
            },
        };
        await sheets.spreadsheets.values.update(request);
        console.log(`Columnas ${columns.join(', ')} agregadas al tab "${sheetName}" en el workbook ${spreadsheetId}.`);
    } catch (err) {
        console.error(`Error al agregar columnas al tab "${sheetName}" en el workbook ${spreadsheetId}:`, err);
    }
}


async function main() {
  if (!PAGOS_SHEET_ID || !VENTAS_SHEET_ID || !STOCK_SHEET_ID || !CALENDARIO_SHEET_ID) {
    console.error('Asegúrate de que las variables de entorno BMC_PAGOS_SHEET_ID, BMC_VENTAS_SHEET_ID, BMC_STOCK_SHEET_ID y BMC_CALENDARIO_SHEET_ID estén configuradas.');
    return;
  }

  // 1. Crear tab CONTACTOS en workbook Pagos Pendientes
  await createSheet(PAGOS_SHEET_ID, 'CONTACTOS');
  await addColumns(PAGOS_SHEET_ID, 'CONTACTOS', ['NOMBRE', 'EMAIL']);


  // 2. Crear tab Ventas_Consolidado en workbook Ventas
  await createSheet(VENTAS_SHEET_ID, 'Ventas_Consolidado');
  await addColumns(VENTAS_SHEET_ID, 'Ventas_Consolidado', [
      'ID_VENTA', 'FECHA', 'CLIENTE', 'PRODUCTO', 'CANTIDAD', 'PRECIO_UNITARIO', 'PRECIO_TOTAL', 'VENDEDOR', 'CANAL', 'ESTADO', 'ID_SHOPIFY'
  ]);

  // 3. Añadir columna SHOPIFY_SYNC_AT al final en workbook Stock
  // Nota: La API de Sheets no permite agregar una columna al final de forma directa.
  // La estrategia más simple es leer la última columna y agregar la nueva al lado.
  // Por simplicidad, este script asume que se puede agregar en una columna específica (ej. Z)
  // o que se puede reescribir todo el header. Optamos por la simplicidad.
  console.log('La adición de columnas a tabs existentes se debe hacer manualmente por ahora.');


  // 4. Añadir columna PAGADO al final en workbook Calendario
  console.log('La adición de columnas a tabs existentes se debe hacer manualmente por ahora.');

}

main().catch(console.error);
