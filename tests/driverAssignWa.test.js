/**
 * HITL “Asignar a chofer” — UY digits and wa.me text must stay deterministic.
 * Complementary to orphan tests/driverAssign.test.js (not wired).
 * Run: node tests/driverAssignWa.test.js
 */
import assert from "node:assert/strict";
import {
  uyWhatsAppDigits,
  driverAssignWhatsAppUrl,
  openDriverAssign,
} from "../src/utils/logistica/driverAssign.js";

console.log("driverAssignWa");

{
  assert.equal(uyWhatsAppDigits("099 123 456"), "59899123456");
  assert.equal(uyWhatsAppDigits("+598 99 123 456"), "59899123456");
  assert.equal(uyWhatsAppDigits("99123456"), "59899123456");
  assert.equal(uyWhatsAppDigits("099123456"), "59899123456");
  assert.equal(uyWhatsAppDigits(""), "");
  assert.equal(uyWhatsAppDigits("abc"), "");
  assert.equal(uyWhatsAppDigits("9912345"), "9912345");
  assert.equal(uyWhatsAppDigits("5491112345678"), "5491112345678");
  console.log("  ✓ uyWhatsAppDigits 0/598/8-digit / short / foreign");
}

{
  const wa = driverAssignWhatsAppUrl({
    phone: "099111222",
    driverUrl: "https://calculadora-bmc.vercel.app/conductor?t=abc",
    tripLabel: "ENV-1 <script>alert(1)</script>\nlinea2",
  });
  assert.ok(wa.startsWith("https://wa.me/59899111222?text="));
  const decoded = decodeURIComponent(wa.slice(wa.indexOf("text=") + 5));
  assert.ok(decoded.includes("/conductor?t=abc"));
  assert.ok(decoded.includes("ENV-1 <script>alert(1)</script>"));
  assert.ok(decoded.includes("linea2"));
  assert.ok(!wa.includes("\n"), "newlines stay encoded in the query");
  console.log("  ✓ wa.me encodes label + driver URL");
}

{
  const noPhone = driverAssignWhatsAppUrl({
    driverUrl: "https://calculadora-bmc.vercel.app/conductor?t=tok",
    tripLabel: "R1",
  });
  assert.ok(noPhone.startsWith("https://wa.me/?text="));
  assert.ok(decodeURIComponent(noPhone).includes("/conductor?t=tok"));
  console.log("  ✓ missing phone still builds https://wa.me/?text=");
}

{
  const opened = [];
  const r = openDriverAssign({
    phone: "099111222",
    driverUrl: "https://calculadora-bmc.vercel.app/conductor?t=tok",
    tripLabel: "R1",
    open: (u) => opened.push(u),
    copy: () => {
      throw new Error("clipboard denied");
    },
  });
  assert.equal(opened.length, 2);
  assert.equal(opened[0], r.driverUrl);
  assert.ok(opened[1].startsWith("https://wa.me/59899111222"));
  console.log("  ✓ copy throw still opens driver URL + WA");
}

{
  const opened = [];
  const r = openDriverAssign({
    phone: "099111222",
    tripLabel: "R1",
    open: (u) => opened.push(u),
  });
  assert.equal(r.driverUrl, null);
  assert.equal(opened.length, 1);
  assert.ok(opened[0].startsWith("https://wa.me/"));
  console.log("  ✓ no driverUrl opens WA only");
}

console.log("driverAssignWa.test.js ok");
