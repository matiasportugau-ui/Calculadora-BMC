#!/usr/bin/env node
/**
 * Onboarding canales (orden: ya documentado en docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md):
 *  1) smoke:prod
 *  2) project:compass
 *
 * Uso:
 *   npm run channels:onboarding
 *   npm run channels:onboarding -- --skip-smoke
 *   npm run channels:onboarding -- --skip-compass
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DOC = path.join(ROOT, "docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md");

function main() {
  const argv = process.argv.slice(2);
  const skipSmoke = argv.includes("--skip-smoke");
  const skipCompass = argv.includes("--skip-compass");

  if (!skipSmoke) {
    console.log("─── 1/2 Smoke producción (npm run smoke:prod) ───\n");
    execSync("npm run smoke:prod", { cwd: ROOT, stdio: "inherit" });
    console.log("");
  }

  if (!skipCompass) {
    console.log("─── 2/2 Brújula programa (npm run project:compass) ───\n");
    execSync("npm run project:compass", { cwd: ROOT, stdio: "inherit" });
    console.log("");
  }

  const runbook = path.join(ROOT, "docs/team/orientation/ASYNC-RUNBOOK-UNATTENDED.md");
  console.log("─── Siguiente ───");
  console.log(`Documento canónico (pasos WhatsApp → ML → Correo):`);
  console.log(`  ${DOC}`);
  console.log("");
  console.log("Runbook asíncrono (pipeline completo, H0/A/H):");
  console.log(`  ${runbook}`);
  console.log("");
  console.log("Abrí ese archivo en el editor o con: less docs/team/PROCEDIMIENTO-CANALES-WA-ML-CORREO.md");
  console.log("");
}

main();
