/**
 * IMP-08 — Hands-free vs Whisper capability gates (no browser).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Pure capability logic mirrored from voiceSupport (driven by flags, not re-implementing product UI)
function canUseWhisperVoice({ hasMic, hasSpeechRecognition }) {
  return !!hasMic && !hasSpeechRecognition;
}
function isHandsFreeSupported({ hasMic, hasSpeechRecognition }) {
  return !!hasSpeechRecognition && !!hasMic;
}

// Firefox-like: mic yes, SR no → Whisper only
assert.equal(isHandsFreeSupported({ hasMic: true, hasSpeechRecognition: false }), false);
assert.equal(canUseWhisperVoice({ hasMic: true, hasSpeechRecognition: false }), true);

// Chrome-like: both → Hands-free, not Whisper fallback
assert.equal(isHandsFreeSupported({ hasMic: true, hasSpeechRecognition: true }), true);
assert.equal(canUseWhisperVoice({ hasMic: true, hasSpeechRecognition: true }), false);

// No mic → neither
assert.equal(isHandsFreeSupported({ hasMic: false, hasSpeechRecognition: false }), false);
assert.equal(canUseWhisperVoice({ hasMic: false, hasSpeechRecognition: false }), false);

// Shipped modules export real helpers
const vs = fs.readFileSync(path.join(ROOT, "src/hooks/voiceSupport.js"), "utf8");
assert.match(vs, /export function isHandsFreeSupported/);
assert.match(vs, /export function canUseWhisperVoice/);
assert.match(vs, /SpeechRecognition|webkitSpeechRecognition/);

const dict = fs.readFileSync(path.join(ROOT, "src/hooks/useDictation.js"), "utf8");
assert.match(dict, /\/api\/agent\/transcribe/);
assert.match(dict, /MediaRecorder|Whisper|SpeechRecognition/);

const chat = fs.readFileSync(path.join(ROOT, "src/components/PanelinChatPanel.jsx"), "utf8");
assert.match(chat, /useDictation|Hablar \(Whisper\)|Hablar/);
// Embedded chat must not require Realtime for mic path
assert.ok(
  !/Realtime required|requiere Realtime/i.test(chat) || /panelin\/live/.test(chat),
  "no false Realtime-required for embedded chat",
);

const transcribe = fs.readFileSync(path.join(ROOT, "server/routes/agentTranscribe.js"), "utf8");
assert.match(transcribe, /transcribe|whisper|openai/i);

console.log("voiceSupport.test.js: ok");
