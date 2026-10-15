import assert from "node:assert/strict";
import { CRM_GO_LIVE_TABS, planTabCreates } from "../scripts/lib/crmGoLiveTabs.mjs";

const first = planTabCreates(["CRM_Operativo"], CRM_GO_LIVE_TABS);
assert.deepEqual(first.creates.map((row) => row.title), ["Metas_Ventas", "AUDIT_LOG"]);
assert.deepEqual(first.creates[0].headers, ["PERIODO", "TIPO", "META_MONTO", "MONEDA", "NOTAS"]);
assert.deepEqual(
  first.creates[1].headers,
  ["TIMESTAMP", "ACTION", "ROW", "OLD_VALUE", "NEW_VALUE", "REASON", "USER", "SHEET"],
);
assert.deepEqual(first.skips, []);
assert.deepEqual(first.headerWrites.map((row) => row.title), ["Metas_Ventas", "AUDIT_LOG"]);

const titlesAfter = ["CRM_Operativo", ...first.creates.map((row) => row.title)];
const second = planTabCreates(titlesAfter, CRM_GO_LIVE_TABS);
assert.deepEqual(second.creates, []);
assert.deepEqual(second.headerWrites, []);
assert.deepEqual(second.skips, ["Metas_Ventas", "AUDIT_LOG"]);

console.log("crmGoLiveTabs OK");
