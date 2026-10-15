// Channel adapters → Admin inbound row. Offline. No live sheet.
// node tests/adminInboundChannels.test.js
import crypto from "node:crypto";
import { createMlWebhookProcessor } from "../server/lib/mlWebhookService.js";
import { handleMetaMessagingWebhook } from "../server/lib/omni/metaWebhookHandler.js";
import {
  recordWhatsAppAdminInbound,
  recordEmailAdminInbound,
} from "../server/lib/adminInboundDispatch.js";

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name}`);
    failed += 1;
  }
}

function fakeSheets() {
  const calls = { gets: 0, appends: 0, rows: [] };
  return {
    calls,
    async client() {
      return {
        spreadsheets: {
          values: {
            get: async () => {
              calls.gets += 1;
              return { data: { values: calls.rows.map((row) => [row[2]]) } };
            },
            append: async ({ requestBody }) => {
              calls.appends += 1;
              const row = requestBody.values[0];
              calls.rows.push(row);
              const n = calls.rows.length;
              return { data: { updates: { updatedRange: `'Admin.'!A${n}:M${n}` } } };
            },
          },
        },
      };
    },
  };
}

const sheetConfig = {
  adminInboundRows: true,
  wolfbAdminSheetId: "sheet-admin",
  wolfbAdminTab: "Admin.",
};

const now = new Date(2026, 9, 3);

const waOffSheets = fakeSheets();
const waOff = await recordWhatsAppAdminInbound({
  config: { adminInboundRows: false },
  msg: { id: "wamid.1", from: "59899111222", type: "text", text: { body: "hola" } },
  contactName: "Ana",
  getSheets: async () => { throw new Error("sheets_should_not_be_created"); },
  now,
});
assert("WhatsApp flag off skips before a sheets client", waOff.skipped === "flag_off" && waOffSheets.calls.gets === 0);

const waSheets = fakeSheets();
const waImage = await recordWhatsAppAdminInbound({
  config: sheetConfig,
  msg: { id: "wamid.img", from: "59899111222", type: "image", image: { id: "media-1" } },
  contactName: "Ana",
  getSheets: waSheets.client,
  now,
});
const waRow = waSheets.calls.rows[0];
assert("WhatsApp image appends one Pendiente row", waImage.ok === true && waImage.duplicate !== true && waSheets.calls.appends === 1);
assert("WhatsApp image row uses the message id and an empty reply", waRow[0] === "WA-wamid.img" && waRow[2] === "WA:wamid.img" && waRow[3] === "59899111222" && waRow[4] === "Ana" && waRow[5] === "WhatsApp" && waRow[8] === "[imagen]" && waRow[9] === "" && waRow[11] === "Pendiente" && waRow[1] === "03/10/2026");

const waAgain = await recordWhatsAppAdminInbound({
  config: sheetConfig,
  msg: { id: "wamid.img", from: "59899111222", type: "image", image: { id: "media-1" } },
  contactName: "Ana",
  getSheets: waSheets.client,
  now,
});
assert("WhatsApp retry does not append a second row", waAgain.duplicate === true && waSheets.calls.appends === 1);

const waFormula = fakeSheets();
await recordWhatsAppAdminInbound({
  config: sheetConfig,
  msg: { id: "wamid.eq", from: "59899111222", type: "text", text: { body: "=CMD()" } },
  contactName: "Ana",
  getSheets: waFormula.client,
  now,
});
assert("WhatsApp text neutralizes a formula cell", waFormula.calls.rows[0][8] === "'=CMD()");

const notification = {
  topic: "questions",
  resource: "/questions/13667120509",
  user_id: 999,
};
const question = {
  id: 13667120509,
  text: "tienen isodec 50mm?",
  from: { id: 7711, nickname: "paneles.uy" },
  item_id: "MLU757318280",
  permalink: "https://articulo.mercadolibre.com.uy/MLU-757318280",
  status: "UNANSWERED",
};

let sheetGets = 0;
const mlOff = await createMlWebhookProcessor({
  ml: {},
  config: { adminInboundRows: false, bmcSheetId: "crm-sheet" },
  fetchResource: async () => { throw new Error("fetch_should_not_run"); },
  syncMLCRM: async () => ({ rows: [] }),
  getSheets: async () => { sheetGets += 1; throw new Error("sheets_should_not_be_created"); },
}).processNotification({ body: notification, headers: {} });
assert("Mercado Libre flag off keeps CRM sync and skips sheets", mlOff.admin?.skipped === "flag_off" && mlOff.sync && sheetGets === 0);

const mlSheets = fakeSheets();
let syncCalls = 0;
let fetches = 0;
const mlProcessor = createMlWebhookProcessor({
  ml: {},
  config: { ...sheetConfig, bmcSheetId: "crm-sheet", omniMlShadowWrite: false },
  fetchResource: async () => { fetches += 1; return question; },
  syncMLCRM: async () => { syncCalls += 1; return { rows: [{ questionId: "13667120509" }] }; },
  getSheets: mlSheets.client,
});
const mlFirst = await mlProcessor.processNotification({ body: notification, headers: {} });
const mlSecond = await mlProcessor.processNotification({ body: notification, headers: {} });
const mlRow = mlSheets.calls.rows[0];
assert("Mercado Libre question appends one row and a retry does not", mlFirst.admin?.duplicate !== true && mlSecond.admin?.duplicate === true && mlSheets.calls.appends === 1);
assert("Mercado Libre consulta keeps the question trailer", mlRow[5] === "Mercado Libre" && mlRow[4] === "paneles.uy" && mlRow[8] === "tienen isodec 50mm? — Q:13667120509 · MLU757318280 · https://articulo.mercadolibre.com.uy/MLU-757318280");
assert("Mercado Libre CRM sync still runs on each delivery", syncCalls === 2 && fetches === 2);

const mlMessage = await createMlWebhookProcessor({
  ml: {},
  config: sheetConfig,
  fetchResource: async () => { throw new Error("messages_should_not_fetch_for_admin"); },
  getSheets: async () => { throw new Error("sheets_should_not_be_created"); },
}).processNotification({ body: { topic: "messages", resource: "/messages/packs/1" }, headers: {} });
assert("Mercado Libre post-sale messages do not write an Admin row", mlMessage.admin === null);

function signed(body, secret) {
  const raw = Buffer.from(JSON.stringify(body));
  const signatureHeader = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return { raw, signatureHeader };
}

const igImage = {
  object: "instagram",
  entry: [{
    messaging: [{
      sender: { id: "IGSID_1" },
      message: { mid: "ig.mid.1", attachments: [{ type: "image" }] },
    }],
  }],
};
const igSigned = signed(igImage, "secret");
const igSheets = fakeSheets();
let igPersists = 0;
const ig = handleMetaMessagingWebhook({
  channel: "ig",
  enabled: false,
  appSecret: "secret",
  rawBodyBuffer: igSigned.raw,
  signatureHeader: igSigned.signatureHeader,
  config: sheetConfig,
  persist: async () => { igPersists += 1; return { ok: true }; },
  getSheets: igSheets.client,
});
await ig.processing;
assert("Instagram image writes a row while omni persist stays off", ig.status === 200 && igPersists === 0 && igSheets.calls.rows[0][0] === "IG-ig.mid.1" && igSheets.calls.rows[0][5] === "Instagram" && igSheets.calls.rows[0][8] === "[imagen]" && igSheets.calls.rows[0][4] === "IGSID_1");

const echoBody = {
  entry: [{ messaging: [{ sender: { id: "PSID_1", name: "BMC" }, message: { mid: "echo.1", text: "respuesta nuestra", is_echo: true } }] }],
};
const echoSigned = signed(echoBody, "secret");
const echoSheets = fakeSheets();
const echo = handleMetaMessagingWebhook({
  channel: "fb",
  enabled: false,
  appSecret: "secret",
  rawBodyBuffer: echoSigned.raw,
  signatureHeader: echoSigned.signatureHeader,
  config: sheetConfig,
  getSheets: echoSheets.client,
});
await echo.processing;
assert("Messenger echo does not append a row", echoSheets.calls.appends === 0);

const offBody = signed({ entry: [{ messaging: [{ sender: { id: "PSID_1" }, message: { mid: "m", text: "hola" } }] }] }, "secret");
let offSheets = 0;
const metaOff = handleMetaMessagingWebhook({
  channel: "fb",
  enabled: false,
  appSecret: "secret",
  rawBodyBuffer: offBody.raw,
  signatureHeader: "sha256=bad",
  config: {},
  persist: async () => { throw new Error("must_not_persist"); },
  getSheets: async () => { offSheets += 1; throw new Error("sheets_should_not_be_created"); },
});
await metaOff.processing;
assert("Messenger with both flags off still acks without sheets", metaOff.body.skipped === "flag_off" && offSheets === 0);

const bothBody = signed({
  entry: [{ messaging: [{ sender: { id: "PSID_9", name: "Cliente" }, message: { mid: "fb.mid", text: "precio?" } }] }],
}, "secret");
const bothSheets = fakeSheets();
let bothPersists = 0;
const both = handleMetaMessagingWebhook({
  channel: "fb",
  enabled: true,
  appSecret: "secret",
  rawBodyBuffer: bothBody.raw,
  signatureHeader: bothBody.signatureHeader,
  config: { ...sheetConfig, databaseUrl: "postgres://unused" },
  persist: async () => { bothPersists += 1; return { duplicate: false, message_id: "m1" }; },
  notifyOwner: async () => ({ skipped: "test" }),
  getSheets: bothSheets.client,
});
await both.processing;
assert("Messenger keeps omni persist and adds one Facebook row", bothPersists === 1 && bothSheets.calls.rows[0][5] === "Facebook" && bothSheets.calls.rows[0][8] === "precio?" && bothSheets.calls.rows[0][4] === "Cliente");

const mailOff = await recordEmailAdminInbound({
  config: {},
  messageId: "<a@b>",
  remitente: "ana@cliente.com",
  asunto: "Cotización",
  cuerpo: "Necesito 50mm",
  getSheets: async () => { throw new Error("sheets_should_not_be_created"); },
});
assert("Email flag off skips before a sheets client", mailOff.skipped === "flag_off");

const mailSheets = fakeSheets();
const mail = await recordEmailAdminInbound({
  config: sheetConfig,
  messageId: "<a@b>",
  remitente: "ana@cliente.com",
  asunto: "Cotización",
  cuerpo: "Necesito 50mm",
  getSheets: mailSheets.client,
  now,
});
const mailRow = mailSheets.calls.rows[0];
assert("Email appends one row keyed by the full message id", mail.ok === true && mailRow[0] === "EM-<a@b>" && mailRow[2] === "EM:<a@b>" && mailRow[4] === "ana@cliente.com" && mailRow[5] === "Email" && mailRow[8] === "Cotización\n\nNecesito 50mm" && mailRow[9] === "");
const mailDup = await recordEmailAdminInbound({
  config: sheetConfig,
  messageId: "<a@b>",
  remitente: "ana@cliente.com",
  asunto: "Cotización",
  cuerpo: "Necesito 50mm",
  getSheets: mailSheets.client,
  now,
});
assert("Email retry does not append a second row", mailDup.duplicate === true && mailSheets.calls.appends === 1);

const noId = await recordEmailAdminInbound({
  config: sheetConfig,
  remitente: "ana@cliente.com",
  cuerpo: "sin id",
  getSheets: async () => { throw new Error("sheets_should_not_be_created"); },
});
assert("Email without a message id does not touch sheets", noId.error === "message_id_required");

console.log(`\nadminInboundChannels: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
