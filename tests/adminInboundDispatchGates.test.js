// Admin inbound dispatch edges. Offline. No sheet, no network.
// node tests/adminInboundDispatchGates.test.js
import assert from "node:assert/strict";
import {
  dispatchAdminInbound,
  emailInboundFields,
  mercadoLibreQuestionFields,
  metaMessagingAdminFields,
  metaMessagingItems,
  recordEmailAdminInbound,
  recordWhatsAppAdminInbound,
  whatsAppInboundFields,
} from "../server/lib/adminInboundDispatch.js";
import { appendAdminInboundRow } from "../server/lib/adminInboundRow.js";

const now = new Date(2026, 9, 3);

function fakeSheets(columnC = []) {
  const calls = [];
  return {
    calls,
    async client() {
      return {
        spreadsheets: {
          values: {
            async get(args) {
              calls.push({ op: "get", args });
              return { data: { values: columnC.map((id) => [id]) } };
            },
            async append(args) {
              calls.push({ op: "append", args });
              return { data: { updates: { updatedRange: "'Admin.'!A12:M12" } } };
            },
          },
        },
      };
    },
  };
}

function rowOf(sheets) {
  return sheets.calls.find((call) => call.op === "append").args.requestBody.values[0];
}

const sheetConfig = {
  adminInboundRows: true,
  wolfbAdminSheetId: "sheet-admin",
  wolfbAdminTab: "Admin.",
};

{
  const sheets = fakeSheets();
  const result = await dispatchAdminInbound(
    { ...sheetConfig, wolfbDryRun: "0" },
    { channel: "WA", messageId: "m-dry", text: "hola" },
    { getSheets: () => sheets.client(), now },
  );
  assert.equal(result.dryRun, true);
  assert.equal(result.fecha, "03/10/2026");
  assert.equal(sheets.calls.some((call) => call.op === "get"), true);
  assert.equal(sheets.calls.some((call) => call.op === "append"), false);
}

{
  const sheets = fakeSheets();
  let created = 0;
  const result = await dispatchAdminInbound(
    { adminInboundRows: true, wolfbDryRun: false },
    { channel: "WA", messageId: "m1", text: "hola" },
    { getSheets: async () => { created += 1; return sheets.client(); } },
  );
  assert.equal(result.error, "sheet_missing");
  assert.equal(created, 0);
}

{
  const warns = [];
  const result = await dispatchAdminInbound(
    sheetConfig,
    { channel: "sms", messageId: "m1", text: "hola" },
    { getSheets: async () => { throw new Error("sheets_should_not_be_created"); }, logger: { warn(obj) { warns.push(obj); } } },
  );
  assert.deepEqual(result, { ok: false, error: "invalid_channel" });
  assert.equal(warns.length, 0);
}

{
  const result = await dispatchAdminInbound(
    sheetConfig,
    { channel: "WA", messageId: "m1", text: "hola" },
    { getSheets: async () => { throw new Error("auth_down"); } },
  );
  assert.deepEqual(result, { ok: false, error: "sheets_client_failed" });
}

{
  const sheets = fakeSheets();
  const warns = [];
  sheets.client = async () => ({
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [] } }),
        append: async () => { throw new Error("quota"); },
      },
    },
  });
  const result = await dispatchAdminInbound(
    sheetConfig,
    { channel: "WA", messageId: "m-fail", text: "hola" },
    { getSheets: () => sheets.client(), logger: { warn(obj, msg) { warns.push({ obj, msg }); } }, now },
  );
  assert.deepEqual(result, { ok: false, error: "admin_inbound_failed" });
  assert.equal(warns[0].msg, "Admin inbound append failed");
  assert.equal(warns[0].obj.err, "quota");
  assert.equal(warns[0].obj.messageId, "m-fail");
}

{
  const sheets = fakeSheets();
  const consulta = `${"a".repeat(45001)}`;
  await dispatchAdminInbound(
    sheetConfig,
    { channel: "EM", messageId: "e-clip", consulta, cliente: "Ana" },
    { getSheets: () => sheets.client(), now },
  );
  assert.equal(rowOf(sheets)[8], "a".repeat(45000));
}

{
  const sheets = fakeSheets();
  await dispatchAdminInbound(
    { ...sheetConfig, wolfbAdminTab: "Admin 2" },
    {
      channel: "ML",
      messageId: "13667120509",
      text: "b".repeat(45001),
      questionId: "13667120509",
      listingId: "MLU1",
      listingUrl: "https://example.test/item",
    },
    { getSheets: () => sheets.client(), now },
  );
  const consulta = rowOf(sheets)[8];
  assert.equal(consulta.startsWith("b".repeat(45000)), true);
  assert.equal(consulta.includes("b".repeat(45001)), false);
  assert.match(consulta, / — Q:13667120509 · MLU1 · https:\/\/example\.test\/item$/);
  assert.equal(sheets.calls.find((call) => call.op === "get").args.range, "'Admin 2'!C:C");
  assert.equal(sheets.calls.find((call) => call.op === "append").args.range, "'Admin 2'!A:M");
}

{
  const sheets = fakeSheets();
  await dispatchAdminInbound(
    { ...sheetConfig, wolfbAdminTab: "" },
    { channel: " wa ", messageId: "  wamid.1  ", text: "hola", cliente: " =HYPERLINK(\"http://evil.test\")", telefono: "+59899111222" },
    { getSheets: () => sheets.client(), now },
  );
  const row = rowOf(sheets);
  assert.equal(row[0], "WA-wamid.1");
  assert.equal(row[2], "WA:wamid.1");
  assert.equal(row[3], "'+59899111222");
  assert.equal(row[4], "' =HYPERLINK(\"http://evil.test\")");
  assert.equal(row[5], "WhatsApp");
  assert.equal(sheets.calls.find((call) => call.op === "append").args.range, "'Admin.'!A:M");
}

