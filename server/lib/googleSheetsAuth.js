/**
 * Google Sheets auth for BMC.
 * Doppler/local often stores the service-account JSON *inline* in
 * GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_SHEETS_CREDENTIALS. Cloud Run
 * usually mounts a file path. Treat both.
 */
import { google } from "googleapis";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * @param {string} raw
 * @returns {{ mode: "adc" } | { mode: "json", credentials: object } | { mode: "file", keyFile: string }}
 */
export function parseGoogleCreds(raw) {
  const s = String(raw || "").trim();
  if (!s) return { mode: "adc" };
  if (s.startsWith("{")) {
    try {
      const credentials = JSON.parse(s);
      if (credentials && typeof credentials === "object" && credentials.type === "service_account") {
        return { mode: "json", credentials };
      }
    } catch {
      /* fall through */
    }
  }
  return { mode: "file", keyFile: s };
}

/** Never send SA JSON / private keys back to models or voice TTS. */
export function redactGoogleError(msg) {
  const s = String(msg || "");
  if (
    /BEGIN PRIVATE KEY/i.test(s) ||
    /"private_key"/i.test(s) ||
    /"type"\s*:\s*"service_account"/i.test(s) ||
    /The file at \{\s*"type"/i.test(s)
  ) {
    return "Google Sheets: credenciales mal formadas (JSON de service account usado como path de archivo).";
  }
  return s.slice(0, 280);
}

export function googleCredsEnvRaw() {
  return (
    process.env.GOOGLE_SHEETS_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    ""
  );
}

/** Args for `new google.auth.GoogleAuth(...)` from parseGoogleCreds. */
export function googleAuthOptionsFromParsed(parsed, scopes) {
  const scopeList = Array.isArray(scopes) ? scopes : [scopes];
  if (parsed?.mode === "json") return { credentials: parsed.credentials, scopes: scopeList };
  if (parsed?.mode === "file") return { keyFile: parsed.keyFile, scopes: scopeList };
  return { scopes: scopeList };
}

export async function getSheetsClient(scopes = [SCOPE]) {
  const parsed = parseGoogleCreds(googleCredsEnvRaw());
  const auth = new google.auth.GoogleAuth(googleAuthOptionsFromParsed(parsed, scopes));
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}
