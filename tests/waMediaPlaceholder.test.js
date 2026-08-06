/**
 * Unit tests for WA media placeholder detection + magic-byte validation (ADR-009 / G7–G8).
 * Exercises real helpers on synthetic but real-format buffers (no mocks of unit under test).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPlaceholderText,
  waMediaObjectPath,
  detectAudioKind,
  detectImageKind,
  detectMediaKind,
  isLikelyJunkMediaBuffer,
  validateMediaBuffer,
  extForAudioKind,
  mimeForAudioKind,
  audioVoiceNotePlaceholder,
  shouldRevertSttFilledText,
  textAfterMediaClear,
} from "../server/lib/waMedia.js";

describe("isPlaceholderText", () => {
  it("treats empty as placeholder", () => {
    assert.equal(isPlaceholderText(null), true);
    assert.equal(isPlaceholderText(""), true);
    assert.equal(isPlaceholderText("   "), true);
  });
  it("detects media placeholders", () => {
    assert.equal(isPlaceholderText("[Imagen]"), true);
    assert.equal(isPlaceholderText("[Nota de voz · 12s]"), true);
    assert.equal(isPlaceholderText("🎙 Nota de voz"), true);
  });
  it("keeps real Spanish text", () => {
    assert.equal(isPlaceholderText("Hola, necesito cotización de techo"), false);
    assert.equal(isPlaceholderText("ok"), false);
  });
});

describe("waMediaObjectPath", () => {
  it("sanitizes chat and msg ids", () => {
    const p = waMediaObjectPath("59899@s.whatsapp.net", "false_x_abc", "jpg");
    assert.match(p, /^wa-media\//);
    assert.match(p, /\.jpg$/);
  });
});

/** Minimal valid-ish containers (magic only — not full decode). */
function makeOgg() {
  // OggS + pad
  return Buffer.concat([Buffer.from("OggS", "ascii"), Buffer.alloc(64, 0x01)]);
}
function makeWav() {
  // RIFF....WAVE
  const b = Buffer.alloc(44, 0);
  b.write("RIFF", 0);
  b.writeUInt32LE(36, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  return b;
}
function makeFlac() {
  return Buffer.concat([Buffer.from("fLaC", "ascii"), Buffer.alloc(32, 0)]);
}
function makeMp3Id3() {
  const b = Buffer.alloc(128, 0);
  b.write("ID3", 0);
  return b;
}
function makeJpeg() {
  // SOI + APP0-ish + padding
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(64, 0x11)]);
}
function makePng() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(32, 0)]);
}
function makeFbJsJunk() {
  // Historical WA backfill mistake: FB package / rsrc.php JS
  const body =
    ";/*FB_PKG_DELIM*/\n(function(){var a=1;return a;})();\n" + "x".repeat(3000);
  return Buffer.from(body, "utf8");
}
function makePlainJs() {
  return Buffer.from(
    '"use strict";\nfunction foo(){ return 1; }\n' + "var z=2;\n".repeat(200),
    "utf8",
  );
}

describe("detectAudioKind", () => {
  it("detects OggS (WA voice notes)", () => {
    assert.equal(detectAudioKind(makeOgg()), "ogg");
  });
  it("detects RIFF WAVE", () => {
    assert.equal(detectAudioKind(makeWav()), "wav");
  });
  it("detects fLaC", () => {
    assert.equal(detectAudioKind(makeFlac()), "flac");
  });
  it("detects ID3 mp3", () => {
    assert.equal(detectAudioKind(makeMp3Id3()), "mp3");
  });
  it("rejects FB JS as non-audio", () => {
    assert.equal(detectAudioKind(makeFbJsJunk()), null);
  });
  it("rejects JPEG as non-audio", () => {
    assert.equal(detectAudioKind(makeJpeg()), null);
  });
});

describe("detectImageKind", () => {
  it("detects JPEG SOI", () => {
    assert.equal(detectImageKind(makeJpeg()), "jpeg");
  });
  it("detects PNG signature", () => {
    assert.equal(detectImageKind(makePng()), "png");
  });
  it("rejects Ogg as non-image", () => {
    assert.equal(detectImageKind(makeOgg()), null);
  });
  it("rejects FB JS as non-image", () => {
    assert.equal(detectImageKind(makeFbJsJunk()), null);
  });
});

describe("isLikelyJunkMediaBuffer / detectMediaKind", () => {
  it("flags FB_PKG_DELIM packages as junk", () => {
    assert.equal(isLikelyJunkMediaBuffer(makeFbJsJunk()), true);
    assert.equal(detectMediaKind(makeFbJsJunk()).kind, "junk");
  });
  it("flags use-strict JS as junk", () => {
    assert.equal(isLikelyJunkMediaBuffer(makePlainJs()), true);
  });
  it("classifies real audio/image kinds", () => {
    assert.equal(detectMediaKind(makeOgg()).kind, "audio");
    assert.equal(detectMediaKind(makeOgg()).audio, "ogg");
    assert.equal(detectMediaKind(makeJpeg()).kind, "image");
    assert.equal(detectMediaKind(makeJpeg()).image, "jpeg");
  });
});

