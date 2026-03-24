import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const bool = (value, fallback = false) => {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
};

const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3001";
const isCloudRun = process.env.K_SERVICE || /\.run\.app$/i.test(publicBaseUrl);

export const config = {
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  publicBaseUrl,
  mlClientId: process.env.ML_CLIENT_ID || "742811153438318",
  mlClientSecret: process.env.ML_CLIENT_SECRET || "",
  mlAuthBase: process.env.ML_AUTH_BASE || "https://auth.mercadolibre.com.uy",
  mlApiBase: process.env.ML_API_BASE || "https://api.mercadolibre.com",
  /** Sitio ML (preguntas / búsquedas). UY = MLU. Ver https://api.mercadolibre.com/sites */
  mlSiteId: process.env.ML_SITE_ID || "MLU",
  mlRedirectUriDev:
    process.env.ML_REDIRECT_URI_DEV || "http://localhost:3001/auth/ml/callback",
  mlRedirectUriProd:
    process.env.ML_REDIRECT_URI_PROD ||
    (isCloudRun ? `${publicBaseUrl.replace(/\/$/, "")}/auth/ml/callback` : ""),
  useProdRedirect: bool(process.env.ML_USE_PROD_REDIRECT, isCloudRun),
  tokenFile: process.env.ML_TOKEN_FILE || path.resolve(".ml-tokens.enc"),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "",
  // GCS backend for Cloud Run (persistent tokens)
  tokenStorage:
    process.env.ML_TOKEN_STORAGE ||
    (isCloudRun && process.env.ML_TOKEN_GCS_BUCKET ? "gcs" : "file"),
  tokenGcsBucket: process.env.ML_TOKEN_GCS_BUCKET || "",
  tokenGcsObject: process.env.ML_TOKEN_GCS_OBJECT || "ml-tokens.enc",
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
  maxRetries: Number(process.env.ML_HTTP_MAX_RETRIES || 3),
  requestTimeoutMs: Number(process.env.ML_HTTP_TIMEOUT_MS || 15000),
  apiAuthToken: process.env.API_AUTH_TOKEN || process.env.API_KEY || "",
  // BMC Finanzas dashboard (Google Sheets)
  bmcSheetId: process.env.BMC_SHEET_ID || "",
  bmcPagosSheetId: process.env.BMC_PAGOS_SHEET_ID || "",
  bmcCalendarioSheetId: process.env.BMC_CALENDARIO_SHEET_ID || "",
  bmcVentasSheetId: process.env.BMC_VENTAS_SHEET_ID || "",
  bmcStockSheetId: process.env.BMC_STOCK_SHEET_ID || "",
  bmcMatrizSheetId: process.env.BMC_MATRIZ_SHEET_ID || "1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo",
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  bmcSheetSchema: process.env.BMC_SHEET_SCHEMA || "Master_Cotizaciones",
  // Shopify (questions/quotes flow – Mercado Libre replacement)
  shopifyClientId: process.env.SHOPIFY_CLIENT_ID || "",
  shopifyClientSecret: process.env.SHOPIFY_CLIENT_SECRET || "",
  shopifyScopes:
    process.env.SHOPIFY_SCOPES ||
    "read_products,write_products,read_orders,write_orders,read_customers,read_draft_orders,write_draft_orders",
  shopifyWebhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || "",
  shopifyQuestionsSheetTab: process.env.SHOPIFY_QUESTIONS_SHEET_TAB || "Shopify_Preguntas",
};

export const redirectUri = () => {
  if (config.useProdRedirect) {
    if (!config.mlRedirectUriProd) {
      throw new Error("ML_REDIRECT_URI_PROD is required when ML_USE_PROD_REDIRECT=true");
    }
    return config.mlRedirectUriProd;
  }
  return config.mlRedirectUriDev;
};