{
  const sheets = fakeSheets(["", "other", " WA:wamid.1 "]);
  const result = await appendAdminInboundRow({
    enabled: true,
    sheets: await sheets.client(),
    sheetId: "sheet-admin",
    channel: "WA",
    messageId: "wamid.1",
    text: "otra vez",
    now,
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.adminRow, 3);
  assert.equal(sheets.calls.some((call) => call.op === "append"), false);
}

{
  const voice = whatsAppInboundFields({
    msg: { id: "v1", from: "59899000111", type: "voice", audio: { id: "a" } },
  });
  assert.equal(voice.media, "audio");
  assert.equal(voice.cliente, "59899000111");
  const sheets = fakeSheets();
  const saved = await recordWhatsAppAdminInbound({
    config: sheetConfig,
    msg: { id: "v1", from: "+59899000111", type: "voice" },
    getSheets: () => sheets.client(),
    now,
  });
  assert.equal(saved.ok, true);
  assert.equal(rowOf(sheets)[3], "'+59899000111");
  assert.equal(rowOf(sheets)[8], "[audio]");
}

{
  const sheets = fakeSheets();
  await recordWhatsAppAdminInbound({
    config: sheetConfig,
    msg: { id: "img1", from: "598", type: "image", image: { caption: "  foto del techo  " } },
    contactName: "Ana",
    getSheets: () => sheets.client(),
    now,
  });
  assert.equal(rowOf(sheets)[8], "foto del techo");
}

{
  const fields = mercadoLibreQuestionFields({
    notification: { resource: "/questions/13667120509?foo=1" },
    question: { from: { id: 0 }, question: { text: "  anidada  " }, item: { id: "MLU1", permalink: "https://example.test/MLU1" } },
  });
  assert.equal(fields.messageId, "13667120509");
  assert.equal(fields.questionId, "13667120509");
  assert.equal(fields.cliente, "ML#0");
  assert.equal(fields.text, "anidada");
  assert.equal(fields.listingId, "MLU1");
  assert.equal(fields.listingUrl, "https://example.test/MLU1");
  const empty = mercadoLibreQuestionFields({ notification: {}, question: {} });
  assert.equal(empty.messageId, "");
  assert.equal(empty.cliente, "");
}

{
  assert.equal(metaMessagingAdminFields("IG", { sender: { id: "1" }, message: { mid: "m", text: "hola" } }), null);
  assert.equal(metaMessagingAdminFields("fb", {
    sender: { id: "PSID", name: "BMC" },
    message: { mid: "echo.1", text: "nuestra", is_echo: true },
    postback: { mid: "pb.1", title: "Quiero precio" },
  }), null);
  assert.deepEqual(metaMessagingAdminFields("fb", {
    sender: { id: "PSID", profile: { name: "Perfil" } },
    message: { mid: "  mid.1  ", attachments: [{ type: "Image" }] },
  }), {
    channel: "FB",
    messageId: "mid.1",
    cliente: "Perfil",
    telefono: "",
    text: "",
    media: "image",
  });
  assert.deepEqual(metaMessagingAdminFields("ig", {
    sender: { id: "IGSID" },
    message: { mid: "ig.1", attachments: [{ type: "animated_image" }] },
  }).media, "image");
  assert.deepEqual(metaMessagingAdminFields("fb", {
    sender: { id: "PSID", name: "Ana" },
    postback: { mid: " pb.1 ", title: "Quiero precio", payload: "PRICE" },
  }), {
    channel: "FB",
    messageId: "pb.1",
    cliente: "Ana",
    telefono: "",
    text: "Quiero precio",
  });
  assert.equal(metaMessagingAdminFields("fb", {
    sender: { id: "PSID" },
    postback: { mid: "pb.2", payload: "PRICE" },
  }).text, "PRICE");
  assert.equal(metaMessagingAdminFields("fb", { sender: { id: "PSID" }, postback: { title: "Hola" } }), null);
  assert.equal(metaMessagingAdminFields("ig", { sender: { id: "IGSID" }, message: { text: "sin mid" } }), null);
}

{
  assert.deepEqual(metaMessagingItems({
    entry: [
      { changes: [{ field: "comments", value: { text: "comentario" } }] },
      { messaging: [{ sender: { id: "PSID" }, message: { mid: "m", text: "hola" } }] },
    ],
  }), [{ sender: { id: "PSID" }, message: { mid: "m", text: "hola" } }]);
  assert.deepEqual(metaMessagingItems({ entry: { messaging: [{ sender: { id: "1" } }] } }), []);
}

{
  assert.equal(emailInboundFields({ messageId: " <a@b> ", asunto: "  Cotización  ", cuerpo: "   " }).text, "Cotización");
  const sheets = fakeSheets();
  const saved = await recordEmailAdminInbound({
    config: sheetConfig,
    messageId: "<a@b>",
    remitente: "ana@cliente.com",
    asunto: "=CMD()",
    getSheets: () => sheets.client(),
    now,
  });
  assert.equal(saved.ok, true);
  assert.equal(rowOf(sheets)[8], "'=CMD()");
  let created = 0;
  const empty = await recordEmailAdminInbound({
    config: sheetConfig,
    messageId: "<empty@b>",
    asunto: "  ",
    cuerpo: "",
    getSheets: async () => { created += 1; throw new Error("sheets_should_not_be_created"); },
  });
  assert.deepEqual(empty, { ok: false, error: "consulta_required" });
  assert.equal(created, 0);
}

console.log("adminInboundDispatchGates OK");