describe("validateMediaBuffer", () => {
  it("accepts Ogg when expect=audio", () => {
    const r = validateMediaBuffer(makeOgg(), { expect: "audio" });
    assert.equal(r.ok, true);
    assert.equal(r.subkind, "ogg");
    assert.equal(r.mime, "audio/ogg");
    assert.equal(extForAudioKind(r.subkind), "ogg");
  });
  it("accepts WAV when expect=audio", () => {
    const r = validateMediaBuffer(makeWav(), { expect: "audio" });
    assert.equal(r.ok, true);
    assert.equal(r.subkind, "wav");
    assert.equal(mimeForAudioKind("wav"), "audio/wav");
  });
  it("rejects FB JS when expect=audio", () => {
    const r = validateMediaBuffer(makeFbJsJunk(), { expect: "audio" });
    assert.equal(r.ok, false);
    assert.match(r.error, /not_audio|junk/);
  });
  it("rejects plain JS when expect=audio", () => {
    const r = validateMediaBuffer(makePlainJs(), { expect: "audio" });
    assert.equal(r.ok, false);
  });
  it("accepts JPEG when expect=image", () => {
    const r = validateMediaBuffer(makeJpeg(), { expect: "image" });
    assert.equal(r.ok, true);
    assert.equal(r.subkind, "jpeg");
    assert.equal(r.mime, "image/jpeg");
  });
  it("rejects Ogg when expect=image", () => {
    const r = validateMediaBuffer(makeOgg(), { expect: "image" });
    assert.equal(r.ok, false);
  });
  it("accepts either under expect=any", () => {
    assert.equal(validateMediaBuffer(makeOgg(), { expect: "any" }).ok, true);
    assert.equal(validateMediaBuffer(makePng(), { expect: "any" }).ok, true);
    assert.equal(validateMediaBuffer(makeFbJsJunk(), { expect: "any" }).ok, false);
  });
});

describe("STT text revert on media clear (skeptic: no leftover synthetic body)", () => {
  const synthetic =
    "Hola, necesito cotización de techo y sodec de 15 metros cuadrados para el depósito.";
  const metaStt = {
    media: { duration: "72", mimetype: "audio/ogg; codecs=opus" },
    duration: "72",
    stt_source: "local_whisper_turbo",
    stt_at: "2026-08-05T04:07:53Z",
  };

  it("builds voice-note placeholder with duration", () => {
    assert.equal(audioVoiceNotePlaceholder(metaStt), "[Nota de voz · 72s]");
    assert.equal(audioVoiceNotePlaceholder({}), "[Nota de voz]");
  });

  it("detects STT-filled audio body for revert", () => {
    assert.equal(
      shouldRevertSttFilledText({ type: "audio", text: synthetic, meta: metaStt }),
      true,
    );
    assert.equal(
      shouldRevertSttFilledText({
        type: "audio",
        text: "[Nota de voz · 12s]",
        meta: {},
      }),
      false,
    );
  });

  it("does NOT wipe human captions without STT provenance (Bug AH)", () => {
    const human = {
      type: "audio",
      text: "Necesito cotización de techo 40m2",
      meta: { media: { duration: "18" } },
    };
    assert.equal(shouldRevertSttFilledText(human), false);
    const r = textAfterMediaClear(human, { clearTranscript: true });
    assert.equal(r.reverted, false);
    assert.equal(r.text, human.text);
  });

  it("reverts when transcript column matches body (cloud STT without stt_source)", () => {
    assert.equal(
      shouldRevertSttFilledText({
        type: "audio",
        text: synthetic,
        transcript: synthetic,
        meta: {},
      }),
      true,
    );
    assert.equal(
      shouldRevertSttFilledText({
        type: "audio",
        text: synthetic,
        transcript: null,
        meta: { transcript_ms: 1200, transcript_lang: "es" },
      }),
      true,
    );
  });

  it("textAfterMediaClear restores placeholder and drops synthetic Spanish", () => {
    const r = textAfterMediaClear(
      { type: "audio", text: synthetic, meta: metaStt },
      { clearTranscript: true },
    );
    assert.equal(r.reverted, true);
    assert.equal(r.text, "[Nota de voz · 72s]");
    assert.notEqual(r.text, synthetic);
    assert.ok(isPlaceholderText(r.text));
  });

  it("does not rewrite human text when clear_transcript=false", () => {
    const r = textAfterMediaClear(
      { type: "audio", text: synthetic, meta: metaStt },
      { clearTranscript: false },
    );
    assert.equal(r.reverted, false);
    assert.equal(r.text, synthetic);
  });
});
