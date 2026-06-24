#!/usr/bin/env node
/**
 * Rotate API_AUTH_TOKEN (dry-run by default).
 *
 * Usage:
 *   node scripts/rotate-api-auth-token.mjs           # print new token + steps
 *   node scripts/rotate-api-auth-token.mjs --apply   # update Cloud Run panelin-calc (requires gcloud)
 *
 * After rotation, also update: local .env, Vercel env (if VITE_API_AUTH_TOKEN),
 * GitHub secrets, Custom GPT / MCP consumers, EMAIL_INGEST_TOKEN if aliased.
 */

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const SERVICE = process.env.BMC_CLOUD_RUN_SERVICE || "panelin-calc";
const REGION = process.env.BMC_CLOUD_RUN_REGION || "us-central1";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "";

const apply = process.argv.includes("--apply");
const newToken = randomBytes(32).toString("hex");

console.log("API_AUTH_TOKEN rotation");
console.log("=======================");
console.log(`New token (64 hex chars): ${newToken}`);
console.log("");

if (!apply) {
  console.log("Dry-run — pass --apply to push to Cloud Run.");
  console.log("");
}

const gcloudCmd = [
  "gcloud run services update",
  SERVICE,
  `--region=${REGION}`,
  PROJECT ? `--project=${PROJECT}` : "",
  `--update-env-vars=API_AUTH_TOKEN=${newToken},API_KEY=${newToken}`,
].filter(Boolean).join(" ");

console.log("Cloud Run:");
console.log(`  ${gcloudCmd}`);
console.log("");
console.log("Local .env:");
console.log("  API_AUTH_TOKEN=<new token>");
console.log("  API_KEY=<same value>");
console.log("");
console.log("Optional Vite (dev/CI only — hub uses JWT in prod):");
console.log("  VITE_API_AUTH_TOKEN=<new token>");
console.log("");
console.log("Consumers to refresh: GitHub Actions secrets, Custom GPT Actions, MCP BMC_API_BASE bearer, email ingest if shared.");

if (apply) {
  console.log("");
  console.log("Applying to Cloud Run…");
  execSync(gcloudCmd, { stdio: "inherit" });
  console.log("Done. Update local .env and external consumers before revoking the old token.");
}