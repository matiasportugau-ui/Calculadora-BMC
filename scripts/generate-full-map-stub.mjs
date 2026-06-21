#!/usr/bin/env node
/**
 * Enhanced Regeneration Script for FULL-FUNCTION-MAP-AND-100PCT-EVALUATION
 *
 * Best practice: living doc + codegen hybrid.
 * - Greps key surfaces for functions, routes, exports, templates, tools, components.
 * - Outputs fresh JSON to .runtime/full-map-inventory-YYYY-MM-DD.json
 * - Generates Markdown snippets suitable for pasting/appending to the master doc.
 * - Supports --update (experimental: could sed into doc in future).
 * - Integrates with package.json via "map:regen" script suggestion.
 *
 * Usage:
 *   node scripts/generate-full-map-stub.mjs [--json] [--calc] [--auth] [--integrations] [--all] [--update]
 *
 * Best practices observed in repo (and recommended here):
 * - Tie to CI/gates (e.g., in pre-deploy or test:api).
 * - Version output with git SHA + date.
 * - Cross-ref tests/contracts (grep for test files covering functions).
 * - Runtime health: call smoke + capabilities as part of regen.
 * - Human review: script suggests, human merges (avoids over-automation on complex app).
 * - Modularity: one script per major area or extensible with plugins (future).
 *
 * Extend: add acorn/esprima for real AST parsing, or ts-morph for TS/JSX.
 * Run after PRs touching calc, auth, integrations, pdf-templates, agentTools, routes.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const emitJsonOnly = args.includes('--json');
const focusCalc = args.includes('--calc') || args.includes('--all');
const focusAuth = args.includes('--auth') || args.includes('--all');
const focusIntegrations = args.includes('--integrations') || args.includes('--all');
const doUpdate = args.includes('--update');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.runtime');
const date = new Date().toISOString().slice(0,10);
const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const OUT_JSON = path.join(OUT_DIR, `full-map-inventory-${date}.json`);
const OUT_SNIPPETS = path.join(OUT_DIR, `full-map-snippets-${date}.md`);

function grep(pattern, glob = '', pathFilter = '.', limit = 50) {
  try {
    const cmd = `grep -r --line-number --include="*.js" --include="*.jsx" --include="*.mjs" -E "${pattern}" ${pathFilter} ${glob ? `--include="${glob}"` : ''} | head -${limit}`;
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function runSmoke() {
  try {
    return execSync('npm run smoke:prod -- --json 2>/dev/null || npm run smoke:prod 2>&1 | head -30', { encoding: 'utf8' }).trim();
  } catch (e) {
    return 'smoke failed or skipped (IA 503 expected in some envs)';
  }
}

console.log('=== Enhanced Full Map Stub Generator ===');
console.log(`Date: ${date} | Commit: ${sha}`);
console.log('Focusing:', focusCalc && 'calc ', focusAuth && 'auth ', focusIntegrations && 'integrations ', '(use --all for everything)');

const inventory = {
  generated_at: new Date().toISOString(),
  commit: sha,
  runtime: { smoke: runSmoke() },
  surfaces: {}
};

// === Calc Engine Deeper Dive ===
if (focusCalc || args.length === 0) {
  inventory.surfaces.calc_engine = {
    data: grep('^export (const |let |function |class )', '', 'src/data/constants.js src/data/pricing.js', 30),
    pure_fns: grep('^export function ', '', 'src/utils/calculations.js', 40),
    bom: grep('^export function ', '', 'src/utils/bomCosting.js', 20),
    roof: grep('^export function |^export const ', '', 'src/utils/roof*.js', 30),
    server: grep('calcTecho|calcPared|mergeZona|presup', '', 'server/routes/calc.js server/lib/budget.js', 15),
    tests: grep('calcTechoCompleto|calcParedCompleto|mergeZonaResults', '', 'tests/', 20),
    calls_in_ui: grep('calcTechoCompleto|calcParedCompleto', '', 'src/components/PanelinCalculadoraV3_backup.jsx', 10),
  };
  console.log('Calc: extracted ~' + (inventory.surfaces.calc_engine.pure_fns.length + inventory.surfaces.calc_engine.bom.length) + ' fns + tests');
}

// === Auth/RBAC Matrix ===
if (focusAuth || args.length === 0) {
  inventory.surfaces.auth_rbac = {
    middleware: grep('^export |module.exports', '', 'server/middleware/', 20),
    identity: grep('^export function |^export async function |requireUser', '', 'server/lib/identityAuth.js', 30),
    grants: grep('requireGrant|requireUser|requireServiceOrUser', '', 'server/routes/ server/lib/', 30),
    roles: grep('ROLE_RANK|LEVEL_RANK|ALL_MODULES|superadmin', '', 'server/lib/identityAuth.js', 10),
    examples: grep('requireUser\\(|requireGrant\\(', '', 'server/routes/bmcDashboard.js server/routes/wa.js', 15),
    mfa: grep('^export |initAuthMfa', '', 'server/routes/authMfa.js', 10),
  };
  console.log('Auth: ' + inventory.surfaces.auth_rbac.middleware.length + ' middleware + ' + inventory.surfaces.auth_rbac.identity.length + ' identity fns');
}

// === Integrations ===
if (focusIntegrations || args.length === 0) {
  inventory.surfaces.integrations = {
    ml: grep('^export |createMercadoLibreClient|requestWithRetries', '', 'server/mercadoLibreClient.js server/ml-*.js', 20),
    wa: grep('^export function |^export async function |startWa|runWaQuote|initWa', '', 'server/lib/*wa*.js server/routes/wa.js', 30),
    drive_tasks: grep('^export |uploadQuoteToDrive|googleTasksClient', '', 'server/lib/driveUpload.js server/lib/google*.js', 15),
    shopify_transport: grep('^export |createShopifyRouter|createTransportistaRouter', '', 'server/routes/shopify.js server/routes/transportista.js', 10),
    traktime: grep('^export |createTraktimeRouter|traktime', '', 'server/routes/traktime.js server/lib/traktime*.js', 15),
    market_intel: grep('^export |scraper|dedup|alerts', '', 'server/lib/marketIntel/', 15),
  };
  console.log('Integrations: ML/WA/Drive/Shopify/Transportista/Traktime/MarketIntel covered');
}

// === PDF / Brand / Templates (always useful) ===
inventory.surfaces.pdf_brand = {
  templates: grep('^export |LAYOUT_OPTIONS|recommended|BRAND|003366', '', 'src/pdf-templates/', 25),
  generator: grep('^export |pdfGenerator|quotationViews', '', 'src/utils/pdfGenerator.js src/utils/quotationViews.js', 15),
  ui: grep('pdfLayout|LAYOUT_OPTIONS|Diseño PDF', '', 'src/components/PanelinCalculadoraV3_backup.jsx', 10),
};

// === Agent Tools ===
inventory.surfaces.agent = {
  tools: grep('AGENT_TOOLS|executeTool|tool_use', '', 'server/lib/agentTools.js', 10),
  core: grep('^export |callAgentOnce', '', 'server/lib/agentCore.js', 10),
  rag: grep('^export |retrieveSimilarQuotes', '', 'server/lib/rag.js', 10),
};

// === Frontend Components ===
inventory.surfaces.frontend = {
  main: grep('^export default function |^export function ', '', 'src/components/PanelinCalculadoraV3_backup.jsx', 30),
  hubs: grep('^export default function ', '', 'src/components/Bmc*.jsx src/components/*Module.jsx', 20),
  roof: grep('^export |^export default ', '', 'src/components/roofPlan/ src/components/RoofPreview.jsx', 15),
};

// Write JSON
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(inventory, null, 2));
console.log(`Wrote JSON to ${OUT_JSON}`);

// Generate MD snippets (best practice: human-curated paste)
let snippets = `# Generated Snippets for FULL-FUNCTION-MAP (commit ${sha}, ${date})

## Suggested Calc Deeper Dive Addition
\`\`\`js
// From calculations.js + bomCosting.js + tests
${inventory.surfaces.calc_engine?.pure_fns?.slice(0,5).join('\n') || ''}
... (paste full from JSON)
\`\`\`

## Suggested Auth Matrix Addition
Use the table from previous master doc version + new grants from identity.

## Suggested Integrations Addition
\`\`\`js
// WA
${inventory.surfaces.integrations?.wa?.slice(0,3).join('\n') || ''}
// ML
${inventory.surfaces.integrations?.ml?.slice(0,2).join('\n') || ''}
\`\`\`

## Regeneration Command (add to package.json)
"map:regen": "node scripts/generate-full-map-stub.mjs --all",

Best practice note: Run this + manual review + smoke:prod + browser spot-check before major PRs. Cross-ref test:api results and runtime health.
`;

fs.writeFileSync(OUT_SNIPPETS, snippets);
console.log(`Wrote MD snippets to ${OUT_SNIPPETS}`);

if (doUpdate) {
  console.log('Note: --update is stub; in production would intelligently patch the master MD (use git diff + review).');
}

console.log('\nDone. Best practice: treat as living artifact + human gate. Enhance further with AST parsing for precision.');
