import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const bool = (value, fallback = false) => {
  if (value == null) return fallback;
  return String(value).toLowerCase() === "true";
};

export const config = {
  appEnv: process.env.APP_ENV || process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3001",
  mlClientId: process.env.ML_CLIENT_ID || "742811153438318",
  mlClientSecret: process.env.ML_CLIENT_SECRET || "",
  mlAuthBase: process.env.ML_AUTH_BASE || "https://auth.mercadolibre.com.uy",
  mlApiBase: process.env.ML_API_BASE || "https://api.mercadolibre.com",
  mlRedirectUriDev:
    process.env.ML_REDIRECT_URI_DEV || "http://localhost:3001/auth/ml/callback",
  mlRedirectUriProd: process.env.ML_REDIRECT_URI_PROD || "",
  useProdRedirect: bool(process.env.ML_USE_PROD_REDIRECT, false),
  tokenFile: process.env.ML_TOKEN_FILE || path.resolve(".ml-tokens.enc"),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "",
  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || "",
  maxRetries: Number(process.env.ML_HTTP_MAX_RETRIES || 3),
  requestTimeoutMs: Number(process.env.ML_HTTP_TIMEOUT_MS || 15000),
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
