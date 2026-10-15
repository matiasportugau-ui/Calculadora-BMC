// Offline. No Mercado Libre, no Sheets, no auto-answer network.
// node tests/mlWebhookPipelineGates.test.js
import assert from "node:assert/strict";
import { createMlWebhookProcessor } from "../server/lib/mlWebhookService.js";

const question = { id: 111, text: "tienen isodec?", from: { id: 7711 }, item_id: "MLU1" };

function processor(overrides) {
  return createMlWebhookProcessor({
    ml: {},
    config: {
      bmcSheetId: "sheet-1",
      omniMlShadowWrite: false,
      adminInboundRows: false,
      googleApplicationCredentials: "/cfg/sa.json",
    },
    fetchResource: async () => question,
    ...overrides,
  });
}

const notice = (resource) => ({
  body: { topic: "questions", ...(resource ? { resource } : {}) },
  headers: {},
  autoMode: { fullAuto: true },
});

{
  const prevCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/env/nope.json";
  const seen = [];
  const batches = [];
  const sync = processor({
    syncMLCRM: async (args) => {
      seen.push(args.credsPath);
      return {
        rows: [
          { questionId: 111 },
          { questionId: "222" },
          { questionId: "" },
          { questionId: null },
          { questionId: 0 },
          { questionId: "111" },
        ],
      };
    },
    autoAnswerPipeline: async ({ rows }) => {
      batches.push(rows.map((row) => String(row.questionId)));
      return { answered: rows.length };
    },
  });
  const first = await sync.processNotification(notice("/questions/111"));
  assert.deepEqual(batches, [["111"]]);
  assert.equal(first.sync.autoAnswered, 1);
  assert.deepEqual(seen, ["/cfg/sa.json"]);
  assert.equal(sync._autoAnswerResourceIds.has("222"), false);
  assert.equal(sync._autoAnswerResourceIds.has("0"), false);
  await sync.processNotification(notice("/questions/111"));
  assert.equal(batches.length, 1);
  const second = await sync.processNotification(notice("/questions/222"));
  assert.deepEqual(batches[1], ["222"]);
  assert.equal(second.sync.autoAnswered, 1);
  if (prevCreds === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCreds;
}

{
  const qids = [];
  const answer = async ({ rows }) => {
    qids.push(rows.map((row) => String(row.questionId)));
    return { answered: rows.length };
  };
  await processor({
    syncMLCRM: async () => ({ rows: [{ questionId: 0 }, { questionId: "0" }, { questionId: "9" }] }),
    autoAnswerPipeline: answer,
  }).processNotification(notice("/questions/0"));
  assert.deepEqual(qids, [["0"]]);

  const open = [];
  await processor({
    syncMLCRM: async () => ({ rows: [{ questionId: "111" }, { questionId: "222" }, { questionId: 0 }] }),
    autoAnswerPipeline: async ({ rows }) => {
      open.push(rows.map((row) => String(row.questionId)));
      return { answered: rows.length };
    },
  }).processNotification(notice());
  assert.deepEqual(open, [["111", "222"]]);
}

{
  let calls = 0;
  const off = await processor({
    syncMLCRM: async () => ({ rows: [{ questionId: "111" }] }),
    autoAnswerPipeline: async () => { calls += 1; return { answered: 1 }; },
  }).processNotification({
    body: { topic: "questions", resource: "/questions/111" },
    headers: {},
    autoMode: { fullAuto: false },
  });
  const bare = await processor({
    syncMLCRM: async () => ({ synced: 1 }),
    autoAnswerPipeline: async () => { calls += 1; return { answered: 1 }; },
  }).processNotification(notice("/questions/111"));
  assert.equal(calls, 0);
  assert.equal(off.sync.autoAnswered, undefined);
  assert.equal(bare.sync.synced, 1);
}

{
  let syncs = 0;
  const noSheet = await processor({
    config: { omniMlShadowWrite: false, adminInboundRows: false },
    syncMLCRM: async () => { syncs += 1; return { rows: [] }; },
  }).processNotification(notice("/questions/111"));
  const missingFn = await processor({
    config: { bmcSheetId: "sheet-1", omniMlShadowWrite: false },
    syncMLCRM: undefined,
  }).processNotification(notice("/questions/111"));
  assert.deepEqual(noSheet.sync, { synced: 0 });
  assert.deepEqual(missingFn.sync, { synced: 0 });
  assert.equal(syncs, 0);
}

{
  const warns = [];
  let syncs = 0;
  const result = await processor({
    config: {
      bmcSheetId: "sheet-1",
      omniMlShadowWrite: true,
      adminInboundRows: false,
      databaseUrl: "postgres://offline",
    },
    persistOmni: async () => { throw new Error("db down"); },
    syncMLCRM: async () => { syncs += 1; return { synced: 1, rows: [] }; },
    logger: { warn(obj, msg) { warns.push({ obj, msg }); } },
  }).processNotification(notice("/questions/111"));
  assert.equal(result.ok, true);
  assert.equal(result.omni, null);
  assert.equal(syncs, 1);
  assert.equal(warns[0].msg, "ML omni webhook persist failed");
  assert.equal(warns[0].obj.err, "db down");
  assert.equal(warns[0].obj.resourceId, "111");
}

{
  let sheets = 0;
  const warns = [];
  const failed = await processor({
    config: {
      bmcSheetId: "sheet-1",
      omniMlShadowWrite: false,
      adminInboundRows: true,
      wolfbAdminSheetId: "admin-sheet",
    },
    fetchResource: async () => { throw new Error("ml 500"); },
    syncMLCRM: async () => ({ synced: 1, rows: [] }),
    getSheets: async () => { sheets += 1; throw new Error("sheets"); },
    logger: { warn(obj, msg) { warns.push({ obj, msg }); } },
  }).processNotification(notice("/questions/111"));
  const empty = await processor({
    config: {
      bmcSheetId: "sheet-1",
      omniMlShadowWrite: false,
      adminInboundRows: true,
      wolfbAdminSheetId: "admin-sheet",
    },
    fetchResource: async () => null,
    syncMLCRM: async () => ({ synced: 1, rows: [] }),
    getSheets: async () => { sheets += 1; throw new Error("sheets"); },
  }).processNotification(notice("/questions/111"));
  assert.equal(failed.ok, true);
  assert.deepEqual(failed.admin, { ok: false, error: "question_fetch_failed" });
  assert.equal(warns[0].msg, "ML admin inbound question fetch failed");
  assert.equal(warns[0].obj.err, "ml 500");
  assert.equal(empty.admin.error, "consulta_required");
  assert.equal(sheets, 0);
}

{
  let syncs = 0;
  const messages = await processor({
    syncMLCRM: async () => { syncs += 1; throw new Error("should-not-sync-messages"); },
    fetchResource: async () => { throw new Error("should-not-fetch"); },
  }).processNotification({
    body: { topic: "messages", resource: "/messages/packs/1" },
    headers: {},
  });
  assert.equal(messages.ok, true);
  assert.equal(messages.sync, null);
  assert.equal(messages.admin, null);
  assert.equal(syncs, 0);
  await assert.rejects(
    () => processor({
      syncMLCRM: async () => { throw new Error("sheets_unavailable"); },
    }).processNotification(notice("/questions/111")),
    /sheets_unavailable/,
  );
}

console.log("mlWebhookPipelineGates OK");
