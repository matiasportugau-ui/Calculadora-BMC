// ═══════════════════════════════════════════════════════════════════════════
// Unit tests — recordCalcEvent (calc-only registry entries)
// Run: node tests/quoteRegistryCalcEvent.test.js
// ═══════════════════════════════════════════════════════════════════════════

process.env.GCS_QUOTES_BUCKET = "";

const { config } = await import("../server/config.js");
config.gcsQuotesBucket = "";

const { recordCalcEvent, listQuotations, _resetCacheForTests } = await import(
  "../server/lib/quoteRegistry.js"
);

let passed = 0;
let failed = 0;

function assert(name, cond, actual, expected) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed += 1;
  }
}

(async () => {
  console.log("\n═══ SUITE: quoteRegistry.recordCalcEvent ═══");

  _resetCacheForTests();

  const r1 = await recordCalcEvent({
    source: "ae_agent",
    scenario: "solo_techo",
    lista: "web",
    summary: { total_usd: 1234, subtotal_usd: 1011, area_m2: 50, cant_paneles: 8 },
    requestHash: "hash-1",
    sessionId: "sess-A",
    client: "Juan Pérez",
  });
  assert("first record returns ok", r1.ok === true, r1, { ok: true });
  assert("entry has kind=calc_only", r1.entry?.kind === "calc_only", r1.entry?.kind, "calc_only");
  assert("entry stores total", r1.entry?.total === 1234, r1.entry?.total, 1234);
  assert("entry source=ae_agent", r1.entry?.source === "ae_agent", r1.entry?.source, "ae_agent");
  assert("entry has unique id", typeof r1.entry?.id === "string" && r1.entry.id.startsWith("calc-"), r1.entry?.id, "calc-*");

  // Dedupe: same hash within window returns deduped flag
  const r2 = await recordCalcEvent({
    source: "ae_agent",
    scenario: "solo_techo",
    lista: "web",
    summary: { total_usd: 1234 },
    requestHash: "hash-1",
  });
  assert("dedupe: second call with same hash returns deduped:true", r2.deduped === true, r2.deduped, true);
  assert("dedupe: returns same entry id", r2.entry?.id === r1.entry?.id, r2.entry?.id, r1.entry?.id);

  // Different hash → fresh entry
  const r3 = await recordCalcEvent({
    source: "ae_agent",
    scenario: "solo_fachada",
    lista: "venta",
    summary: { total_usd: 5000 },
    requestHash: "hash-2",
  });
  assert("different hash creates fresh entry", r3.entry?.id !== r1.entry?.id, { r1: r1.entry?.id, r3: r3.entry?.id }, "different");

  // listQuotations surfaces calc-only entries
  const list = await listQuotations({ source: "ae_agent" });
  assert("listQuotations returns >= 2 ae_agent rows", list.length >= 2, list.length, ">=2");
  assert("listQuotations rows include kind=calc_only", list.some((e) => e.kind === "calc_only"), list.map((e) => e.kind), "[calc_only,...]");

  const listHuman = await listQuotations({ source: "ae_agent", omitCalcOnly: true });
  assert("omitCalcOnly drops calc_only rows", !listHuman.some((e) => e.kind === "calc_only"), listHuman.map((e) => e.kind), "no calc_only");

  // No requestHash → no dedupe collision
  _resetCacheForTests();
  const r4 = await recordCalcEvent({ source: "ae_agent", scenario: "solo_techo", lista: "web", summary: {} });
  const r5 = await recordCalcEvent({ source: "ae_agent", scenario: "solo_techo", lista: "web", summary: {} });
  assert("calls without requestHash always produce fresh entries", r4.entry?.id !== r5.entry?.id, { r4: r4.entry?.id, r5: r5.entry?.id }, "different");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
