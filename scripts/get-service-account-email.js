#!/usr/bin/env node
/**
 * Print service account email for Atlas Browser prompt.
 * Run: node scripts/get-service-account-email.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "docs/bmc-dashboard-modernization/service-account.json");
const c = JSON.parse(fs.readFileSync(p, "utf8"));
console.log(c.client_email);
