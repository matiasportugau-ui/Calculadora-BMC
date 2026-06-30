#!/usr/bin/env node
/**
 * Copy design-competition static HTML into public/design-preview for Vercel preview deploys.
 * Run: npm run design-preview:sync-static
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "docs/team/design-competition");
const dest = join(root, "public/design-preview");

if (!existsSync(src)) {
  console.error("Missing source:", src);
  process.exit(1);
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log("Synced", src, "→", dest);
