#!/usr/bin/env node
/**
 * Productos Maestro — Reconcile (gaps entre MATRIZ precios y Stock E-Commerce)
 *
 * Uso (recomendado):
 *   npm run productos-maestro:reconcile
 *   BMC_API_BASE=... npm run productos-maestro:reconcile
 *
 * Opciones:
 *   --json            → salida JSON completa
 *   --write-links     → (futuro) escribe un template de links en .runtime/
 *
 * Salida:
 *   .runtime/productos-maestro-reconcile-YYYY-MM-DDTHH-mm-ssZ.{json,md}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  reconcileProductosMaestro,
  saveLinks,
} from '../server/lib/productosMaestro.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const writeLinksTemplate = args.includes('--write-links');

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + 'Z';
}

async function main() {
  console.log('🔎 Productos Maestro — Reconcile (MATRIZ + Stock + links)...\n');

  const report = await reconcileProductosMaestro();

  const outDir = path.join(repoRoot, '.runtime');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = ts();
  const jsonFile = path.join(outDir, `productos-maestro-reconcile-${stamp}.json`);
  const mdFile = path.join(outDir, `productos-maestro-reconcile-${stamp}.md`);

  fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2), 'utf8');

  // Markdown human-readable
  const md = [
    `# Productos Maestro — Reporte de Gaps`,
    ``,
    `**Generado:** ${report.meta?.generatedAt || new Date().toISOString()}`,
    `**Matriz source:** ${report.meta?.matrizSource || '—'}`,
    `**Stock source:** ${report.meta?.stockSource || '—'}`,
    `**Links conocidos:** ${report.meta?.linksCount || 0}`,
    ``,
    `## Resumen`,
    ``,
    `| Métrica              | Valor |`,
    `|----------------------|-------|`,
    `| Total unificados     | ${report.summary.total} |`,
    `| Vinculados (linked)  | ${report.summary.linked} |`,
    `| Solo MATRIZ          | ${report.summary.matrizOnly} |`,
    `| Solo Stock           | ${report.summary.stockOnly} |`,
    `| Cobertura de links   | ${(report.summary.linkCoverage * 100).toFixed(1)}% |`,
    ``,
    `## Gaps — Solo MATRIZ (tienen precio, falta link a stock)`,
    ``,
  ];

  if (report.gaps.matrizOnly.length === 0) {
    md.push('_Ninguno_');
  } else {
    md.push('| SKU | Path |');
    md.push('|-----|------|');
    for (const g of report.gaps.matrizOnly.slice(0, 50)) {
      md.push(`| ${g.sku || '—'} | \`${g.path}\` |`);
    }
    if (report.gaps.matrizOnly.length > 50) md.push(`\n... y ${report.gaps.matrizOnly.length - 50} más`);
  }

  md.push(``, `## Gaps — Solo Stock (tienen inventario, falta SKU/path en MATRIZ)`, ``);

  if (report.gaps.stockOnly.length === 0) {
    md.push('_Ninguno_');
  } else {
    md.push('| CODIGO | Producto | Stock |');
    md.push('|--------|----------|-------|');
    for (const g of report.gaps.stockOnly.slice(0, 50)) {
      md.push(`| ${g.codigo} | ${g.nombre?.slice(0, 40) || ''} | ${g.stock?.actual ?? ''} |`);
    }
    if (report.gaps.stockOnly.length > 50) md.push(`\n... y ${report.gaps.stockOnly.length - 50} más`);
  }

  md.push(``, `## Vinculados (ok)`, ``);
  md.push(`**${report.summary.linked}** productos con cruce confirmado vía links.`);

  md.push(``, `---`, `Archivo JSON completo: ${path.relative(repoRoot, jsonFile)}`);

  fs.writeFileSync(mdFile, md.join('\n'), 'utf8');

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`✅ Reporte generado:`);
    console.log(`   ${path.relative(repoRoot, jsonFile)}`);
    console.log(`   ${path.relative(repoRoot, mdFile)}`);
    console.log(``);
    console.log(`Resumen rápido:`);
    console.log(`  Total: ${report.summary.total} | Linked: ${report.summary.linked} | Solo MATRIZ: ${report.summary.matrizOnly} | Solo Stock: ${report.summary.stockOnly}`);
  }

  if (writeLinksTemplate) {
    // Escribe un template de links vacío con los SKUs de MATRIZ-only para que el humano complete
    const template = {};
    for (const g of report.gaps.matrizOnly) {
      if (g.sku) template[g.sku] = '';
    }
    const tplFile = path.join(outDir, `product-links.template-${stamp}.json`);
    fs.writeFileSync(tplFile, JSON.stringify({ links: template, note: 'Completa los valores de CODIGO (Stock) para cada SKU' }, null, 2));
    console.log(`\n📝 Template de links generado: ${path.relative(repoRoot, tplFile)}`);
    console.log(`   Cópialo a .runtime/product-links.json y completa los CODIGOs.`);
  }

  // Exit code útil para CI
  const hasCriticalGaps = report.summary.stockOnly > 20; // arbitrario; ajustar según negocio
  if (hasCriticalGaps && !asJson) {
    console.warn(`\n⚠️  Hay ${report.summary.stockOnly} productos en Stock sin link a MATRIZ.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error en reconcile-productos-maestro:', err);
  process.exit(1);
});
