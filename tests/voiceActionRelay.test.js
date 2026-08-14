// Contract tests for src/utils/voiceActionRelay.js (Bug EC)
// Run: node tests/voiceActionRelay.test.js

import { decideVoiceActionRelay } from "../src/utils/voiceActionRelay.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("Validated relay applies action and reports ok:true", () => {
  const d = decideVoiceActionRelay({
    fnName: "buildQuote",
    rawArgs: { scenario: "solo_techo" },
    relayOk: true,
    relayStatus: 200,
    relayData: {
      ok: true,
      action: {
        type: "buildQuote",
        payload: { scenario: "solo_techo", listaPrecios: "venta" },
        preview: { totalConIVA: 1000 },
      },
    },
  });
  assert(d.apply === true, "apply validated buildQuote");
  assert(d.action?.preview?.totalConIVA === 1000, "keeps server preview");
  assert(d.modelOutput?.ok === true, "model sees ok:true");
  assert(d.reason === "validated", "reason validated");
});

group("Rejected buildQuote does not apply and reports errors", () => {
  const d = decideVoiceActionRelay({
    fnName: "buildQuote",
    rawArgs: { scenario: "bogus" },
    relayOk: true,
    relayStatus: 200,
    relayData: { ok: false, rejected: true, errors: ["scenario inválido"] },
  });
  assert(d.apply === false, "do not apply rejected");
  assert(d.modelOutput?.ok === false, "model sees ok:false");
  assert(Array.isArray(d.modelOutput?.errors), "errors forwarded");
  assert(d.reason === "rejected", "reason rejected");
});

group("HTTP 401/429/5xx fail-closed (Bug EC) — no raw apply, no false ok:true", () => {
  for (const status of [401, 429, 500, 503]) {
    const d = decideVoiceActionRelay({
      fnName: "buildQuote",
      rawArgs: { scenario: "solo_techo", listaPrecios: "venta", techo: { familia: "ISODEC" } },
      relayOk: false,
      relayStatus: status,
      relayData: { ok: false, error: "auth" },
    });
    assert(d.apply === false, `HTTP ${status}: do not apply raw`);
    assert(d.modelOutput?.ok === false, `HTTP ${status}: model ok:false`);
    assert(d.modelOutput?.error === "relay_http_error", `HTTP ${status}: relay_http_error`);
    assert(d.reason === "http_error", `HTTP ${status}: reason http_error`);
  }
});

group("Network error fail-closed (Bug EC)", () => {
  const d = decideVoiceActionRelay({
    fnName: "setLP",
    rawArgs: { listaPrecios: "venta" },
    networkError: new Error("Failed to fetch"),
  });
  assert(d.apply === false, "network: do not apply");
  assert(d.modelOutput?.ok === false, "network: model ok:false");
  assert(d.modelOutput?.error === "relay_network_error", "network: relay_network_error");
});

group("ok:false without rejected fail-closed (no silent raw apply)", () => {
  const d = decideVoiceActionRelay({
    fnName: "setFlete",
    rawArgs: { flete: 999 },
    relayOk: true,
    relayStatus: 200,
    relayData: { ok: false, error: "unexpected" },
  });
  assert(d.apply === false, "ok:false: do not apply");
  assert(d.modelOutput?.ok === false, "ok:false: model ok:false");
  assert(d.reason === "unvalidated", "ok:false: unvalidated");
});

group("ok:true without action fail-closed", () => {
  const d = decideVoiceActionRelay({
    fnName: "setScenario",
    rawArgs: { scenario: "solo_techo" },
    relayOk: true,
    relayStatus: 200,
    relayData: { ok: true },
  });
  assert(d.apply === false, "missing action: do not apply");
  assert(d.modelOutput?.ok === false, "missing action: model ok:false");
});

console.log(`\nvoiceActionRelay: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
