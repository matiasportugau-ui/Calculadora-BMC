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
assert.match(b, /tipoAguas/);

const withWs = formatOperatorContextBlock({
  surface: "panelin_chat",
  workspace: {
    groupId: "g1",
    groupLabel: "Cliente test",
    focusTabId: "calc-1",
    tabs: [
      { id: "email-1", kind: "email", label: "Email", ref: { conversationId: "abc" } },
      { id: "calc-1", kind: "calc", label: "Calc" },
    ],
    sharedMemory: { flags: ["consulta_cliente"] },
  },
});
assert.match(withWs, /SHARED WORKSPACE/);
assert.match(withWs, /Cliente test/);
assert.match(withWs, /\[email\]/);
assert.match(withWs, /consulta_cliente/);

console.log("coworkOperatorContext.test.js OK");
