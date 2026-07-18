/**
 * Live Assist contract tests — pure helpers + chat body + server normalize.
 * Spec: SDD-PANELIN-COWORK D3, ADR-003, §10.1–10.3
 * Run: node tests/liveAssist.test.js
 */
import {
  resolveLiveIntervalMs,
  isLiveAutosendEnabled,
  buildLiveAssistAttachment,
  buildLiveAssistChatRequest,
  LiveFrameBuffer,
  LIVE_ASSIST_DEFAULT_INTERVAL_MS,
  sharedLiveFrameBuffer,
} from "../src/hooks/liveAssistCore.js";
import { buildAgentChatRequestBody } from "../src/hooks/useChat.js";
import { normalizeAttachments, formatOperatorContextBlock, buildMultimodalMessages } from "../server/lib/coworkFrames.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

/** Async-aware group: awaits Promise.resolve(fn()) so async groups fail the suite. */
async function group(name, fn) {
  console.log(`\n— ${name}`);
  await Promise.resolve(fn());
}

const FRAME_DATA = Buffer.from("live-assist-frame-payload-xxxxxxxxxxxxxxxx").toString("base64");

const sampleFrame = {
  type: "image",
  mime: "image/jpeg",
  data: FRAME_DATA,
  source: "oneshot",
  capturedAt: "2026-07-17T12:00:00.000Z",
  bytes: 48,
};

