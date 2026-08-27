/**
 * Run: node tests/driverAssign.test.js
 */
import assert from "node:assert/strict";
import {
  uyWhatsAppDigits,
  driverAssignWhatsAppUrl,
  openDriverAssign,
} from "../src/utils/logistica/driverAssign.js";

console.log("driverAssign");

assert.equal(uyWhatsAppDigits("099 123 456"), "59899123456");
assert.equal(uyWhatsAppDigits("+59899123456"), "59899123456");
assert.equal(uyWhatsAppDigits(""), "");

const wa = driverAssignWhatsAppUrl({
  phone: "099111222",
  driverUrl: "http://localhost:5174/conductor?t=abc",
  tripLabel: "ENV-1",
});
assert.ok(wa.startsWith("https://wa.me/59899111222?text="));
assert.ok(decodeURIComponent(wa).includes("/conductor?t=abc"));
assert.ok(decodeURIComponent(wa).includes("ENV-1"));

const opened = [];
const r = openDriverAssign({
  phone: "099111222",
  driverUrl: "https://calculadora-bmc.vercel.app/conductor?t=tok",
  tripLabel: "R1",
  open: (u) => opened.push(u),
  copy: () => {},
});
assert.equal(opened.length, 2);
assert.equal(opened[0], r.driverUrl);
assert.ok(opened[1].startsWith("https://wa.me/"));

console.log("driverAssign: 3 passed");
