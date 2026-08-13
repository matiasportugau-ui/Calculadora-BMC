// tests/appleTtsSpeak.test.js
import {
  normalizeArgentinaVoice,
  isArgentinaVoiceName,
  ARGENTINA_PICKER_VOICES,
  findAppleTtsBinary,
} from "../server/lib/appleTtsSpeak.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(normalizeArgentinaVoice("Diego (Argentina)") === "diego", "diego");
assert(normalizeArgentinaVoice("Isabela (Argentina)") === "isabela", "isabela");
assert(isArgentinaVoiceName("es-AR") === true, "es-AR name");
assert(ARGENTINA_PICKER_VOICES[0].lang === "es-AR", "picker lang");
assert(ARGENTINA_PICKER_VOICES.some((v) => v.id === "diego"), "diego in picker");
assert(
  findAppleTtsBinary({ platform: "linux", exists: () => true, env: {} }) === null,
  "non-darwin null",
);
assert(
  findAppleTtsBinary({ platform: "darwin", exists: () => true, env: { BMC_APPLE_TTS: "0" } }) === null,
  "disabled",
);

console.log(`\n${failed === 0 ? "✅" : "❌"} appleTtsSpeak: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
