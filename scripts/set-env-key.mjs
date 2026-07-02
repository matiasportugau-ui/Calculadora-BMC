#!/usr/bin/env node
/**
 * set-env-key.mjs — safely upsert one .env key (value from argv or stdin, never echoed).
 *
 * Usage:
 *   node scripts/set-env-key.mjs GOOGLE_CLIENT_SECRET 'GOCSPX-...'
 *   printf '%s' 'GOCSPX-...' | node scripts/set-env-key.mjs GOOGLE_CLIENT_SECRET
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const key = process.argv[2];
let value = process.argv[3] || "";

if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key)) {
  process.stderr.write("Usage: node scripts/set-env-key.mjs KEY [VALUE]\n");
  process.exit(1);
}

if (!value && !process.stdin.isTTY) {
  value = await new Promise((res) => {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => res(Buffer.concat(chunks).toString("utf8").trim()));
  });
}

if (!value) {
  process.stderr.write(`[set-env-key] empty value for ${key}\n`);
  process.exit(1);
}

const ENV_PATH = resolve(import.meta.dirname, "..", ".env");
// Read directly (no existsSync-then-read TOCTOU window) — a missing file just
// means "no existing content yet", same as the prior existsSync guard.
let text = "";
try {
  text = readFileSync(ENV_PATH, "utf8");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
// key is already validated against /^[A-Z][A-Z0-9_]*$/ above, so it can't carry
// regex metacharacters — escaped anyway as defense-in-depth against that
// validation ever loosening.
const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=.*$`, "m");
const line = `${key}=${value}`;
if (re.test(text)) text = text.replace(re, line);
else {
  if (text.length && !text.endsWith("\n")) text += "\n";
  text += `\n# set-env-key\n${line}\n`;
}
writeFileSync(ENV_PATH, text, "utf8");
process.stderr.write(`[set-env-key] ${key} updated (${value.length} chars)\n`);