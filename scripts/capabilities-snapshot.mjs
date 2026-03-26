#!/usr/bin/env node
/**
 * Writes docs/api/AGENT-CAPABILITIES.json from server/agentCapabilitiesManifest.js.
 *
 * Does not load server/config.js (avoids .env overriding the snapshot base).
 *
 * Base URL order:
 *   CAPABILITIES_SNAPSHOT_BASE → PUBLIC_BASE_URL → canonical Cloud Run host.
 *
 * Usage:
 *   npm run capabilities:snapshot
 *   CAPABILITIES_SNAPSHOT_BASE=https://api.example.com npm run capabilities:snapshot
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentCapabilitiesManifest } from "../server/agentCapabilitiesManifest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const canonicalProd = "https://panelin-calc-q74zutv7dq-uc.a.run.app";
const publicBaseUrl =
  process.env.CAPABILITIES_SNAPSHOT_BASE ||
  process.env.PUBLIC_BASE_URL ||
  canonicalProd;

const manifest = buildAgentCapabilitiesManifest({ publicBaseUrl });
const out = path.join(root, "docs/api/AGENT-CAPABILITIES.json");
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${out} (public_base_url=${manifest.public_base_url})`);
