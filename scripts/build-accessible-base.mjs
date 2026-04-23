#!/usr/bin/env node
/**
 * build-accessible-base.mjs
 * Compiles all project knowledge into .accessible-base/kb.json —
 * a dense, AI-optimized KB the model loads instead of reading 5+ docs.
 *
 * Sources: ROADMAP.md, PROJECT-STATE.md, package.json, git state,
 *          .accessible-base/manifest.json (sheets sync data)
 *
 * Output : .accessible-base/kb.json   (gitignored — local runtime)
 *          observability report to stdout
 *
 * Usage  : npm run kb:build
 *          node scripts/build-accessible-base.mjs --quiet
 */

import { execSync }                            from 'child_process';
import { readFileSync, writeFileSync,
         existsSync, mkdirSync }               from 'fs';
import { join, dirname }                       from 'path';
import { fileURLToPath }                       from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const BASE_DIR  = join(ROOT, '.accessible-base');
const QUIET     = process.argv.includes('--quiet');
const t0        = Date.now();

// ── helpers ──────────────────────────────────────────────────────────────────
const log  = (msg) => { if (!QUIET) process.stdout.write(msg + '\n'); };
const read = (rel) => { try { return readFileSync(join(ROOT, rel), 'utf8'); } catch { return null; } };
const git  = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
const prev = () => { try { return JSON.parse(readFileSync(join(BASE_DIR, 'kb.json'), 'utf8')); } catch { return null; } };

// ── 1. git state ─────────────────────────────────────────────────────────────
const branch    = git('git branch --show-current') || 'main';
const rawLog    = git('git log --oneline -1');
const lastHash  = rawLog.split(' ')[0];
const lastMsg   = rawLog.slice(lastHash.length + 1).trim();
const uncommit  = git('git status --short').split('\n').filter(Boolean).length;

// ── 2. package.json ───────────────────────────────────────────────────────────
const pkg = JSON.parse(read('package.json') || '{}');

// ── 3. ROADMAP.md — score + areas + roadmap items ────────────────────────────
const roadmapRaw = read('docs/team/ROADMAP.md') || '';

// Latest score from history table (last matching row wins)
// Pattern: | YYYY-MM-DD | ...anything... N/100 | — avoids emoji Unicode issues
const scoreRows  = [...roadmapRaw.matchAll(/\|\s*\d{4}-\d{2}-\d{2}\s*\|[^|]*?(\d+)\/100/g)];
const score      = scoreRows.length ? parseInt(scoreRows.at(-1)[1]) : 77;

// Areas table — parse markdown rows
const areas = [];
const areaTableMatch = roadmapRaw.match(/\| Área \| Calidad[\s\S]*?\n\n/);
if (areaTableMatch) {
  areaTableMatch[0].split('\n').slice(2).forEach(row => {
    const cols = row.split('|').map(s => s.trim()).filter(Boolean);
    if (cols.length >= 4) {
      const q = (cols[1].match(/(\d+)\/10/) || [])[1];
      const c = (cols[2].match(/(\d+)\/10/) || [])[1];
      if (q) areas.push({ label: cols[0], q: +q, c: +c, status: cols[3] });
    }
  });
}

// Roadmap items — extract numbered steps with priority labels
const roadmapItems = [];
const stepRe = /###\s+(🔴 CRÍTICO|🟠 ALTO|🟡 MEDIO|🔵 BAJO)\s*\|\s*\d+\.\s*(.+)\n[\s\S]*?- \*\*Acción[^:]*\*\*:\s*([^\n]+)/g;
let m;
while ((m = stepRe.exec(roadmapRaw)) !== null) {
  roadmapItems.push({ priority: m[1], title: m[2].trim(), action: m[3].trim() });
}

