/**
 * Security regression: public storefront generar_pdf must not open shared Drive.
 * Run: node tests/storefrontPdfDriveGuard.test.js
 */
import assert from "node:assert/strict";
import { config } from "../server/config.js";
import { canWriteSharedQuoteDrive } from "../server/routes/calc.js";

const prevFolder = config.driveQuoteFolderId;
config.driveQuoteFolderId = "drive-folder-test";

try {
  const reqWithService = { user: { role: "service", subject_type: "service" } };
  const reqAnon = {};

  assert.equal(
    canWriteSharedQuoteDrive(reqWithService, "ae_agent"),
    true,
    "operator ae_agent + service user may write Drive when folder configured",
  );
  assert.equal(
    canWriteSharedQuoteDrive(reqWithService, "storefront-voice"),
    false,
    "storefront-voice never writes shared Drive even with service loopback user",
  );
  assert.equal(
    canWriteSharedQuoteDrive(reqAnon, "ae_agent"),
    false,
    "anonymous cotizar/pdf stays Drive-off",
  );
  assert.equal(
    canWriteSharedQuoteDrive(reqAnon, "storefront-voice"),
    false,
    "anonymous storefront also Drive-off",
  );
  console.log("storefrontPdfDriveGuard.test.js: ok");
} finally {
  config.driveQuoteFolderId = prevFolder;
}
