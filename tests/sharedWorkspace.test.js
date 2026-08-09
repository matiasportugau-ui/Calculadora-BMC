/**
 * PMCA SharedWorkspace + email classify heuristic
 * Run: node tests/sharedWorkspace.test.js
 */
import assert from "node:assert/strict";
import {
  normalizeSharedWorkspace,
  formatSharedWorkspaceBlock,
  classifyEmailSignal,
} from "../server/lib/sharedWorkspace.js";

const ws = normalizeSharedWorkspace({
  groupId: "g1",
  groupLabel: "Pérez",
  focusTabId: "t1",
  tabs: [
    { id: "t1", kind: "email", label: "Mail" },
    { id: "bad", kind: "unknown" },
    { id: "t2", kind: "admin", ref: { workbook: "admin" } },
  ],
  sharedMemory: { clientName: "Pérez", flags: ["alerta_admin"] },
});
assert.equal(ws.tabs.length, 2);
assert.equal(ws.groupLabel, "Pérez");

const block = formatSharedWorkspaceBlock(ws);
assert.match(block, /SHARED WORKSPACE/);
assert.match(block, /Pérez/);
assert.match(block, /alerta_admin/);

const consulta = classifyEmailSignal("Hola, necesito cotización techo ISOROOF 100mm galpón");
assert.equal(consulta.label, "consulta_cliente");
assert.equal(consulta.suggestAdminLead, true);

const alerta = classifyEmailSignal("URGENTE reclamo: no llegó el material, problema grave con factura");
assert.equal(alerta.label, "alerta_admin");

const otro = classifyEmailSignal("ok gracias");
assert.equal(otro.label, "otro");

console.log("sharedWorkspace.test.js OK");
