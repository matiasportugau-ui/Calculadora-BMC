#!/usr/bin/env node
/**
 * Digest diario: PROJECT-STATE (Cambios recientes) + git, opcional envío por SMTP.
 * Destinatario por defecto: matias.portugau@gmail.com (override: MAG_DAILY_EMAIL_TO).
 *
 * Uso:
 *   node scripts/magazine-daily-digest.mjs              # solo escribe .runtime/magazine-daily/
 *   node scripts/magazine-daily-digest.mjs --send       # envía si SMTP_USER + SMTP_PASS en .env
 *   node scripts/magazine-daily-digest.mjs --dry-run    # imprime asunto y no escribe ni envía
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config as loadEnv } from 'dotenv';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

loadEnv({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const DEFAULT_TO = 'matias.portugau@gmail.com';
const PROJECT_STATE = path.join(REPO_ROOT, 'docs', 'team', 'PROJECT-STATE.md');
const MAGAZINE_HTML = path.join(
  REPO_ROOT,
  'docs',
  'team',
  'orientation',
  'MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.html'
);
const OUT_DIR = path.join(REPO_ROOT, '.runtime', 'magazine-daily');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function runGit(args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: REPO_ROOT,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    return '(git no disponible o no es un repo)';
  }
}

function extractCambiosRecientes(md) {
  const marker = '## Cambios recientes';
  const i = md.indexOf(marker);
  if (i === -1) return '(Sección "## Cambios recientes" no encontrada.)';
  const rest = md.slice(i + marker.length);
  const nextH2 = rest.search(/\n## [^\n#]/);
  const chunk = nextH2 === -1 ? rest : rest.slice(0, nextH2);
  const trimmed = chunk.trim();
  return trimmed.length > 12000 ? `${trimmed.slice(0, 12000)}\n\n… [truncado]` : trimmed;
}

function buildEmailHtml({ dateLabel, gitBranch, gitStatus, gitLog, cambios }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BMC — digest diario ${escapeHtml(dateLabel)}</title></head>
<body style="margin:0;font-family:Inter,Helvetica Neue,Roboto,sans-serif;background:#f4f4f4;color:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e8e8e8;">
<tr><td style="padding:20px 24px;background:#0a0a0a;color:#fff;font-size:18px;font-weight:700;">
Calculadora BMC — digest de actualización
</td></tr>
<tr><td style="padding:8px 24px;background:#e10600;color:#fff;font-size:12px;font-weight:600;">
${escapeHtml(dateLabel)} · ${escapeHtml(gitBranch)}
</td></tr>
<tr><td style="padding:20px 24px;font-size:14px;line-height:1.5;">
<p style="margin:0 0 12px;">Resumen automático desde <code>PROJECT-STATE.md</code> y <code>git</code>. Spread de referencia en repo:
<code>docs/team/orientation/MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.html</code></p>
<h2 style="font-size:15px;margin:20px 0 8px;color:#e10600;">Git status</h2>
<pre style="margin:0;padding:12px;background:#f8f8f8;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(gitStatus)}</pre>
<h2 style="font-size:15px;margin:20px 0 8px;color:#e10600;">Git log (reciente)</h2>
<pre style="margin:0;padding:12px;background:#f8f8f8;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(gitLog)}</pre>
<h2 style="font-size:15px;margin:20px 0 8px;color:#e10600;">Cambios recientes (PROJECT-STATE)</h2>
<pre style="margin:0;padding:12px;background:#f8f8f8;border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(cambios)}</pre>
</td></tr>
<tr><td style="padding:16px 24px;font-size:11px;color:#666;border-top:1px solid #e8e8e8;">
Generado por <code>npm run magazine:daily</code>. No responder a este mensaje automático.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function main() {
  const argv = new Set(process.argv.slice(2));
  const dryRun = argv.has('--dry-run');
  const send = argv.has('--send');

  const dateLabel = new Date().toISOString().slice(0, 10);
  const timeFull = new Date().toISOString();

  const md = await readFile(PROJECT_STATE, 'utf8');
  const cambios = extractCambiosRecientes(md);

  const [gitBranch, gitStatus, gitLog] = await Promise.all([
    runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(['status', '-sb']),
    runGit(['log', '-8', '--oneline', '--no-decorate']),
  ]);

  const subject = `[BMC] Digest diario ${dateLabel} — ${gitBranch}`;

  const html = buildEmailHtml({
    dateLabel: `${dateLabel} (${timeFull})`,
    gitBranch,
    gitStatus,
    gitLog,
    cambios,
  });

  const text = [
    `Calculadora BMC — digest ${dateLabel}`,
    `Rama: ${gitBranch}`,
    '',
    '--- git status -sb ---',
    gitStatus,
    '',
    '--- git log -8 ---',
    gitLog,
    '',
    '--- Cambios recientes ---',
    cambios,
  ].join('\n');

  if (dryRun) {
    console.log('Dry run — asunto:', subject);
    console.log('Tamaño HTML:', html.length, 'chars');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const base = `magazine-daily-${dateLabel}`;
  const htmlPath = path.join(OUT_DIR, `${base}.html`);
  const txtPath = path.join(OUT_DIR, `${base}.txt`);
  await writeFile(htmlPath, html, 'utf8');
  await writeFile(txtPath, text, 'utf8');
  console.log('Escrito:', htmlPath);
  console.log('Escrito:', txtPath);

  if (process.env.MAG_DAILY_ATTACH_MAGAZINE === '1' && existsSync(MAGAZINE_HTML)) {
    const dest = path.join(OUT_DIR, `${base}-spread-reference.html`);
    await copyFile(MAGAZINE_HTML, dest);
    console.log('Copia spread referencia:', dest);
  }

  if (!send) {
    console.log('Sin --send: no se envía correo. Configurá SMTP en .env y ejecutá con --send.');
    return;
  }

  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  if (!smtpUser || !smtpPass) {
    console.error(
      'Falta SMTP_USER o SMTP_PASS en .env (Gmail: contraseña de aplicación). Ver docs/team/orientation/MAGAZINE-DAILY-EMAIL.md'
    );
    process.exit(1);
  }

  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    console.error('Instalá nodemailer: npm install nodemailer');
    process.exit(1);
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true';
  const from = process.env.MAG_DAILY_EMAIL_FROM || smtpUser;
  const to = process.env.MAG_DAILY_EMAIL_TO || DEFAULT_TO;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mail = {
    from: `"Calculadora BMC" <${from}>`,
    to,
    subject,
    text,
    html,
  };

  if (process.env.MAG_DAILY_ATTACH_MAGAZINE === '1' && existsSync(MAGAZINE_HTML)) {
    mail.attachments = [
      {
        filename: 'MAGAZINE-SPREAD-UPDATE-LOGS-2026-04-09.html',
        path: MAGAZINE_HTML,
      },
    ];
  }

  await transporter.sendMail(mail);
  console.log('Correo enviado a:', to);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
