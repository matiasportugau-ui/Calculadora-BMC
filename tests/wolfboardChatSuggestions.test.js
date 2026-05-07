// Contract tests for server/lib/wolfboardChatSuggestions.js
// Run: node tests/wolfboardChatSuggestions.test.js

import { classifyIntents } from "../server/lib/userIntentClassifier.js";
import { wolfboardSuggestionsAfterTool } from "../server/lib/wolfboardChatSuggestions.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function group(name, fn) {
  console.log(`\n— ${name}`);
  return fn();
}

group("null / failure → null", () => {
  assert(wolfboardSuggestionsAfterTool("wolfboard_pendientes", null) === null, "null parsed");
  assert(wolfboardSuggestionsAfterTool("wolfboard_pendientes", { ok: false }) === null, "ok false");
  assert(wolfboardSuggestionsAfterTool("calcular_cotizacion", { ok: true }) === null, "wrong tool");
});

group("wolfboard_pendientes → groups + items", () => {
  const r = wolfboardSuggestionsAfterTool("wolfboard_pendientes", { ok: true });
  assert(r != null && r.groups.length === 1, "one group");
  assert(r.groups[0].items.length >= 3, "has chips");
});

group("Write-intent chips match classifier (sync + batch)", () => {
  const r = wolfboardSuggestionsAfterTool("wolfboard_pendientes", { ok: true });
  const syncChip = r.groups[0].items.find((i) => i.label.includes("Sincronizar"));
  const batchChip = r.groups[0].items.find((i) => i.label.includes("IA"));
  assert(syncChip && classifyIntents(syncChip.send).has("wolfboard_sync"), "sync send triggers intent");
  assert(batchChip && classifyIntents(batchChip.send).has("wolfboard_quote_batch"), "batch send triggers intent");
});

group("wolfboard_export → suggestions", () => {
  const r = wolfboardSuggestionsAfterTool("wolfboard_export", { ok: true });
  assert(r != null && r.groups[0].items.length >= 2, "export follow-up");
});

group("wolfboard_sync → suggestions", () => {
  const r = wolfboardSuggestionsAfterTool("wolfboard_sync", { ok: true });
  assert(r != null && r.groups[0].items.length >= 2, "sync follow-up");
});

console.log(`\n${"═".repeat(60)}`);
console.log(`wolfboardChatSuggestions tests — passed: ${passed}, failed: ${failed}`);
console.log("═".repeat(60));
if (failed > 0) process.exit(1);
