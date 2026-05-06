// Backwards-compat shim. All call sites importing { requireAuth } from this
// path now go through the dual-mode requireServiceOrUser guard, which accepts
// either the static API_AUTH_TOKEN OR a valid identity JWT (Phase G).
//
// Original token-only behavior remains the default when only API_AUTH_TOKEN
// is presented — no behavior change for existing CI/cron callers.
export { requireAuth } from "./requireServiceOrUser.js";
