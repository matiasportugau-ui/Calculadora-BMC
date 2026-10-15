#!/usr/bin/env node
/**
 * Automatiza tareas 1.4 + 2.x del Go-Live Checklist:
 * 1. Comparte 5 workbooks con la SA (bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com)
 * 2. Crea tabs manuales (CONTACTOS, Ventas_Consolidado, SHOPIFY_SYNC_AT, PAGADO)
 * 3. (Futuro) Configura 6 triggers en Apps Script
 *
 * Uso: npx doppler run -- node scripts/setup-go-live-hardening.mjs
 * O: GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/setup-go-live-hardening.mjs
 */

import "dotenv/config";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Service account email that will be granted access
const SA_EMAIL = "bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com";

// Sheet IDs to share (from .env or hardcoded fallbacks per setup-sheets-tabs.js)
const SHEET_IDS = {
  pagos: process.env.BMC_PAGOS_SHEET_ID || "1AzHhalsZKGis_oJ6J06zQeOb6uMQCsliR82VrSKUUsI",
  ventas: process.env.BMC_VENTAS_SHEET_ID || "1IMZr_qEyVi8eIlNc_Nk64eY63LHUlAue",
  stock: process.env.BMC_STOCK_SHEET_ID || "1egtKJAGaATLmmsJkaa2LlCv3Ah4lmNoGMNm4l0rXJQw",
  calendario:
    process.env.BMC_CALENDARIO_SHEET_ID || "1bvnbYq7MTJRpa6xEHE5m-5JcGNI9oCFke3lsJj99tdk",
  matriz:
    process.env.BMC_MATRIZ_SHEET_ID || "1tO3aHfvKKJLgr4xqKBJw6Z6N5YvI9FvPqRxLmN2hK8s",
};

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ scopes: [SCOPE] });
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient });
}

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

/**
 * Task 1.4: Comparte un workbook con la SA (Editor role)
 */
async function shareWorkbookWithSA(drive, spreadsheetId, name) {
  try {
    console.log(`  Compartiendo "${name}" con ${SA_EMAIL}...`);

    // Check if already shared
    const permissions = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: "permissions(emailAddress,role)",
    });

    const alreadyShared = permissions.data.permissions?.some(
      (p) => p.emailAddress === SA_EMAIL && p.role === "editor"
    );

    if (alreadyShared) {
      console.log(`    ✓ Ya compartido como Editor`);
      return true;
    }

    // Grant Editor access
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: "editor",
        type: "user",
        emailAddress: SA_EMAIL,
      },
      fields: "id",
    });

    console.log(`    ✓ Editor access otorgado`);
    return true;
  } catch (err) {
    console.error(`    ✗ Error: ${err.message}`);
    return false;
  }
}

/**
 * Task 2.x: Crea tabs manuales via setup-sheets-tabs.js
 */
function runSetupSheetsTabs() {
  return new Promise((resolve, reject) => {
    console.log("\n📊 Task 2.x: Creando tabs en Sheets...");
    console.log("   Ejecutando: npm run setup-sheets-tabs\n");

    const proc = spawn("npm", ["run", "setup-sheets-tabs"], {
      cwd: path.dirname(__dirname),
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log("\n✅ Tabs creadas exitosamente.\n");
        resolve(true);
      } else {
        reject(new Error(`setup-sheets-tabs exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Task 3.x (Futuro): Configura triggers via Apps Script API
 * Por ahora solo documenta lo que falta
 */
function documentTriggerSetup() {
  console.log("⏰ Task 3.x: Triggers en Apps Script (MANUAL por ahora)");
  console.log(`
  Referencia: docs/APPS-SCRIPT-TRIGGERS-SETUP.md

  Pasos para cada workbook:
  1. Abre la planilla en Google Sheets
  2. Extensiones > Apps Script
  3. Copia/pega el código de Code.gs
  4. Guarda (Ctrl+S)
  5. Ícono de reloj (Activadores)
  6. + Añadir activador y configura según la tabla

  Triggers a instalar:
  ✓ Pagos Pendientes: alEditarPagos (on edit), alAbrirPagos (on open)
  ✓ Ventas: alEditarVentas (on edit)
  ✓ Stock: alCambiarStock (on change)
  ✓ Calendario: alEditarCalendario (on edit), cadaDia (daily 8am)
  `);
  return false; // No automatizado
}

/**
 * Main orchestrator
 */
async function main() {
  console.log("🚀 Go-Live Hardening Setup — Tareas 1.4 + 2.x + 3.x\n");

  // Verify credentials
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credsPath) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS no está configurado");
    console.error("   Usa: doppler run -- node scripts/setup-go-live-hardening.mjs");
    process.exit(1);
  }

  if (!fs.existsSync(credsPath)) {
    console.error(`❌ Service account JSON no encontrado: ${credsPath}`);
    process.exit(1);
  }

  try {
    // Task 1.4: Share workbooks
    console.log("📁 Task 1.4: Compartiendo workbooks con la SA...\n");
    const drive = await getDriveClient();

    const sharing = {
      pagos: await shareWorkbookWithSA(drive, SHEET_IDS.pagos, "Pagos Pendientes 2026"),
      ventas: await shareWorkbookWithSA(drive, SHEET_IDS.ventas, "2.0 - Ventas"),
      stock: await shareWorkbookWithSA(drive, SHEET_IDS.stock, "Stock E-Commerce"),
      calendario: await shareWorkbookWithSA(
        drive,
        SHEET_IDS.calendario,
        "Calendario de vencimientos"
      ),
      matriz: await shareWorkbookWithSA(drive, SHEET_IDS.matriz, "Matriz de Costos y Ventas 2026"),
    };

    const allShared = Object.values(sharing).every((v) => v === true);
    if (!allShared) {
      console.error("\n⚠️  Algunos workbooks no pudieron compartirse.");
      console.error("   Verifica permisos de la SA y acceso a los IDs.");
      process.exit(1);
    }

    console.log("\n✅ Todos los workbooks compartidos.\n");

    // Task 2.x: Setup sheets tabs
    await runSetupSheetsTabs();

    // Task 3.x: Document triggers
    documentTriggerSetup();

    console.log(
      "\n" +
        "━".repeat(70) +
        "\n✅ Hardening Phases 1.4 + 2.x completas!\n\n" +
        "Próximos pasos (manual):\n" +
        "  1. Configura 6 triggers en Apps Script (ver arriba)\n" +
        "  2. Verifica tabs en: https://docs.google.com/spreadsheets/d/{ID}\n" +
        "  3. Run 'npm run pre-deploy' para verificar estado\n"
    );
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

main();
