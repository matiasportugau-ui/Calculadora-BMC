/**
 * Staging guard — IMP-PEA-10 (repo-level checks).
 */

/**
 * @param {import('../../config.js').config} config
 */
export function getEnvironmentInfo(config) {
  const appEnv = config.appEnv || process.env.NODE_ENV || "development";
  const staging =
    appEnv === "staging" ||
    config.peaStagingMode ||
    /staging/i.test(config.publicBaseUrl || "");
  return {
    env: appEnv,
    project: config.peaProjectLabel || "calculadora-bmc",
    db_label: config.peaDbLabel || (config.databaseUrl ? "postgres" : "none"),
    staging,
    outbound_allowed: staging || appEnv === "development",
    implement_allowed: Boolean(config.peaImplementEnabled) && (staging || appEnv === "development"),
  };
}

/**
 * @param {import('../../config.js').config} config
 */
export function assertImplementEnvironment(config) {
  const info = getEnvironmentInfo(config);
  if (!config.peaImplementEnabled) {
    return { ok: false, error: "implement_disabled", info };
  }
  if (!info.implement_allowed) {
    return { ok: false, error: "implement_staging_only", info };
  }
  return { ok: true, info };
}

/**
 * CI helper — fail if staging env references prod-only identifiers.
 * @param {import('../../config.js').config} config
 */
export function validateStagingConfigIsolation(config) {
  const failures = [];
  if (config.appEnv !== "staging" && !config.peaStagingMode) {
    return { ok: true, skipped: true };
  }
  const prodSheet = process.env.BMC_PROD_SHEET_ID || "";
  if (prodSheet && config.crmSheetId && config.crmSheetId === prodSheet) {
    failures.push("crm_sheet_matches_prod");
  }
  if (config.waPhoneNumberId && process.env.BMC_PROD_WA_PHONE_ID) {
    if (config.waPhoneNumberId === process.env.BMC_PROD_WA_PHONE_ID) {
      failures.push("wa_phone_matches_prod");
    }
  }
  return { ok: failures.length === 0, failures };
}
