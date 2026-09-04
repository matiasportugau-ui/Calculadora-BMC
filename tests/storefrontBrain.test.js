// Public-safe IAlfred ↔ Panelin brain for storefront chat.
// Run: node tests/storefrontBrain.test.js

import assert from "node:assert/strict";
import { __setBrainCacheForTests, brainBlock, getBrainLessons } from "../server/lib/brainKB.js";
import {
  STOREFRONT_BRAIN_GUARD,
  isPublicStorefrontLesson,
  shopperTextForBrain,
  storefrontBrainBlock,
  storefrontBrainStatus,
  __resetStorefrontBrainHydratedForTests,
} from "../server/lib/voice/storefrontBrain.js";
import { buildStorefrontVoicePack } from "../server/lib/voice/storefrontVoicePack.js";

const fixtures = [
  {
    id: "install-seq-common",
    status: "active",
    confidence: 0.96,
    trigger: "cómo se instala isodec",
    rule: "Si preguntan CÓMO se instala: secuencia común (acopio → U en platea → muros).",
  },
  {
    id: "admin-ao-edit-opendrive",
    status: "active",
    confidence: 0.99,
    trigger: "Admin col AO",
    rule: "Admin col AO SIEMPRE icono 🧮 link a https://calculadora-bmc.vercel.app/?openDrive=x",
  },
  {
    id: "drive-upload-oauth-not-sa",
    status: "active",
    confidence: 0.99,
    trigger: "subir a Drive",
    rule: "Subir cotizaciones a Drive SOLO con GOOGLE_DRIVE_REFRESH_TOKEN. Service Account no.",
  },
  {
    id: "install-completo-is-kit",
    status: "active",
    confidence: 0.95,
    trigger: "completo isopanel techo",
    rule: "BMC no instala. Completo = kit de materiales de la familia cotizada, no mano de obra.",
  },
  {
    id: "retired-noise",
    status: "retired",
    confidence: 0.9,
    trigger: "isoroof",
    rule: "familia = ISOROOF",
  },
];

__resetStorefrontBrainHydratedForTests();
__setBrainCacheForTests(fixtures, "test");

assert.equal(isPublicStorefrontLesson(fixtures[0]), true);
assert.equal(isPublicStorefrontLesson(fixtures[1]), false, "Admin AO is operator-only");
assert.equal(isPublicStorefrontLesson(fixtures[2]), false, "Drive OAuth is operator-only");
assert.equal(isPublicStorefrontLesson(fixtures[3]), true);
assert.equal(isPublicStorefrontLesson(fixtures[4]), false, "retired stays out");

const install = storefrontBrainBlock("cómo se instala un techo IsoDec");
assert.ok(install.includes(STOREFRONT_BRAIN_GUARD), "public guard");
assert.ok(install.includes("secuencia común"), "install lesson reaches shoppers");
assert.ok(!install.includes("openDrive"), "no calculator openDrive");
assert.ok(!install.includes("GOOGLE_DRIVE"), "no Drive token lesson");
assert.ok(!install.includes("calculadora-bmc.vercel.app"), "no calc SPA URL");

const operator = brainBlock("Admin col AO");
assert.ok(operator.includes("openDrive"), "operator brainBlock still sees Admin lessons");

const pack = buildStorefrontVoicePack({
  pageUrl: "https://bmcuruguay.com.uy/products/isodec",
  userText: "cómo se instala IsoDec",
});
assert.ok(pack.instructions.includes("secuencia común"), "pack injects public brain");
assert.ok(!pack.instructions.includes("openDrive"), "pack strips operator brain");
assert.ok(!pack.instructions.includes("GOOGLE_DRIVE_REFRESH_TOKEN"), "pack strips Drive lesson");
assert.ok(!/panelinBmcInstructions/i.test(pack.instructions), "no operator voice file");

assert.equal(shopperTextForBrain({ message: "Hola IsoDec" }), "Hola IsoDec");
assert.equal(
  shopperTextForBrain({ history: [{ role: "user", content: "techo 10x8" }] }),
  "techo 10x8",
);

const st = storefrontBrainStatus();
assert.equal(st.shared, true);
assert.equal(st.source, "test");
assert.equal(st.publicActive, 2);
assert.equal(st.total, getBrainLessons().length);

__setBrainCacheForTests([], "none");
console.log("storefrontBrain.test.js: ok");
