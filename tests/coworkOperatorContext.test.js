import assert from "node:assert/strict";
import { formatOperatorContextBlock } from "../server/lib/coworkFrames.js";

const b = formatOperatorContextBlock({
  defaults: {
    listaPrecios: "venta",
    aguasTecho: 1,
    crmFaltaInfoPrefix: "Falta información de:",
  },
});
assert.match(b, /wa_lead_to_admin/);
assert.match(b, /venta/);
console.log("coworkOperatorContext.test.js OK");
