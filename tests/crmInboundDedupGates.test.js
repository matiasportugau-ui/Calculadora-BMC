// CRM card dedup and go-live tab idempotency. Offline.
// node tests/crmInboundDedupGates.test.js
import assert from "node:assert/strict";
import { filterCrmMlRowsCoveredByAdmin, mlQuestionIdsOnAdminRows } from "../src/utils/crmMlAdminDedup.js";
import { planTabCreates } from "../scripts/lib/crmGoLiveTabs.mjs";

{
  const ids = mlQuestionIdsOnAdminRows([
    { id: "ML-", consulta: "hola q : 111111 y tambien Q:222222" },
    { id: "ML-12345", consulta: "Q:12345" },
  ]);
  assert.equal(ids.has("111111"), true);
  assert.equal(ids.has("222222"), false);
  assert.equal(ids.has("12345"), true);
  assert.equal(mlQuestionIdsOnAdminRows([{ id: "row", consulta: "Q:12345" }]).has("12345"), false);
  assert.equal(mlQuestionIdsOnAdminRows(null).size, 0);
}

{
  const visible = filterCrmMlRowsCoveredByAdmin(
    [{ id: "ADMIN-2", consulta: "q : 13667120509 extra" }],
    [
      { id: "CRM-1", mlQuestionId: "13667120509" },
      { id: "CRM-2", mlQuestionId: 222222 },
    ],
  );
  assert.deepEqual(visible.map((row) => row.id), ["CRM-2"]);
}

{
  const hidden = filterCrmMlRowsCoveredByAdmin(
    [{ id: "CRM-9" }],
    [{ id: "CRM-9", mlQuestionId: "999999999" }],
  );
  assert.deepEqual(hidden, []);
  const numeric = filterCrmMlRowsCoveredByAdmin(
    [{ id: "ML-13667120509" }],
    [{ id: "CRM-3", mlQuestionId: 13667120509 }],
  );
  assert.deepEqual(numeric, []);
  assert.deepEqual(filterCrmMlRowsCoveredByAdmin(null, null), []);
}

{
  const spec = { title: "AUDIT_LOG", headers: ["TIMESTAMP"] };
  const plan = planTabCreates(["Metas_Ventas"], [
    { title: "Metas_Ventas", headers: ["PERIODO"] },
    { title: "Metas_Ventas", headers: ["SHOULD_NOT_CREATE"] },
    { title: "metas_ventas", headers: ["PERIODO"] },
    { title: "Metas_Ventas ", headers: ["PERIODO"] },
    { headers: ["NO_TITLE"] },
    spec,
    null,
  ]);
  assert.deepEqual(plan.skips, ["Metas_Ventas", "Metas_Ventas"]);
  assert.deepEqual(plan.creates.map((row) => row.title), ["metas_ventas", "Metas_Ventas ", "AUDIT_LOG"]);
  spec.headers.push("MUTATED_SPEC");
  const created = plan.creates.find((row) => row.title === "AUDIT_LOG");
  const write = plan.headerWrites.find((row) => row.title === "AUDIT_LOG");
  assert.deepEqual(created.headers, ["TIMESTAMP"]);
  write.headers.push("EXTRA");
  assert.deepEqual(created.headers, ["TIMESTAMP"]);
  created.headers.push("NO");
  assert.deepEqual(write.headers, ["TIMESTAMP", "EXTRA"]);
}

{
  const empty = planTabCreates(null, [{ title: "AUDIT_LOG" }]);
  assert.deepEqual(empty.creates, [{ title: "AUDIT_LOG", headers: [] }]);
  assert.deepEqual(empty.headerWrites, [{ title: "AUDIT_LOG", headers: [] }]);
  assert.deepEqual(empty.skips, []);
}

console.log("crmInboundDedupGates OK");
