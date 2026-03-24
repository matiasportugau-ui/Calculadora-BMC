#!/usr/bin/env node
/**
 * panelsim-ml-crm-sync.js — CLI wrapper.
 * Sincroniza preguntas ML sin responder → CRM_Operativo (Google Sheets).
 * Ya no requiere que el servidor esté corriendo.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config();

const { createTokenStore }         = await import("../server/tokenStore.js");
const { createMercadoLibreClient } = await import("../server/mercadoLibreClient.js");
const { config }                   = await import("../server/config.js");
const { syncUnansweredQuestions }  = await import("../server/ml-crm-sync.js");

const SHEET_ID   = process.env.BMC_SHEET_ID;
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "";

async function main() {
  console.log(">>> PANELSIM ML→CRM sync");
  if (!SHEET_ID) { console.error("✗ BMC_SHEET_ID no configurado"); process.exit(1); }

  const tokenStore = createTokenStore({
    storageType:   config.tokenStorage,
    filePath:      config.tokenFile,
    gcsBucket:     config.tokenGcsBucket,
    gcsObject:     config.tokenGcsObject,
    encryptionKey: config.tokenEncryptionKey,
    logger:        console,
  });
  const ml = createMercadoLibreClient({ config, tokenStore, logger: console });

  const tokens = await tokenStore.read();
  if (!tokens?.access_token) {
    console.error("✗ No hay tokens ML — ejecutá /auth/ml/start primero");
    process.exit(1);
  }

  const logger = { info: (m) => console.log(m), warn: (m) => console.warn(m) };
  const result = await syncUnansweredQuestions({ ml, sheetId: SHEET_ID, credsPath: CREDS_PATH, logger });
  console.log(`>>> Sync completo: ${result.synced} pregunta(s) ingresada(s)`);
}

main().catch((e) => { console.error("✗ Error:", e.message); process.exit(1); });
