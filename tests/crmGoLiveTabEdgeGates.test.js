// Offline. No Sheets. node tests/crmGoLiveTabEdgeGates.test.js
import assert from "node:assert/strict";
import { CRM_GO_LIVE_TABS, planTabCreates } from "../scripts/lib/crmGoLiveTabs.mjs";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const METAS_HEADERS = ["PERIODO", "TIPO", "META_MONTO", "MONEDA", "NOTAS"];

await check("a different case or a trailing space is a different tab", async () => {
  const plan = planTabCreates(["metas_ventas", "Metas_Ventas ", "audit_log"], CRM_GO_LIVE_TABS);
  assert.deepEqual(plan.creates.map((row) => row.title), ["Metas_Ventas", "AUDIT_LOG"]);
  assert.deepEqual(plan.skips, []);
  assert.deepEqual(plan.creates[0].headers, METAS_HEADERS);
});

await check("an existing title is skipped even when its headers differ", async () => {
  const plan = planTabCreates(["Metas_Ventas"], [
    { title: "Metas_Ventas", headers: ["OTRO"] },
  ]);
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.headerWrites, []);
  assert.deepEqual(plan.skips, ["Metas_Ventas"]);
});

await check("a repeated title in one plan is created once, and a blank title is ignored", async () => {
  const plan = planTabCreates([], [
    { title: "Metas_Ventas", headers: ["A"] },
    { title: "Metas_Ventas", headers: ["B"] },
    { title: "", headers: ["C"] },
    { headers: ["D"] },
    null,
    { title: " ", headers: ["E"] },
  ]);
  assert.deepEqual(plan.creates.map((row) => row.title), ["Metas_Ventas", " "]);
  assert.deepEqual(plan.creates[0].headers, ["A"]);
  assert.deepEqual(plan.skips, ["Metas_Ventas"]);
  assert.equal(plan.headerWrites.length, 2);
});

await check("returned header arrays are copies of the canonical list", async () => {
  const plan = planTabCreates(null, CRM_GO_LIVE_TABS);
  plan.creates[0].headers.push("EXTRA");
  plan.headerWrites[0].headers.push("OTHER");
  assert.deepEqual(CRM_GO_LIVE_TABS[0].headers, METAS_HEADERS);
  assert.equal(plan.creates[0].headers.includes("OTHER"), false);
  assert.equal(plan.headerWrites[0].headers.includes("EXTRA"), false);
  assert.deepEqual(plan.headerWrites[1].headers, [
    "TIMESTAMP", "ACTION", "ROW", "OLD_VALUE", "NEW_VALUE", "REASON", "USER", "SHEET",
  ]);
});

await check("missing inputs create nothing and a headerless spec writes an empty row", async () => {
  assert.deepEqual(planTabCreates(["CRM_Operativo"], null), {
    creates: [],
    skips: [],
    headerWrites: [],
  });
  assert.deepEqual(planTabCreates(undefined, [{ title: "T" }]), {
    creates: [{ title: "T", headers: [] }],
    skips: [],
    headerWrites: [{ title: "T", headers: [] }],
  });
});

console.log(`crmGoLiveTabEdgeGates: ${passed} passed`);
