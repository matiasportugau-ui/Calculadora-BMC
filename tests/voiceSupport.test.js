// ═══════════════════════════════════════════════════════════════════════════
// tests/voiceSupport.test.js — embedded voice capability routing
//
// These checks protect the browser split used by PanelinVoicePanel:
//   - Web Speech + mic → hands-free
//   - mic without Web Speech → Whisper push-to-talk
//   - no mic → unsupported
//
// Run: node tests/voiceSupport.test.js
// ═══════════════════════════════════════════════════════════════════════════

import {
  canUseMic,
  canUseWhisperVoice,
  isBrowserSupported,
  isHandsFreeSupported,
  isSafari,
} from "../src/hooks/voiceSupport.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function defineBrowser({
  speechRecognition = false,
  prefixedSpeechRecognition = false,
  microphone = true,
  realtime = false,
  userAgent = "",
} = {}) {
  const getUserMedia = microphone ? async () => ({}) : undefined;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      RTCPeerConnection: realtime ? function RTCPeerConnection() {} : undefined,
      SpeechRecognition: speechRecognition ? function SpeechRecognition() {} : undefined,
      webkitSpeechRecognition: prefixedSpeechRecognition
        ? function WebkitSpeechRecognition() {}
        : undefined,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: getUserMedia ? { getUserMedia } : undefined,
      userAgent,
    },
  });
}

function restoreGlobal(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    delete globalThis[name];
  }
}

try {
  // Server-side rendering / Node must fail closed without throwing.
  delete globalThis.window;
  assert(!isBrowserSupported(), "no window → Realtime unsupported");
  assert(!isHandsFreeSupported(), "no window → hands-free unsupported");

  // Safari exposes prefixed Web Speech but not the embedded Realtime route.
  defineBrowser({
    prefixedSpeechRecognition: true,
    userAgent: "Mozilla/5.0 Version/18.5 Safari/605.1.15",
  });
  assert(canUseMic(), "Safari mic capability detected");
  assert(isHandsFreeSupported(), "Safari Web Speech + mic → hands-free");
  assert(!canUseWhisperVoice(), "Safari hands-free does not route to Whisper");
  assert(!isBrowserSupported(), "Safari without RTCPeerConnection fixture → no Realtime");
  assert(isSafari(), "Safari user agent detected");

  // Firefox has a mic but no Web Speech API, so it must use Whisper.
  defineBrowser({
    realtime: true,
    userAgent: "Mozilla/5.0 Firefox/128.0",
  });
  assert(!isHandsFreeSupported(), "Firefox without Web Speech → no hands-free");
  assert(canUseWhisperVoice(), "Firefox mic without Web Speech → Whisper");
  assert(!isSafari(), "Firefox is not Safari");

  // Speech recognition alone is insufficient: both voice paths need a mic.
  defineBrowser({
    speechRecognition: true,
    microphone: false,
    userAgent: "Mozilla/5.0 Chrome/126.0",
  });
  assert(!canUseMic(), "missing getUserMedia → mic unavailable");
  assert(!isHandsFreeSupported(), "Web Speech without mic → no hands-free");
  assert(!canUseWhisperVoice(), "no mic → no Whisper fallback");
  assert(!isBrowserSupported(), "no mic → no Realtime");

  // Chrome-like capability set supports hands-free and Realtime independently.
  defineBrowser({
    speechRecognition: true,
    realtime: true,
    userAgent: "Mozilla/5.0 Chrome/126.0 Safari/537.36",
  });
  assert(isHandsFreeSupported(), "standard Web Speech + mic → hands-free");
  assert(isBrowserSupported(), "RTCPeerConnection + mic → Realtime supported");
  assert(!isSafari(), "Chrome user agent is not misclassified as Safari");
} finally {
  restoreGlobal("window", originalWindow);
  restoreGlobal("navigator", originalNavigator);
}

console.log(`\n${failed === 0 ? "✅" : "❌"} voiceSupport: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
