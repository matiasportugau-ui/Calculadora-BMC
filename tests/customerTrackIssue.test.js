/**
 * Customer track issue / public GET gates (#1078).
 * Pins TTL clamp, short-token 404 shape, and required identity fields.
 * Run: node tests/customerTrackIssue.test.js
 */
import assert from "node:assert/strict";
import {
  clampCustomerTrackTtlDays,
  isPublicTrackTokenShape,
  canIssueCustomerTrack,
  PUBLIC_TRACK_TOKEN_MIN_LEN,
  CUSTOMER_TRACK_TTL_DEFAULT_DAYS,
} from "../server/lib/customerTrack.js";
import { sanitizeSnapshot } from "../src/utils/logistica/customerTrackView.js";

console.log("customerTrackIssue");

{
  assert.equal(clampCustomerTrackTtlDays(undefined), CUSTOMER_TRACK_TTL_DEFAULT_DAYS);
  assert.equal(clampCustomerTrackTtlDays(""), CUSTOMER_TRACK_TTL_DEFAULT_DAYS);
  assert.equal(clampCustomerTrackTtlDays("foo"), CUSTOMER_TRACK_TTL_DEFAULT_DAYS);
  assert.equal(clampCustomerTrackTtlDays(0), CUSTOMER_TRACK_TTL_DEFAULT_DAYS);
  assert.equal(clampCustomerTrackTtlDays(-5), 1);
  assert.equal(clampCustomerTrackTtlDays(1), 1);
  assert.equal(clampCustomerTrackTtlDays(21), 21);
  assert.equal(clampCustomerTrackTtlDays(60), 60);
  assert.equal(clampCustomerTrackTtlDays(90), 60);
  assert.equal(clampCustomerTrackTtlDays("90"), 60);
  console.log("  ✓ TTL defaults to 21, clamps 1..60 (0/NaN → 21)");
}

{
  assert.equal(isPublicTrackTokenShape(""), false);
  assert.equal(isPublicTrackTokenShape(null), false);
  assert.equal(isPublicTrackTokenShape("short"), false);
  assert.equal(isPublicTrackTokenShape("a".repeat(PUBLIC_TRACK_TOKEN_MIN_LEN - 1)), false);
  assert.equal(isPublicTrackTokenShape("a".repeat(PUBLIC_TRACK_TOKEN_MIN_LEN)), true);
  assert.equal(isPublicTrackTokenShape("a".repeat(32)), true);
  console.log("  ✓ public token shorter than 16 chars is not a valid shape (404)");
}

{
  assert.equal(canIssueCustomerTrack({ quote_ref: "BMC-1" }), true);
  assert.equal(canIssueCustomerTrack({ customer_display_name: "Silva" }), true);
  assert.equal(canIssueCustomerTrack({ quote_ref: "BMC-1", customer_display_name: "Silva" }), true);
  assert.equal(canIssueCustomerTrack({}), false);
  assert.equal(canIssueCustomerTrack({ quote_ref: "", customer_display_name: "" }), false);
  assert.equal(canIssueCustomerTrack({ product_summary: "ISOFRIG 80" }), false);
  console.log("  ✓ issue requires quote_ref or customer_display_name");
}

{
  const whitespace = sanitizeSnapshot({
    quote_ref: "   ",
    customer_display_name: "\t",
    driver_phone: "+59899111222",
  });
  assert.equal(canIssueCustomerTrack(whitespace), false);
  assert.equal(JSON.stringify(whitespace).includes("59899111222"), false);
  const named = sanitizeSnapshot({ customer_display_name: "  Silva  " });
  assert.equal(canIssueCustomerTrack(named), true);
  console.log("  ✓ whitespace-only identity after sanitize cannot issue (phone never stored)");
}

console.log("customerTrackIssue OK");
