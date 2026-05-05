/**
 * WA Cockpit — Generador de documentación de configuración desde el schema Zod.
 *
 * Uso: node scripts/wa-gen-config-docs.mjs
 */

import { describeSchema } from "../server/lib/waConfigSchema.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, "../docs/wa-cockpit/CONFIG-REFERENCE.md");

function main() {
  const { flags, settings } = describeSchema();

  let md = `# WA Module Config Reference\n\n`;
  md += `*Documentación auto-generada desde \`server/lib/waConfigSchema.js\`.*\n\n`;

  md += `## Feature Flags\n\n`;
  md += `| Key | Default | Descripción |\n`;
  md += `|-----|---------|-------------|\n`;
  for (const f of flags) {
    md += `| \`${f.key}\` | \`${f.default}\` | ${f.description} |\n`;
  }

  md += `\n## Runtime Settings\n\n`;
  md += `| Key | Type | Default | Descripción |\n`;
  md += `|-----|------|---------|-------------|\n`;
  for (const s of settings) {
    md += `| \`${s.key}\` | \`${s.type}\` | \`${JSON.stringify(s.default)}\` | ${s.description} |\n`;
  }

  md += `\n## Precedencia\n\n`;
  md += `1. **Operator Override**: \`wa_settings\` con \`scope='operator'\`.\n`;
  md += `2. **Tenant Setting**: \`wa_settings\` con \`scope='tenant'\`.\n`;
  md += `3. **Environment Variable**: Fallback para bootstrap inicial.\n`;
  md += `4. **Schema Default**: Valor definido en el código.\n`;

  fs.writeFileSync(OUT_FILE, md);
  console.log(`✓ Docs generadas en: ${OUT_FILE}`);
}

main();
