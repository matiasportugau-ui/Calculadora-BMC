#!/usr/bin/env node
/**
 * propagate-change.mjs — Automated propagation engine for BMC/Panelin
 *
 * Full automated run support for changes (e.g. end of a GOAL collector run).
 *
 * Usage examples:
 *   node scripts/propagate-change.mjs \
 *     --title "Product Centralization: Shopify-first collector implemented" \
 *     --area "product-centralization" \
 *     --description "..." \
 *     --auto-next-prompt
 *
 *   # With git auto-detect (recommended in CI/agent runs)
 *   node scripts/propagate-change.mjs --auto-detect --title "..." --auto-next-prompt
 *
 *   # Dry run (no writes)
 *   node scripts/propagate-change.mjs --dry-run --auto-detect ...
 *
 * Features (improved):
 * - Robust markdown table parser for PROJECT-TEAM-FULL-COVERAGE.md §4
 * - Git auto-detection of changed files + last commit (if --auto-detect)
 * - Sophisticated role extraction and matching from propagation table
 * - High-signal PROJECT-STATE.md update (Cambios recientes + Pendientes)
 * - Centralization status doc update for product-centralization area
 * - Detailed .runtime/propagation-report-*.md
 * - Optional ready-to-paste "Updated Literal Next Prompt" handoff
 * - --dry-run support
 * - Follows AGENTS.md + PROJECT-TEAM-FULL-COVERAGE.md §5 exactly
 *
 * Always wrap with `doppler run --` if the run needs secrets (this script itself is pure).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = parseArgs(process.argv.slice(2));

if (!args.title && !args['auto-detect']) {
  console.error(`Usage:
  node scripts/propagate-change.mjs --title "..." --description "..." [options]

Options:
  --title "Short title for Cambios recientes"
  --description "Full description"
  --area "product-centralization|sheets|..."   (affects central doc + matching)
  --files "a.js,b.md,..."                      (comma list; or use --auto-detect)
  --commit "sha"                               (optional)
  --auto-detect                                (use git diff + log for files/commit)
  --dry-run                                    (print actions, do not write files)
  --auto-next-prompt                           (also emit a handoff next-prompt file)

This is the official propagation automate. Call it at the end of any full automated run.`);
  process.exit(1);
}

const now = new Date();
const iso = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = path.join(ROOT, '.runtime', `propagation-report-${iso}.md`);

const isDry = !!args['dry-run'];

console.log('=== BMC Propagation Automate (improved) ===');
console.log(`Title: ${args.title || '(will be derived)'}`);
console.log(`Dry-run: ${isDry}`);

const coveragePath = path.join(ROOT, 'docs/team/PROJECT-TEAM-FULL-COVERAGE.md');
const statePath = path.join(ROOT, 'docs/team/PROJECT-STATE.md');
const centralPath = path.join(ROOT, 'docs/team/PRODUCT-CENTRALIZATION-STATUS.md');

// 1. Load & parse propagation table (robust)
const coverage = fs.readFileSync(coveragePath, 'utf8');
const propagationTable = extractPropagationTableRobust(coverage);

// 2. Auto-detect if requested
let files = args.files || '';
let commit = args.commit || '';

if (args['auto-detect']) {
  try {
    const diff = execSync('git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached 2>/dev/null || echo ""', { encoding: 'utf8', cwd: ROOT }).trim();
    if (diff) files = diff.split('\n').join(',');
    const lastCommit = execSync('git rev-parse --short HEAD 2>/dev/null || echo ""', { encoding: 'utf8', cwd: ROOT }).trim();
    if (lastCommit) commit = lastCommit;
    console.log(`Auto-detected files from git: ${files || '(none)'}`);
  } catch (e) {
    console.warn('Auto-detect git failed (not a repo or no commits):', e.message);
  }
}

if (!args.title && args['auto-detect']) {
  // derive a reasonable title
  args.title = `Automated change: ${files.split(',').slice(0,2).join(', ')}`;
}

// 3. Determine affected roles (improved matching)
const affected = determineAffectedImproved(args.area, files, propagationTable);
console.log('Affected per §4:', affected.length ? affected.join(', ') : 'none (general/internal)');

// 4. Build entry
const entry = buildStateEntryImproved(args, affected, files, commit, iso);

// 5. Perform updates (respect --dry-run)
const actions = [];

if (!isDry) {
  // PROJECT-STATE
  let stateContent = fs.readFileSync(statePath, 'utf8');
  stateContent = insertCambiosRecientes(stateContent, entry);
  if (affected.length > 0) {
    const note = `\n- [ ] Propagation follow-up: ${args.title} — affected ${affected.join(', ')} (see .runtime/propagation-report-${iso}.md)`;
    stateContent = addToPendientes(stateContent, note);
  }
  fs.writeFileSync(statePath, stateContent, 'utf8');
  actions.push('PROJECT-STATE.md (Cambios recientes + Pendientes)');

  // Centralization status (for product-centralization area)
  if (args.area && args.area.toLowerCase().includes('centralization') && fs.existsSync(centralPath)) {
    let central = fs.readFileSync(centralPath, 'utf8');
    const marker = `\n**Collection baseline shipped** — ${now.toISOString().slice(0,10)} via propagation automate (see report-${iso}).`;
    central = central.replace(
      /## 7\. Immediate Recommended Next Steps \(prioritized\)/,
      `## 7. Immediate Recommended Next Steps (prioritized)\n\n${marker}`
    );
    fs.writeFileSync(centralPath, central, 'utf8');
    actions.push('PRODUCT-CENTRALIZATION-STATUS.md (shipped marker)');
  }
} else {
  actions.push('[DRY] Would update PROJECT-STATE.md');
  if (args.area && args.area.toLowerCase().includes('centralization')) {
    actions.push('[DRY] Would mark centralization status shipped');
  }
}

// 6. Always generate report (even in dry)
const report = generateReportImproved(args, affected, propagationTable, files, commit, iso, actions);
if (!isDry) {
  fs.writeFileSync(reportPath, report, 'utf8');
  actions.push(`Report: ${reportPath}`);
} else {
  console.log('--- DRY RUN REPORT PREVIEW ---\n' + report.slice(0, 1200) + '\n...');
}

// 7. Optional next prompt
if (args['auto-next-prompt']) {
  const nextPrompt = generateNextPromptImproved(args, affected, iso);
  const handoffPath = path.join(ROOT, '.runtime', `NEXT-PROMPT-AFTER-${iso}.md`);
  if (!isDry) {
    fs.writeFileSync(handoffPath, nextPrompt, 'utf8');
    actions.push(`Next prompt handoff: ${handoffPath}`);
  } else {
    console.log('--- DRY NEXT PROMPT ---\n' + nextPrompt.slice(0, 800));
  }
}

console.log('\nActions performed:');
actions.forEach(a => console.log('  • ' + a));
console.log('\nPropagation automate complete.');
if (!isDry) {
  console.log('Follow §5.2 in PROJECT-TEAM-FULL-COVERAGE.md for any manual "Log for [Agent]" if needed.');
}
console.log('Tip: run with --auto-detect in agent runs for zero-config usage.');

process.exit(0);

// ==================== IMPROVED HELPERS ====================

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const val = next && !next.startsWith('--') ? next : true;
      out[key] = val;
      if (val !== true) i++;
    }
  }
  return out;
}

function extractPropagationTableRobust(md) {
  const start = md.indexOf('## 4. Propagación de cambios');
  if (start === -1) return [];
  const section = md.slice(start, start + 5000);
  const rows = [];
  const lineRegex = /^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/gm;
  let match;
  while ((match = lineRegex.exec(section)) !== null) {
    const change = match[1].trim();
    const notifyRaw = match[2].trim();
    // Split on arrows, commas, slashes, parentheses
    const notifyParts = notifyRaw
      .split(/→|[,/()]/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && !/según|si aplica|oportunidades/i.test(s));
    rows.push({ change, notify: notifyParts });
  }
  return rows;
}

function determineAffectedImproved(area = '', filesStr = '', table) {
  const affected = new Set();
  const haystack = `${area} ${filesStr}`.toLowerCase();

  const keywordMap = {
    'Sheets|tab|columna|schema|planilla': ['Mapping', 'Design', 'Dependencies'],
    'endpoint|API|server/routes': ['Mapping', 'Design', 'Networks', 'Dependencies'],
    'hosting|URL|deploy|Cloud Run|Vercel': ['Networks', 'Mapping', 'Design', 'Integrations'],
    'OpenAPI|GPT|capabilities': ['GPT/Cloud', 'Integrations', 'Design'],
    'Dashboard|UI|section|frontend': ['Design', 'Mapping', 'Dependencies'],
    'Shopify|ML|integrations|webhooks': ['Integrations', 'Networks', 'Design'],
    'fiscal|billing': ['Fiscal', 'Billing', 'Mapping'],
    'audit|debug': ['Audit', 'Design', 'Networks'],
    'docs|README|reestructura': ['Docs & Repos Organizer', 'Mapping', 'Repo Sync'],
    'centralization|product|collector|shopify': ['Mapping', 'Design', 'Integrations', 'Repo Sync', 'Docs & Repos Organizer'],
  };

  for (const [keywords, roles] of Object.entries(keywordMap)) {
    if (new RegExp(keywords, 'i').test(haystack)) {
      roles.forEach(r => affected.add(r));
    }
  }

  // Direct table match for precision
  for (const row of table) {
    const changeLower = row.change.toLowerCase();
    if (haystack.includes(changeLower.split(' ')[0]) || haystack.includes(changeLower)) {
      row.notify.forEach(n => affected.add(n));
    }
  }

  // Always pull in the core sync machinery for any non-trivial change
  if (affected.size > 0 || haystack.length > 10) {
    ['Project Team Sync', 'Repo Sync', 'Docs & Repos Organizer'].forEach(r => affected.add(r));
  }

  return Array.from(affected);
}

function buildStateEntryImproved(args, affected, files, commit, iso) {
  const date = iso.slice(0, 10);
  const shortFiles = files.split(',').slice(0, 3).join(', ') + (files.split(',').length > 3 ? '…' : '');
  const aff = affected.length ? affected.join(', ') : 'internal (core sync only)';
  const commitStr = commit ? ` (commit ${commit})` : '';

  return `**${date} (Product Centralization — Shopify-first collector + automated propagation):** ${args.title}. ${args.description || ''} Files: ${shortFiles}${commitStr}. Propagation (§4): affected ${aff}. Full report: \`.runtime/propagation-report-${iso}.md\`. Completes collection baseline per PRODUCT-CENTRALIZATION-STATUS.md.`;
}

function insertCambiosRecientes(stateMd, newEntry) {
  const header = '## Cambios recientes';
  const idx = stateMd.indexOf(header);
  if (idx === -1) return stateMd + '\n\n' + header + '\n\n' + newEntry + '\n';

  const after = idx + header.length;
  const rest = stateMd.slice(after);
  // Find first ** entry after header
  const first = rest.match(/\n(\*\*)/);
  const pos = first ? after + first.index + 1 : after + 2;
  return stateMd.slice(0, pos) + newEntry + '\n' + stateMd.slice(pos);
}

function addToPendientes(stateMd, note) {
  const pend = '## Pendientes de sincronización';
  if (!stateMd.includes(pend)) {
    return stateMd + '\n\n' + pend + '\n' + note + '\n';
  }
  const i = stateMd.indexOf(pend);
  const lineEnd = stateMd.indexOf('\n', i + pend.length);
  return stateMd.slice(0, lineEnd + 1) + note + '\n' + stateMd.slice(lineEnd + 1);
}

function generateReportImproved(args, affected, table, files, commit, iso, actions) {
  let md = `# Propagation Report — ${iso}\n\n`;
  md += `**Title:** ${args.title}\n\n`;
  md += `**Description:** ${args.description}\n\n`;
  md += `**Area:** ${args.area || 'general'}\n`;
  md += `**Files:** ${files || 'auto-detected'}\n`;
  md += `**Commit:** ${commit || 'N/A'}\n\n`;

  md += `## §4 Propagation Results\n\n`;
  if (affected.length) {
    md += affected.map(a => `- ${a}`).join('\n') + '\n\n';
  } else {
    md += 'No specific rows matched — core sync roles still engaged.\n\n';
  }

  md += `## Automated Actions\n\n`;
  actions.forEach(a => md += `- ${a}\n`);

  md += `\nGenerated by scripts/propagate-change.mjs (improved version) at ${new Date().toISOString()}\n`;
  return md;
}

function generateNextPromptImproved(args, affected, iso) {
  return `# Updated Literal Next Prompt (post-propagation of "${args.title}")

Read:
- docs/team/PRODUCT-CENTRALIZATION-STATUS.md (now marked shipped)
- docs/team/PROJECT-STATE.md (latest entry + propagation report)
- .runtime/propagation-report-${iso}.md

Previous full automated run (collector + propagation) is complete.

Recommended next (choose or run multiple in parallel with subagents):
1. Implement first outbound publish worker (Shopify variants/inventory + price push) driven by panelinEvents.
2. Add Caucadi collector stub once details are provided.
3. Enhance panelin-platform dashboard or /hub with rich meta editor (tech specs + images gallery).
4. Decide pricing source strategy for the calculator (Panelin PG live vs constants bake) and implement resilient fallback.
5. Full team run on the centralization work (invoke "Equipo completo").

Rules: doppler run -- for all secret commands, gate:local (relevant), update PROJECT-STATE, call propagate-change.mjs again at the end of the next run.

Literal next prompt ready for copy-paste into a new goal session.`;
}
