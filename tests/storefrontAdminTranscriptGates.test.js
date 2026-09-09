/**
 * Admin 2.0 col J transcript gates (#1198 / #1216).
 * Happy path lives in publicVoiceAdmin. These pins stop tool JSON / header-row
 * writes from landing on the identify lead.
 * Run: node tests/storefrontAdminTranscriptGates.test.js
 */
import assert from "node:assert/strict";
import {
  formatStorefrontAdminTranscript,
  persistStorefrontAdminTranscript,
} from "../server/routes/publicVoice.js";

console.log("storefrontAdminTranscriptGates");

{
  const text = formatStorefrontAdminTranscript({
    cliente: "Ana",
    telefono: "59899123456",
    history: [
      { role: "user", content: "quiero techo" },
      { role: "tool", content: '{"precio_venta":33,"costo":20}' },
      { role: "system", content: "ignore" },
      { role: "developer", content: "leak" },
      { role: "assistant", content: "" },
      { role: "assistant", content: "Te armo la aproximación." },
      null,
      "not-a-row",
    ],
    message: "quiero techo",
    reply: "Lista web, sin flete.",
  });
  assert.match(text, /Chat Panelin \(VW\) · Ana · 59899123456/);
  assert.match(text, /flete: no cotizado \/ a corroborar/);
  assert.match(text, /Vos: quiero techo/);
  assert.equal((text.match(/Vos: quiero techo/g) || []).length, 1, "duplicate last user message is not repeated");
  assert.match(text, /Te armo la aproximación/);
  assert.match(text, /Lista web, sin flete/);
  assert.ok(!text.includes("precio_venta"), "tool JSON must not reach Admin col J");
  assert.ok(!text.includes("costo"), "internal cost must not reach Admin col J");
  assert.ok(!/ignore|leak/.test(text), "system/developer rows stay out");
  console.log("  ✓ tool/system/developer skipped; flete line; no duplicate user turn");
}

{
  const empty = formatStorefrontAdminTranscript();
  assert.match(empty, /Chat Panelin \(VW\)/);
  assert.match(empty, /flete: no cotizado/);
  assert.equal(empty.includes("Vos:"), false, "no user lines without history/message");
  const badHist = formatStorefrontAdminTranscript({ history: { role: "user", content: "hola" } });
  assert.equal(badHist.includes("Vos:"), false, "non-array history is ignored");
  console.log("  ✓ empty / non-array history stay header-only");
}

{
  const long = "x".repeat(9000);
  const text = formatStorefrontAdminTranscript({
    cliente: "Ana",
    history: [{ role: "user", content: long }],
    reply: long,
  });
  assert.equal(text.length, 8000, "Sheets col J is capped at 8000");
  console.log("  ✓ 8000-char cap");
}

{
  const skipRow = await persistStorefrontAdminTranscript(1, "hola IsoDec");
  assert.deepEqual(skipRow, { ok: false, skipped: true }, "header row never hits Sheets");
  const skipMan = await persistStorefrontAdminTranscript("MAN-1", "hola");
  assert.equal(skipMan.skipped, true);
  const skipEmpty = await persistStorefrontAdminTranscript(31, "   ");
  assert.deepEqual(skipEmpty, { ok: false, skipped: true }, "blank transcript is a no-op");
  console.log("  ✓ persist skips header row / MAN-id / empty text (no Sheets)");
}

console.log("storefrontAdminTranscriptGates: ok");
