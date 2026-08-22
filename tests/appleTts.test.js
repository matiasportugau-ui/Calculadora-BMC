// tests/appleTts.test.js — Español (Argentina) default + picker
import {
  pickAppleSpanishVoice,
  splitTtsChunks,
  isSpainSpanishVoice,
  isArgentinaVoiceName,
  argentinaVoiceId,
  listLatamSpeechVoices,
  ARGENTINA_VOICES,
  DEFAULT_APPLE_TTS_VOICE,
} from "../src/hooks/appleTts.js";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

assert(DEFAULT_APPLE_TTS_VOICE.includes("Diego"), "default is Diego Argentina");
assert(isArgentinaVoiceName("Diego (Argentina)") === true, "Diego is AR");
assert(isArgentinaVoiceName("Eddy (México)") === false, "Eddy is not AR");
assert(argentinaVoiceId("Isabela (Argentina)") === "isabela", "isabela id");
assert(argentinaVoiceId("Diego (Argentina)") === "diego", "diego id");

const installed = [
  { name: "Mónica", lang: "es-ES" },
  { name: "Paulina", lang: "es-MX" },
  { name: "Eddy (Español (México))", lang: "es-MX" },
];
const def = pickAppleSpanishVoice(installed);
assert(def?.lang === "es-AR", `default pick is es-AR (got ${def?.lang} ${def?.name})`);
assert(def?.name?.includes("Diego"), "default pick is Diego");

const eddy = pickAppleSpanishVoice(installed, { preferredName: "Eddy (Español (México))" });
assert(eddy?.name?.includes("Eddy"), "can still prefer Eddy");

assert(isSpainSpanishVoice({ name: "Mónica", lang: "es-ES" }) === true, "Mónica is Spain");

const listed = listLatamSpeechVoices(installed);
assert(listed[0].name === ARGENTINA_VOICES[0].name, "picker starts with Diego");
assert(listed.some((v) => v.name.includes("Isabela")), "picker includes Isabela");
assert(listed.every((v) => !String(v.lang).toLowerCase().startsWith("es-es")), "no es-ES in picker");

const withAr = pickAppleSpanishVoice(
  [...installed, { name: "Diego", lang: "es-AR" }],
  { preferredName: "" },
);
assert(withAr?.lang === "es-AR", "installed es-AR wins");

assert(splitTtsChunks("Hola.").length === 1, "short chunk");
assert(splitTtsChunks("Uno. ".repeat(80), 40).length > 1, "long splits");

console.log(`\n${failed === 0 ? "✅" : "❌"} appleTts: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
