// tests/voiceTranscriptCoalesce.test.js
import assert from "node:assert/strict";
import {
  coalesceUserTranscript,
  shouldMergeUtterance,
  pickMergedText,
} from "../src/utils/voiceTranscriptCoalesce.js";

console.log("\n— voiceTranscriptCoalesce\n");

const t0 = 1_000_000;
const growing = [
  "Hola, Kernel.",
  "Hola, Kernel. Esto lo está diciendo una",
  "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas",
  "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
  "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
  "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
];

let lines = [];
growing.forEach((text, i) => {
  lines = coalesceUserTranscript(lines, text, t0 + i * 900);
});
assert.equal(
  shouldMergeUtterance(
    "Hola, Kernel. Esto lo está diciendo una",
    "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas",
    900,
  ),
  true,
  "está vs estoy still same utterance",
);
assert.equal(lines.length, 1, "one spoken sentence → one bubble");
assert.match(lines[0].text, /cuántas veces aparece/i);

assert.equal(
  shouldMergeUtterance(
    "Hola, Kernel. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
    "Hola, canal. Esto lo estoy diciendo una sola vez. ¿Cuántas veces aparece en el chat?",
    800,
  ),
  true,
  "Kernel ASR 'canal' still merges",
);

const later = coalesceUserTranscript(lines, "ok, otra cosa", t0 + 20_000);
assert.equal(later.length, 2, "new utterance after window stays separate");

assert.equal(
  pickMergedText("Hola", "Hola Kernel"),
  "Hola Kernel",
);

console.log("  ✅ voiceTranscriptCoalesce\n");
