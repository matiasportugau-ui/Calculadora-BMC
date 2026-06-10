// ═══════════════════════════════════════════════════════════════════════════
// requireCrmCockpitAuth — S5 Phase B dual-mode guard for CRM cockpit routes.
//
// Accepts EITHER:
//   1) Static API_AUTH_TOKEN (legacy CI / operatorApiClient / cockpit-token)
//   2) Identity JWT with `canales` module grant (read or write per route)
//
// Query-string `?key=` is intentionally NOT supported (see requireServiceOrUser).
// ═══════════════════════════════════════════════════════════════════════════

import { requireServiceOrUser } from "./requireServiceOrUser.js";

/** GET / queues / summaries — canales:read */
export const requireCrmCockpitRead = requireServiceOrUser({
  module: "canales",
  minLevel: "read",
});

/** POST / PATCH mutations — canales:write */
export const requireCrmCockpitWrite = requireServiceOrUser({
  module: "canales",
  minLevel: "write",
});

export default requireCrmCockpitRead;