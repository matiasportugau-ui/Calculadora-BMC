#!/usr/bin/env node
/** CI: staging config must not reference prod sheet/WA ids. */
import { config } from "../server/config.js";
import { validateStagingConfigIsolation } from "../server/lib/pea/stagingGuard.js";

const result = validateStagingConfigIsolation(config);
if (!result.ok && !result.skipped) {
  console.error("PEA staging config isolation failed:", result.failures);
  process.exit(1);
}
console.log("OK: pea staging config check", result.skipped ? "(skipped non-staging)" : "");
