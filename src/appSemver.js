import pkg from "../package.json";

/** Application semver from package.json (resolved at build time in Vite). */
export const APP_SEMVER = typeof pkg?.version === "string" ? pkg.version : "0.0.0";

/** Header badge text, e.g. "· Panelin v3.1.5" — keep in sync with package.json only via this module. */
export const PANELIN_VERSION_BADGE = `· Panelin v${APP_SEMVER}`;
