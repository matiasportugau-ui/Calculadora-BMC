// tests/appleTtsSpeak.test.js
import {
  normalizeArgentinaVoice,
  isArgentinaVoiceName,
  ARGENTINA_PICKER_VOICES,
  findAppleTtsBinary,
  registerActiveSpeakChild,
  killActiveSpeak,
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

// in-flight child tracking (cancel must kill apple-tts — review deaf816d)
assert(killActiveSpeak() === false, "killActiveSpeak no-op without child");
const fakeChild = {
  killedWith: null,
  kill(sig) {
    this.killedWith = sig;
  },
  on() {},
};
registerActiveSpeakChild(fakeChild);
assert(killActiveSpeak() === true, "killActiveSpeak kills registered child");
assert(fakeChild.killedWith === "SIGKILL", "child killed with SIGKILL");
assert(killActiveSpeak() === false, "child cleared after kill");

console.log(`\n${failed === 0 ? "✅" : "❌"} appleTtsSpeak: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
