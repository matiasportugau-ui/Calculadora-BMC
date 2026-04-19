#!/usr/bin/env node
/**
 * Phase C/D — WhatsApp Cloud API: estado de variables y prueba GET de verificación Meta.
 *
 * Lee `.env` del repo (no imprime secretos completos).
 *
 * Uso:
 *   npm run wa:cloud-check
 *   npm run wa:cloud-check -- --probe
 *
 * --probe  → GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=OK_META
 *            contra PUBLIC_BASE_URL (falla exit 1 si no devuelve cuerpo OK_META).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

function maskSecret(v) {
  const s = String(v || "");
  if (!s) return "(vacío)";
  return `(definido, ${s.length} caracteres)`;
}

async function main() {
  const probe = process.argv.includes("--probe");
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
  const verify = process.env.WHATSAPP_VERIFY_TOKEN || "";
  const access = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";

  const webhookUrl = `${publicBaseUrl}/webhooks/whatsapp`;

  console.log("WhatsApp Cloud API — comprobación de repo (Phase C/D)\n");
  console.log("PUBLIC_BASE_URL     ", publicBaseUrl);
  console.log("Webhook callback    ", webhookUrl);
  console.log("WHATSAPP_VERIFY_TOKEN   ", maskSecret(verify));
  console.log("WHATSAPP_ACCESS_TOKEN   ", maskSecret(access));
  console.log("WHATSAPP_PHONE_NUMBER_ID", phoneId ? `${phoneId} (${String(phoneId).length} dígitos/caracteres)` : "(vacío)");
  console.log("WHATSAPP_APP_SECRET     ", appSecret ? maskSecret(appSecret) : "(vacío — HMAC POST deshabilitado, ver warning en logs)");

  const missing = [];
  if (!verify) missing.push("WHATSAPP_VERIFY_TOKEN");
  if (!access) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!phoneId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (missing.length) {
    console.log("\nFaltan variables:", missing.join(", "));
    console.log("Plantilla: .env.example — checklist: docs/team/WHATSAPP-META-E2E.md");
  } else {
    console.log("\nVariables mínimas outbound + verify: OK (longitudes > 0).");
  }

  console.log("\nMeta Developer → WhatsApp → Configuration:");
  console.log("  Callback URL =", webhookUrl);
  console.log("  Verify token   = mismo valor que WHATSAPP_VERIFY_TOKEN (carácter a carácter)");
  console.log("  Webhook fields → messages (mínimo)");

  const curl = `curl -sS "${webhookUrl}?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=OK_META"`;
  console.log("\nPrueba manual GET (sustituí TU_TOKEN):");
  console.log(" ", curl);

  if (!probe) {
    console.log("\nPara ejecutar la prueba GET desde Node: npm run wa:cloud-check -- --probe");
    process.exit(missing.length ? 1 : 0);
  }

  if (!verify) {
    console.error("\n--probe requiere WHATSAPP_VERIFY_TOKEN en .env");
    process.exit(1);
  }

  const base = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  const u = new URL("webhooks/whatsapp", base);
  u.searchParams.set("hub.mode", "subscribe");
  u.searchParams.set("hub.verify_token", verify);
  u.searchParams.set("hub.challenge", "OK_META");

  try {
    const res = await fetch(u.toString(), { method: "GET", redirect: "manual" });
    const text = await res.text();
    const safeUrl = u.toString().replace(encodeURIComponent(verify), "***TOKEN***");
    console.log("\n--probe", safeUrl);
    console.log("HTTP", res.status, "body:", JSON.stringify(text.slice(0, 200)));
    if (res.status === 200 && text === "OK_META") {
      console.log("Resultado: OK (Meta verify handshake coincide con el servidor)\n");
      process.exit(0);
    }
    console.error("Resultado: FALLO (esperado 200 y cuerpo exacto OK_META; 403 = token distinto o servicio viejo)\n");
    process.exit(1);
  } catch (err) {
    console.error("\n--probe fetch error:", err?.message || err);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
