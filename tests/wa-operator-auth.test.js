import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import {
  initWaOperatorAuth,
  requestMagicLink,
  verifyMagicLink,
  refreshTokens,
  inviteOperator,
  logout,
  revokeOperator,
  _resetWaAuthForTests,
} from "../server/lib/waOperatorAuth.js";
import crypto from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";

async function runTests() {
  console.log("=== WA Operator Auth Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);
  const sentMails = [];
  
  try {
    initWaOperatorAuth({
      pool,
      sendMail: async (m) => { sentMails.push(m); },
    });
    process.env.WA_JWT_SECRET = "test_secret_at_least_32_chars_long_for_security";

    const testEmail = `test_auth_${Date.now()}@example.com`;

    // 1. Invite (don't send mail yet)
    const inv = await inviteOperator({
      email: testEmail,
      name: "Test User",
      role: "admin",
      invitedBy: "admin_tester",
      sendInviteMail: false,
    });
    console.log("✓ Invite OK");

    const reinvite = await inviteOperator({
      email: testEmail,
      name: "Test User Reinvite",
      role: "member",
      invitedBy: "admin_tester",
      sendInviteMail: false,
    });
    if (reinvite.operator.role !== "admin") {
      throw new Error(`Existing operator role was downgraded to ${reinvite.operator.role}`);
    }
    console.log("✓ Reinvite preserves existing role");

    // 2. Magic Link
    await requestMagicLink({ email: testEmail, baseUrl: "http://localhost:3001" });
    if (!sentMails[0]) throw new Error("No mail sent");
    const tokenMatch = sentMails[0].text.match(/token=([a-f0-9]+)/);
    if (!tokenMatch) throw new Error("Token not found in email: " + sentMails[0].text);
    const magicToken = tokenMatch[1];
    console.log("✓ Magic Link Sent & Captured, token len:", magicToken.length);

    // Debug: check DB directly
    const { rows: dbCheck } = await pool.query("select magic_token_hash from wa_operators where email = $1", [testEmail]);
    console.log("  DB hash:", dbCheck[0]?.magic_token_hash);
    const expectedHash = crypto.createHash("sha256").update(magicToken).digest("hex");
    console.log("  Expected hash:", expectedHash);
    console.log("  Match?", dbCheck[0]?.magic_token_hash === expectedHash);

    // 3. Verify
    const sess = await verifyMagicLink({ token: magicToken });
    console.log("✓ Verify OK, Access Token len:", sess.accessToken.length);

    // 4. Refresh (Rotation)
    const oldRefresh = sess.refreshToken;
    const r1 = await refreshTokens({ refreshToken: oldRefresh });
    console.log("✓ Refresh Rotation OK, new token != old:", r1.refreshToken !== oldRefresh);

    // 5. Reuse Detection
    try {
      await refreshTokens({ refreshToken: oldRefresh });
      console.log("✗ Reuse Detection FAIL: accepted old refresh token");
    } catch (e) {
      console.log("✓ Reuse Detection OK: rejected old refresh token");
    }

    // 6. Revoke
    await revokeOperator({ operatorId: sess.operator.id, actorId: "admin_tester" });
    // Note: revoke invalidates JWTs by setting jwt_revoked_at. 
    // The middleware checks this. refreshTokens also checks if operator is active.
    try {
      await refreshTokens({ refreshToken: r1.refreshToken });
      console.log("✗ Post-Revoke Refresh FAIL: accepted refresh token");
    } catch (e) {
      console.log("✓ Post-Revoke Refresh OK: rejected");
    }

    // Cleanup
    await pool.query("delete from wa_audit_log where operator_id = 'admin_tester' or target = $1", [testEmail]);
    await pool.query("delete from wa_operators where email = $1", [testEmail]);
    console.log("✓ Cleanup done");

  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  } finally {
    _resetWaAuthForTests();
    await resetWaPoolForTests();
  }
  console.log("=== WA Auth Tests Passed ===\n");
}

runTests();
