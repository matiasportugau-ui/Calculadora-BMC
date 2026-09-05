// Public-brain deny / shopper text edges (#1198).
// Happy-path install lesson lives in storefrontBrain.test.js.
// Run: node tests/storefrontBrainGates.test.js

import assert from "node:assert/strict";
import {
  isPublicStorefrontLesson,
  shopperTextForBrain,
  STOREFRONT_BRAIN_DENY_IDS,
} from "../server/lib/voice/storefrontBrain.js";

assert.equal(isPublicStorefrontLesson(null), false);
assert.equal(isPublicStorefrontLesson({ status: "active", id: "ok", rule: "kit" }), true);

assert.equal(
  isPublicStorefrontLesson({ status: "retired", id: "install-seq-common", rule: "secuencia" }),
  false,
  "retired stays out",
);
assert.equal(
  isPublicStorefrontLesson({ status: "draft", id: "install-seq-common", rule: "secuencia" }),
  false,
);

for (const id of STOREFRONT_BRAIN_DENY_IDS) {
  assert.equal(
    isPublicStorefrontLesson({ status: "active", id, trigger: "x", rule: "safe product copy" }),
    false,
    id,
  );
}

assert.equal(
  isPublicStorefrontLesson({ status: "active", id: "admin-secret-row", rule: "producto IsoDec" }),
  false,
  "admin- prefix",
);
assert.equal(
  isPublicStorefrontLesson({ status: "active", id: "drive-folder-hint", rule: "producto IsoDec" }),
  false,
  "drive- prefix",
);
assert.equal(
  isPublicStorefrontLesson({ status: "active", id: "calc-load-unlock-extra", rule: "producto IsoDec" }),
  false,
  "calc-load- prefix",
);

assert.equal(
  isPublicStorefrontLesson({
    status: "active",
    id: "price-leak",
    rule: "Usá precio_venta de la lista interna",
  }),
  false,
  "DENY_RE precio_venta",
);
assert.equal(
  isPublicStorefrontLesson({
    status: "active",
    id: "spa-url",
    trigger: "abrir calculadora-bmc.vercel.app",
    rule: "mandalos al SPA",
  }),
  false,
);
assert.equal(
  isPublicStorefrontLesson({
    status: "active",
    id: "flete-usd",
    rule: "El flete de Montevideo es USD 240 lista web",
  }),
  false,
  "unsafe knowledge line (flete USD)",
);
assert.equal(
  isPublicStorefrontLesson({
    status: "active",
    id: "lista-venta-copy",
    rule: "Cotizá en lista venta para el operador",
  }),
  false,
);

assert.equal(shopperTextForBrain({}), "");
assert.equal(shopperTextForBrain({ message: "   " }), "");
assert.equal(
  shopperTextForBrain({
    message: "IsoDec 100",
    history: [{ role: "user", content: "viejo" }],
  }),
  "IsoDec 100",
  "body message wins",
);
assert.equal(
  shopperTextForBrain({
    history: [
      { role: "user", content: "primero" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "techo 10x8" },
    ],
  }),
  "techo 10x8",
  "last user turn",
);
assert.equal(
  shopperTextForBrain({ history: [{ role: "assistant", content: "hola" }] }),
  "",
);
assert.equal(shopperTextForBrain({ text: "alias text" }), "alias text");
assert.equal(shopperTextForBrain({ message: "x".repeat(2500) }).length, 2000);

console.log("storefrontBrainGates.test.js: ok");