// ── 4. PROJECT-STATE.md — gates + recent changes ─────────────────────────────
const psRaw = read('docs/team/PROJECT-STATE.md') || '';
const gate  = (label) => new RegExp(`${label}.*done`, 'i').test(psRaw) ? 'DONE' : 'PENDING_HUMAN';
const cm0   = gate('cm-0');
const cm1   = gate('cm-1');
const cm2   = gate('cm-2');

// Recent changes: first entry from "## Cambios recientes"
const recentMatch = psRaw.match(/## Cambios recientes\s*\n\s*\n?\*\*([^*]+)\*\*/);
const lastChange  = recentMatch ? recentMatch[1].trim() : null;

// ── 5. Sheets manifest ────────────────────────────────────────────────────────
const manifest    = JSON.parse(read('.accessible-base/manifest.json') || '{}');
const matrizRows  = manifest?.sheets?.matriz_precios?.row_count    ?? null;
const adminRows   = manifest?.sheets?.admin_cotizaciones?.row_count ?? null;
const lastSync    = manifest?.last_sync ?? null;

// ── 6. Diff vs previous KB ────────────────────────────────────────────────────
const prevKb   = prev();
const prevScore = prevKb?._meta?.score ?? null;
const scoreDelta = prevScore !== null ? score - prevScore : null;

// ── 7. Compile KB ─────────────────────────────────────────────────────────────
const kb = {
  _meta: {
    v:        '2.0.0',
    ts:       new Date().toISOString(),
    build_ms: 0, // filled below
    score,
    score_delta: scoreDelta,
    sources:  ['ROADMAP.md', 'PROJECT-STATE.md', 'package.json', 'git', '.accessible-base/manifest.json'],
  },

  project: {
    name:        'Calculadora BMC',
    pkg_version:  pkg.version ?? '3.1.5',
    score,
    mission:     'Automatizar el proceso comercial de BMC Uruguay para paneles Panelin — desde cotización técnica hasta cierre de venta, integrando WhatsApp, MercadoLibre y email con mínima intervención manual.',
    stack:       'React18+Vite7:5173 | Express5+Node20:3001 | Cloud Run(panelin-calc) | Vercel | Google Sheets | PostgreSQL',
    urls: {
      frontend:  'https://calculadora-bmc.vercel.app',
      api:       'https://panelin-calc-q74zutv7dq-uc.a.run.app',
    },
  },

  state: {
    branch,
    last_commit:  { hash: lastHash, msg: lastMsg },
    uncommitted:  uncommit,
    last_change:  lastChange,
    deploy: {
      vercel:     'live',
      cloud_run:  'rev-00170-5jb',
      tag:        'v3.1.6',
    },
    health: {
      lint:       '0_warnings',
      tests:      '350_pass',
      vulns:       4,
      vulns_note: 'serialize-javascript HIGH is build-time only (vite-plugin-pwa compat limit)',
    },
  },

  gates: {
    cm0_whatsapp_e2e:  cm0,
    cm1_ml_publish:    cm1,
    cm2_email_ingest:  cm2,
    all_done:          [cm0, cm1, cm2].every(g => g === 'DONE'),
  },

  areas: areas.length ? areas : [
    { label: 'Calculator BOM/wizard',      q: 8, c: 7, status: 'Estable' },
    { label: '2D Roof Plan SVG/cotas',     q: 9, c: 8, status: 'Estable' },
    { label: 'CRM/WolfBoard Admin 2.0',    q: 8, c: 6, status: 'Mergeado, sin QA prod' },
    { label: 'WhatsApp/Meta omnicanal',    q: 6, c: 5, status: 'cm-0 pendiente humano' },
    { label: 'MercadoLibre integration',   q: 8, c: 7, status: 'OAuth OK, cm-1 pendiente' },
    { label: 'Email ingest',               q: 6, c: 6, status: 'dry-run OK, cm-2 pendiente' },
    { label: 'Google Sheets/Data',         q: 8, c: 8, status: 'Estable' },
    { label: 'Deploy CI/CD',               q: 9, c: 7, status: 'Tag v3.1.6, sin smoke CI' },
    { label: 'Tests unit+API',             q: 8, c: 7, status: '350 pass' },
    { label: 'Docs/Agents/Tooling',        q: 9, c: 9, status: 'ROADMAP+nxt wired' },
    { label: 'Security/Deps',             q: 6, c: 7, status: '4 vulns residual' },
    { label: 'Lint/Code quality',          q: 9, c: 9, status: '0 warnings' },
  ],

  roadmap: roadmapItems.length ? roadmapItems : [
    { priority: '🔴 CRÍTICO', title: 'cm-0 WhatsApp E2E',          action: 'Send real WA msg → verify CRM row → mark done' },
    { priority: '🟠 ALTO',    title: 'QA WolfBoard prod',           action: 'Open Vercel URL → verify Admin 2.0 loads CRM data' },
    { priority: '🟠 ALTO',    title: 'cm-1 ML publish',             action: 'ml:pending-workup → answer ML questions with MATRIZ price' },
    { priority: '🟠 ALTO',    title: 'cm-2 email ingest prod',      action: 'email:ingest-snapshot --limit 1 (no --dry-run)' },
    { priority: '🟡 MEDIO',   title: 'Smoke post-deploy CI',        action: 'Add smoke job to .github/workflows/ci.yml' },
    { priority: '🟡 MEDIO',   title: 'UI encuentros multizona',     action: 'Complete segment UI in RoofPreview.jsx' },
  ],

  rules: [
    'ES modules only (import/export) — never require()',
    'Never commit .env or credentials — use config/process.env',
    'npm run gate:local before every commit | gate:local:full before deploy',
    'No npm audit fix --force without explicit user approval (can break vite)',
    'No hardcode sheet IDs — read from config.* or process.env.*',
    '503=Sheets unavailable | 200+empty=no data | never 500 for Sheets errors',
    'Commit prefix: feat/fix/refactor/docs/chore',
    'Update docs/team/PROJECT-STATE.md after every significant change',
    'Spanish for business/operator text | English for code, commands, file paths',
    'Fix → Deploy → Fix → Deploy: get each improvement live before the next',
  ],

  agents: [
    { id: 'bmc-orchestrator',    role: 'Coordinates full team runs' },
    { id: 'bmc-calc-specialist', role: 'Pricing BOM panel calculations' },
    { id: 'bmc-panelin-chat',    role: 'Chat UI training KB dev mode' },
    { id: 'bmc-api-contract',    role: 'API response drift detection' },
    { id: 'bmc-security',        role: 'OAuth CORS credential audits' },
    { id: 'bmc-deployment',      role: 'Vercel + Cloud Run deploy/rollback' },
    { id: 'bmc-fiscal',          role: 'IVA IRAE BPS fiscal oversight' },
    { id: 'bmc-docs-sync',       role: 'PROJECT-STATE docs sync' },
    { id: 'bmc-judge',           role: 'Run reports agent rankings' },
    { id: 'bmc-sheets-mapping',  role: 'Google Sheets CRM integration' },
    { id: 'calculo-especialist', role: '2D roof plan SVG dimensioning' },
  ],

  commands: {
    dev:           'npm run dev:full',
    gate:          'npm run gate:local',
    gate_full:     'npm run gate:local:full',
    smoke:         'npm run smoke:prod',
    kb_build:      'npm run kb:build',
    ml_pending:    'npm run ml:pending-workup',
    deploy_vercel: 'bash scripts/deploy-vercel.sh --prod',
    deploy_api:    'bash scripts/deploy-cloud-run.sh',
    sheets_sync:   'npm run sheets:sync',
  },

  sheets: {
    matriz_synced_at: lastSync,
    matriz_rows:      matrizRows,
    admin_rows:       adminRows,
    last_sync:        lastSync,
  },

  // 250-word dense summary — fastest path to full project understanding
  context_fast: [
    `BMC Uruguay (METALOG SAS) vende paneles de aislación Panelin en Uruguay.`,
    `Stack: React18+Vite7 (Vercel frontend) + Express5/Node20 (Cloud Run API panelin-calc us-central1).`,
    `Datos: Google Sheets como CRM operativo (MATRIZ precios ${matrizRows ?? 170} filas, Admin cotizaciones ${adminRows ?? 38} filas).`,
    `Score actual: ${score}/100. Versión: v${pkg.version ?? '3.1.5'} tag v3.1.6 en main.`,
    `Estado gates: cm-0 WhatsApp E2E=${cm0} | cm-1 ML publicación=${cm1} | cm-2 Email ingest=${cm2}.`,
    `Health: 0 lint warnings | 350 tests pass | 4 vulns residuales (build-time only).`,
    `Canales de venta: WhatsApp Business (webhook+HMAC+omni tables), MercadoLibre (OAuth+41 publicaciones), Email (IMAP bridge+parse→CRM).`,
    `Calculator: wizard multi-paso (techo/pared/combinado), BOM completo, planta 2D SVG ISO128, PDF export, precio desde MATRIZ CSV.`,
    `WolfBoard Admin 2.0 mergeado a main — dashboard CRM operativo unificado.`,
    `Acciones críticas pendientes: responder preguntas ML UNANSWERED (impacto revenue directo), validar WhatsApp E2E, verificar email ingest en prod.`,
    `Deploy: Vercel auto desde main | Cloud Run: bash scripts/deploy-cloud-run.sh | gate antes de todo: npm run gate:local.`,
    `Filosofía: Fix → Deploy → Fix → Deploy. Una mejora live antes de la siguiente.`,
  ].join(' '),
};

kb._meta.build_ms = Date.now() - t0;

// ── 8. Write kb.json ──────────────────────────────────────────────────────────
mkdirSync(BASE_DIR, { recursive: true });
writeFileSync(join(BASE_DIR, 'kb.json'), JSON.stringify(kb, null, 2));

const kbBytes = JSON.stringify(kb).length;

// ── 9. Observability report ───────────────────────────────────────────────────
const delta = scoreDelta !== null
  ? (scoreDelta > 0 ? `▲${scoreDelta}` : scoreDelta < 0 ? `▼${Math.abs(scoreDelta)}` : '═0')
  : 'baseline';

const gateStr = `cm-0:${cm0 === 'DONE' ? '✅' : '❌'}  cm-1:${cm1 === 'DONE' ? '✅' : '❌'}  cm-2:${cm2 === 'DONE' ? '✅' : '❌'}`;

log(`
╔══════════════════════════════════════════════════════════╗
║           ACCESSIBLE BASE — KB Build Report              ║
╚══════════════════════════════════════════════════════════╝
 Version : ${kb._meta.v}   Built: ${new Date().toISOString()}
 Sources : ${kb._meta.sources.length} files read
 Build   : ${kb._meta.build_ms}ms   KB: ${(kbBytes/1024).toFixed(1)}KB (${kbBytes} chars)

 Project : ${kb.project.name} v${kb.project.pkg_version}
 Score   : ${score}/100  ${delta}
 Branch  : ${branch}   Uncommitted: ${uncommit} files
 Deploy  : Vercel live | ${kb.state.deploy.cloud_run} | ${kb.state.deploy.tag}

 Gates   : ${gateStr}
 Health  : ${kb.state.health.lint} | ${kb.state.health.tests} | vulns=${kb.state.health.vulns}
 Areas   : ${kb.areas.length} scored   Roadmap: ${kb.roadmap.length} items
 Sheets  : MATRIZ ${matrizRows ?? '?'} rows | CRM ${adminRows ?? '?'} rows | sync ${lastSync ? lastSync.slice(0,10) : 'never'}
${lastChange ? ` Last Δ  : ${lastChange.slice(0, 70)}` : ''}

 → .accessible-base/kb.json  ✅
`);
