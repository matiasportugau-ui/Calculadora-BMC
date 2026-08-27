import assert from "node:assert/strict";
import { isNoiseUtterance } from "../src/utils/voiceNoiseFilter.js";

console.log("\n— voiceNoiseFilter\n");

assert.equal(isNoiseUtterance("Shh"), true);
assert.equal(isNoiseUtterance("shh."), true);
assert.equal(isNoiseUtterance("Sh"), true);
assert.equal(isNoiseUtterance("ok"), true);
assert.equal(isNoiseUtterance("Look"), true);
assert.equal(isNoiseUtterance("..."), true);
assert.equal(isNoiseUtterance("This is the folder right here with all the transcripts"), true);

assert.equal(isNoiseUtterance("Hola Kernel"), false);
assert.equal(isNoiseUtterance("cotizame un techo IsoDec"), false);
assert.equal(isNoiseUtterance("¿me ayudas?"), false);
assert.equal(isNoiseUtterance("sí"), false);

console.log("  ✅ voiceNoiseFilter\n");
