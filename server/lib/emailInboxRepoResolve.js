/**
 * Resolve absolute path to conexion-cuentas-email-agentes-bmc.
 * Same order as scripts/resolve-email-inbox-repo.sh:
 * explicit BMC_EMAIL_INBOX_REPO → sibling of Calculadora-BMC.
 */
import path from "node:path";

/**
 * @param {{ cwd?: string, bmcEmailInboxRepo?: string | null }} opts
 * @returns {string}
 */
export function resolveEmailInboxRepoRoot(opts = {}) {
  const cwd = path.resolve(opts.cwd || process.cwd());
  const explicit = opts.bmcEmailInboxRepo ?? process.env.BMC_EMAIL_INBOX_REPO;
  if (explicit != null && String(explicit).trim() !== "") {
    return path.resolve(String(explicit).trim());
  }
  return path.resolve(path.join(cwd, "..", "conexion-cuentas-email-agentes-bmc"));
}
