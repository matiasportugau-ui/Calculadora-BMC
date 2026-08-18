/**
 * WhatsApp Drive knowledge pack — offline integrity.
 * Every MANIFEST path exists, knowledge files are non-empty, no secret assignments.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const packRoot = path.join(repoRoot, "docs/team/connectors/whatsapp-drive");
const manifestPath = path.join(packRoot, "MANIFEST.json");

const SECRET_ASSIGNMENT =
  /\b(WHATSAPP_ACCESS_TOKEN|WHATSAPP_APP_SECRET|WHATSAPP_VERIFY_TOKEN|GOOGLE_DRIVE_REFRESH_TOKEN|GOOGLE_DRIVE_CLIENT_SECRET|WA_JWT_SECRET|API_AUTH_TOKEN)\s*=\s*[^\s#]+/;

let passed = 0;
let failed = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

const raw = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);
check("MANIFEST.json parses", !!manifest && manifest.id === "whatsapp-drive-connector-kb");
check("read_order is a non-empty array", Array.isArray(manifest.read_order) && manifest.read_order.length > 0);
check("layers object present", !!manifest.layers && typeof manifest.layers === "object");
check("files array present", Array.isArray(manifest.files) && manifest.files.length > 0);

const collected = new Set();
for (const rel of manifest.read_order || []) collected.add(rel);
for (const files of Object.values(manifest.layers || {})) {
  check(`layer is array (${files?.length ?? 0})`, Array.isArray(files));
  for (const rel of files || []) collected.add(rel);
}
for (const entry of manifest.files || []) {
  check(`files[].path is string (${entry?.path || "?"})`, typeof entry?.path === "string" && entry.path.length > 0);
  if (entry?.path) collected.add(entry.path);
}

const expectedKnowledge = [
  "knowledge/00-identity-and-rules.md",
  "knowledge/01-whatsapp-inbound.md",
  "knowledge/02-whatsapp-outbound.md",
  "knowledge/03-wa-cockpit-and-omni.md",
  "knowledge/04-env-and-secrets.md",
  "knowledge/05-drive-auth-and-scopes.md",
  "knowledge/06-drive-quote-archive.md",
  "knowledge/07-drive-folder-conventions.md",
  "knowledge/08-ai-context-stack.md",
  "knowledge/09-quote-wa-drive-exports.md",
  "knowledge/10-media-gcs-vs-drive.md",
  "knowledge/11-gaps-and-non-goals.md",
  "knowledge/12-operator-playbook.md",
];
for (const rel of expectedKnowledge) {
  check(`required knowledge listed in MANIFEST: ${rel}`, collected.has(rel));
}

for (const rel of [...collected].sort()) {
  const abs = path.join(packRoot, rel);
  const exists = fs.existsSync(abs) && fs.statSync(abs).isFile();
  check(`exists: ${rel}`, exists);
  if (!exists) continue;
  const text = fs.readFileSync(abs, "utf8");
  check(`non-empty: ${rel}`, text.trim().length > 80);
  check(`no secret assignment: ${rel}`, !SECRET_ASSIGNMENT.test(text));
}

const skill = path.join(repoRoot, ".cursor/skills/whatsapp-drive-connector/SKILL.md");
const rule = path.join(repoRoot, ".cursor/rules/bmc-whatsapp-drive-company-knowledge-first.mdc");
const stub = path.join(repoRoot, "docs/team/knowledge/WhatsAppDrive.md");
check("skill file exists", fs.existsSync(skill));
check("cursor rule exists", fs.existsSync(rule));
check("role stub exists", fs.existsSync(stub));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
