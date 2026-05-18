// Module: market-intelligence | Owner: bmc-dev | Created: 2026-05-15

import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Send an email notification for an alert via SMTP (nodemailer).
 * Gracefully skips if SMTP env vars are not configured — no crash.
 *
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *                    ALERT_EMAIL_FROM, ALERT_EMAIL_TO
 *
 * @param {object} alert - Alert row from DB
 * @returns {Promise<void>}
 */
export async function sendEmailAlert(alert) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.ALERT_EMAIL_FROM;
  const to = process.env.ALERT_EMAIL_TO;

  if (!host || !user || !pass || !from || !to) {
    log.warn({ alertId: alert.id }, 'SMTP not configured — skipping email alert');
    return;
  }

  // nodemailer is listed in the project's package.json (nodemailer 8.0.5)
  const { createTransport } = await import('nodemailer');

  const transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = `[BMC Alert — ${alert.level.toUpperCase()}] ${alert.message.slice(0, 80)}`;
  const body = [
    'BMC Market Intelligence Alert',
    '==============================',
    `Level    : ${alert.level.toUpperCase()}`,
    `Alert ID : ${alert.id}`,
    `Message  : ${alert.message}`,
    '',
    `Price Before : ${alert.price_before ?? 'N/A'}`,
    `Price After  : ${alert.price_after ?? 'N/A'}`,
    `Change       : ${alert.pct_change != null ? alert.pct_change.toFixed(2) + '%' : 'N/A'}`,
    '',
    `Timestamp: ${alert.created_at}`,
    '',
    '—',
    'BMC Market Intelligence · bmc.uy',
  ].join('\n');

  await transporter.sendMail({ from, to, subject, text: body });
  log.info({ alertId: alert.id, to }, 'email alert sent');
}
