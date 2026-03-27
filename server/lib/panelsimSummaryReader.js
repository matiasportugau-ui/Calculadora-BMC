/**
 * Read PANELSIM artifacts from the email inbox repo (Markdown report + JSON status).
 * No network; filesystem only. Safe paths under emailRepo/data/reports/.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveEmailInboxRepoRoot } from "./emailInboxRepoResolve.js";

const DEFAULT_REPORT_MAX = 24_000;

/**
 * @param {{ cwd?: string, bmcEmailInboxRepo?: string | null, reportMaxChars?: number }} options
 */
export function readPanelsimEmailSummary(options = {}) {
  const cwd = options.cwd || process.cwd();
  const emailRepo = resolveEmailInboxRepoRoot({
    cwd,
    bmcEmailInboxRepo: options.bmcEmailInboxRepo,
  });
  const reportMax =
    Number(options.reportMaxChars) > 0 ? Number(options.reportMaxChars) : DEFAULT_REPORT_MAX;

  if (!fs.existsSync(emailRepo) || !fs.statSync(emailRepo).isDirectory()) {
    return {
      ok: false,
      error: "email_repo_missing",
      emailRepo,
      hint: "Set BMC_EMAIL_INBOX_REPO or place conexion-cuentas-email-agentes-bmc as sibling of this repo",
    };
  }

  const statusPath = path.join(emailRepo, "data", "reports", "PANELSIM-STATUS.json");
  const reportPath = path.join(emailRepo, "data", "reports", "PANELSIM-ULTIMO-REPORTE.md");

  let status = null;
  let statusError = null;
  let statusMtime = null;
  if (fs.existsSync(statusPath)) {
    try {
      status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
      statusMtime = fs.statSync(statusPath).mtime.toISOString();
    } catch (e) {
      statusError = e?.message || String(e);
    }
  }

  let reportPreview = "";
  let reportMtime = null;
  let reportTruncated = false;
  if (fs.existsSync(reportPath)) {
    const full = fs.readFileSync(reportPath, "utf8");
    reportMtime = fs.statSync(reportPath).mtime.toISOString();
    if (full.length > reportMax) {
      reportPreview = `${full.slice(0, reportMax)}\n\n… [truncado]`;
      reportTruncated = true;
    } else {
      reportPreview = full;
    }
  }

  const artifactsMissing = !fs.existsSync(statusPath) && !fs.existsSync(reportPath);

  return {
    ok: true,
    emailRepo,
    artifactsMissing,
    status,
    statusError,
    statusMtime,
    statusPath: fs.existsSync(statusPath) ? statusPath : null,
    reportPath: fs.existsSync(reportPath) ? reportPath : null,
    reportPreview,
    reportMtime,
    reportTruncated,
    reportCharCount: reportPreview.length,
    workflow: {
      thunderbirdSameImap: true,
      refreshCommand: "npm run panelsim:email-ready",
      crmDryRun: "npm run email:ingest-snapshot -- --dry-run --limit 5",
      crmIngest: "npm run email:ingest-snapshot -- --limit 10",
      phase2: "IMAP/SMTP control from GPT — deferred; use Thunderbird for send until then",
    },
  };
}