async function main() {
  await group("resolveLiveIntervalMs / autosend defaults (ADR-003)", () => {
    assert(resolveLiveIntervalMs(undefined) === LIVE_ASSIST_DEFAULT_INTERVAL_MS, "default 4000");
    assert(resolveLiveIntervalMs("4000") === 4000, "string 4000");
    assert(resolveLiveIntervalMs(2500) === 2500, "custom 2500");
    assert(resolveLiveIntervalMs(100) === LIVE_ASSIST_DEFAULT_INTERVAL_MS, "reject too small");
    assert(resolveLiveIntervalMs(999999) === LIVE_ASSIST_DEFAULT_INTERVAL_MS, "reject too large");
    assert(isLiveAutosendEnabled(undefined) === false, "autosend off undefined");
    assert(isLiveAutosendEnabled("0") === false, "autosend off 0");
    assert(isLiveAutosendEnabled("false") === false, "autosend off false");
    assert(isLiveAutosendEnabled("1") === true, "autosend on 1 only when explicit");
  });

  await group("buildLiveAssistAttachment source tagging", () => {
    const live = buildLiveAssistAttachment(sampleFrame, { liveAssist: true });
    assert(live.source === "live_assist", "Live ON forces live_assist source");
    assert(live.mime === "image/jpeg", "mime jpeg");
    assert(live.data === FRAME_DATA, "data passthrough");
    const off = buildLiveAssistAttachment(sampleFrame, { liveAssist: false });
    assert(off.source === "oneshot", "Live OFF keeps oneshot");
    assert(buildLiveAssistAttachment(null) === null, "null frame");
    assert(buildLiveAssistAttachment({}) === null, "empty frame");
  });

  await group("LiveFrameBuffer interval buffer + consume-on-send", () => {
    const buf = new LiveFrameBuffer();
    assert(buf.liveOn === false, "starts off");
    buf.setLiveOn(true);
    assert(buf.liveOn === true, "live on");
    assert(buf.writeLiveFrame({ data: FRAME_DATA, mime: "image/jpeg" }) === true, "write live");
    assert(buf.tickCount === 1, "tick 1");
    assert(buf.lastFrame.source === "live_assist", "buffered as live_assist");
    buf.writeLiveFrame({ data: FRAME_DATA + "Y", mime: "image/jpeg", capturedAt: "2026-07-17T12:00:04.000Z" });
    assert(buf.tickCount === 2, "tick 2");
    const att = buf.consumeForSend();
    assert(att && att.source === "live_assist", "consume tags live_assist");
    assert(att.data.length >= FRAME_DATA.length, "latest frame data");
    assert(buf.lastFrame != null, "buffer not cleared on consume");
    buf.stop();
    assert(buf.liveOn === false, "stop clears live flag");
    buf.writeFrame(sampleFrame, "oneshot");
    const att2 = buf.consumeForSend();
    assert(att2.source === "oneshot", "after stop, oneshot source");
  });

  await group("buildLiveAssistChatRequest attach-only-on-send contract", () => {
    const req = buildLiveAssistChatRequest({
      text: "¿qué ves en la planilla?",
      frame: sampleFrame,
      liveAssist: true,
      surface: "panelin_chat",
    });
    assert(req.hasAttachment === true, "has attachment");
    assert(req.attachments[0].source === "live_assist", "attachment source live_assist");
    assert(req.operatorContext.liveAssist === true, "operatorContext.liveAssist");
    assert(req.body.operatorContext.liveAssist === true, "body operatorContext");
    const last = req.body.messages[req.body.messages.length - 1];
    assert(last.role === "user", "last user");
    assert(Array.isArray(last.attachments) && last.attachments[0].source === "live_assist", "api msg attachment");
    const bare = buildLiveAssistChatRequest({ text: "hola", liveAssist: true });
    assert(bare.hasAttachment === false, "no frame no attachment");
    assert(bare.operatorContext.liveAssist === true, "live flag still true");
    assert(bare.requiresUserText === true, "requires user text — no autosend invent");
  });

  await group("buildAgentChatRequestBody (shipped useChat path)", () => {
    const body = buildAgentChatRequestBody({
      history: [{ role: "assistant", content: "ok" }],
      userText: "mirá esto",
      attachments: [{ mime: "image/jpeg", data: FRAME_DATA, source: "live_assist", capturedAt: "t" }],
      operatorContext: { surface: "panelin_chat", liveAssist: true, workbook: "admin" },
      calcState: { scenario: "solo_techo" },
      conversationId: "11111111-1111-4111-8111-111111111111",
    });
    assert(body.operatorContext.liveAssist === true, "body liveAssist");
    assert(body.messages.length === 2, "history + user");
    const u = body.messages[1];
    assert(u.attachments[0].source === "live_assist", "useChat body source");
    assert(u.attachments[0].data === FRAME_DATA, "useChat body data");
    assert(body.surface === "panelin_chat", "surface");
  });

  await group("server normalizeAttachments accepts live_assist", () => {
    const prev = process.env.COWORK_VISION_ENABLED;
    process.env.COWORK_VISION_ENABLED = "true";
    const r = normalizeAttachments([
      { mime: "image/jpeg", data: FRAME_DATA, source: "live_assist", capturedAt: "2026-07-17T12:00:00.000Z" },
    ]);
    assert(r.ok === true, "ok");
    assert(r.attachments.length === 1, "1 att");
    assert(r.attachments[0].source === "live_assist", "source preserved");
    const block = formatOperatorContextBlock({ liveAssist: true, surface: "panelin_chat" });
    assert(block.includes("Live assist"), "operator context block mentions Live");
    process.env.COWORK_VISION_ENABLED = "false";
    const off = normalizeAttachments([{ mime: "image/jpeg", data: FRAME_DATA, source: "live_assist" }]);
    assert(off.attachments.length === 0, "vision disabled drops");
    assert(off.dropped.some((d) => d.reason === "vision_disabled"), "vision_disabled reason");
    if (prev === undefined) delete process.env.COWORK_VISION_ENABLED;
    else process.env.COWORK_VISION_ENABLED = prev;
  });

  await group("openai/grok multimodal keeps image on last user (failover path)", () => {
    const prev = process.env.COWORK_VISION_ENABLED;
    process.env.COWORK_VISION_ENABLED = "true";
    const { messages, framesAccepted, hasVision } = buildMultimodalMessages(
      [
        { role: "user", content: "hi" },
        {
          role: "user",
          content: "que ves",
          attachments: [{ mime: "image/jpeg", data: FRAME_DATA, source: "live_assist" }],
        },
      ],
      "openai",
    );
    assert(hasVision === true, "hasVision openai");
    assert(framesAccepted === 1, "framesAccepted 1");
    const last = messages[messages.length - 1];
    assert(Array.isArray(last.content), "openai content is parts array");
    assert(
      last.content.some((p) => p.type === "image_url" || p.image_url),
      "openai includes image_url part",
    );
    const grok = buildMultimodalMessages(
      [{ role: "user", content: "x", attachments: [{ mime: "image/jpeg", data: FRAME_DATA, source: "live_assist" }] }],
      "grok",
    );
    assert(grok.hasVision === true, "grok hasVision");
    assert(Array.isArray(grok.messages[0].content), "grok multimodal content");
    if (prev === undefined) delete process.env.COWORK_VISION_ENABLED;
    else process.env.COWORK_VISION_ENABLED = prev;
  });

  await group("sharedLiveFrameBuffer singleton (D2 surfaces)", () => {
    sharedLiveFrameBuffer.clear();
    sharedLiveFrameBuffer.setLiveOn(true);
    sharedLiveFrameBuffer.writeLiveFrame({ data: FRAME_DATA, mime: "image/jpeg" });
    const a = sharedLiveFrameBuffer.consumeForSend();
    assert(a && a.source === "live_assist", "shared buffer live_assist");
    sharedLiveFrameBuffer.stop();
    sharedLiveFrameBuffer.clear();
  });

  await group("static presence of Live controls + centralized sendWithLiveAssist", () => {
    const panel = fs.readFileSync(path.join(__dirname, "../src/components/PanelinChatPanel.jsx"), "utf8");
    const admin = fs.readFileSync(path.join(__dirname, "../src/components/AdminIngresoModule.jsx"), "utf8");
    const toolbar = fs.readFileSync(path.join(__dirname, "../src/components/cowork/CoWorkToolbar.jsx"), "utf8");
    const agentChat = fs.readFileSync(path.join(__dirname, "../server/routes/agentChat.js"), "utf8");
    assert(panel.includes("useScreenCoWork"), "Panelin mounts useScreenCoWork");
    assert(panel.includes("sendWithLiveAssist"), "Panelin has sendWithLiveAssist helper");
    assert(panel.includes("consumeFrameForSend"), "Panelin consumes buffer on send");
    // All non-compose send sites must go through sendWithLiveAssist (not bare send(hint/text))
    assert(!/onClick=\{\(\) => send\(hint\)\}/.test(panel), "welcome hints not bare send(hint)");
    assert(panel.includes("sendWithLiveAssist(hint)"), "welcome hints use sendWithLiveAssist");
    assert(panel.includes("sendWithLiveAssist(text)"), "suggestion chips use sendWithLiveAssist");
    assert(!/send\(text\);\s*\}/.test(panel.replace(/sendWithLiveAssist\(text\)/g, "OK")), "no bare send(text) in chip path");
    assert(admin.includes("useScreenCoWork"), "Admin mounts useScreenCoWork");
    assert(admin.includes("CoWorkToolbar"), "Admin has CoWorkToolbar");
    assert(toolbar.includes("Live assist") || toolbar.includes("Live ON"), "toolbar Live control");
    assert(toolbar.includes("setLiveAssistOn"), "toolbar toggles Live");
    assert(agentChat.includes("buildMultimodalMessages(truncated"), "agentChat uses multimodal builder");
    assert(
      agentChat.includes('provider === "grok" ? "grok" : "openai"') || agentChat.includes("mmOpen"),
      "openai/grok multimodal branch present",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
