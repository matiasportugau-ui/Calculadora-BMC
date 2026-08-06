/**
 * WA media storage — private GCS under wa-media/ + signed read URLs.
 * Bucket: GCS_QUOTES_BUCKET / config.gcsQuotesBucket (default bmc-cotizaciones).
 */
import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

const storage = new Storage();

export function waMediaBucket() {
  return config.gcsQuotesBucket || process.env.GCS_QUOTES_BUCKET || "bmc-cotizaciones";
}

/**
 * @param {string} chatId
 * @param {string} msgId
 * @param {string} [ext]
 */
export function waMediaObjectPath(chatId, msgId, ext = "bin") {
  const safeChat = String(chatId || "unknown").replace(/[^a-zA-Z0-9@._-]/g, "_").slice(0, 120);
  const safeMsg = String(msgId || "unknown").replace(/[^a-zA-Z0-9@._-]/g, "_").slice(0, 180);
  const e = String(ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  return `wa-media/${safeChat}/${safeMsg}.${e}`;
}

function extFromMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("wav")) return "wav";
  if (m.includes("flac")) return "flac";
  if (m.includes("pdf")) return "pdf";
  return "bin";
}

/** @param {Buffer|Uint8Array|null|undefined} buf */
function asBuf(buf) {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf;
  if (buf instanceof Uint8Array) return Buffer.from(buf);
  return null;
}

/**
 * True if buffer looks like FB/WhatsApp static JS or other non-media junk
 * (historical loose backfill captured rsrc.php JS as "audio").
 * @param {Buffer|Uint8Array|null|undefined} buffer
 */
export function isLikelyJunkMediaBuffer(buffer) {
  const b = asBuf(buffer);
  if (!b || b.length < 4) return true;
  const head = b.subarray(0, Math.min(b.length, 256)).toString("latin1");
  if (head.includes("FB_PKG_DELIM")) return true;
  if (/^\s*[;,]?\s*\/\*/.test(head)) return true;
  if (/^\s*function\b/.test(head)) return true;
  if (/^\s*\(function\b/.test(head)) return true;
  if (/^\s*["']use strict["']/.test(head)) return true;
  if (head.startsWith("<!DOCTYPE") || head.startsWith("<html")) return true;
  // ASCII-heavy text scripts (not binary media)
  const sample = b.subarray(0, Math.min(b.length, 512));
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable++;
  }
  if (sample.length >= 64 && printable / sample.length > 0.92) {
    // allow pure ASCII only if it already matched a known media magic (caller checks first)
    return true;
  }
  return false;
}

/**
 * Detect image container from magic bytes.
 * @param {Buffer|Uint8Array|null|undefined} buffer
 * @returns {"jpeg"|"png"|"gif"|"webp"|null}
 */
export function detectImageKind(buffer) {
  const b = asBuf(buffer);
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  // RIFF....WEBP
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/**
 * Detect audio container from magic bytes (WA voice notes are typically Ogg/Opus).
 * @param {Buffer|Uint8Array|null|undefined} buffer
 * @returns {"ogg"|"wav"|"flac"|"mp3"|"m4a"|"webm"|null}
 */
export function detectAudioKind(buffer) {
  const b = asBuf(buffer);
  if (!b || b.length < 12) return null;
  // OggS (Opus/Vorbis) — WhatsApp voice notes
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "ogg";
  // RIFF....WAVE
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x41 &&
    b[10] === 0x56 &&
    b[11] === 0x45
  ) {
    return "wav";
  }
  // fLaC
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return "flac";
  // ID3 tag or MPEG frame sync
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "mp3";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  // ISO BMFF ftyp (m4a/mp4)
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = b.subarray(8, 12).toString("ascii");
    if (/^(M4A |mp42|isom|iso2|mp41|MSNV|M4B )/i.test(brand) || brand.includes("M4A")) {
      return "m4a";
    }
    // generic ftyp — still treat as m4a-class audio/container
    return "m4a";
  }
  // WebM / Matroska EBML
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

/**
 * @param {Buffer|Uint8Array|null|undefined} buffer
 * @returns {{ kind: "audio"|"image"|"junk"|"unknown", audio?: string, image?: string }}
 */
export function detectMediaKind(buffer) {
  const audio = detectAudioKind(buffer);
  if (audio) return { kind: "audio", audio };
  const image = detectImageKind(buffer);
  if (image) return { kind: "image", image };
  if (isLikelyJunkMediaBuffer(buffer)) return { kind: "junk" };
  return { kind: "unknown" };
}

/** @param {string|null|undefined} audioKind */
export function mimeForAudioKind(audioKind) {
  switch (audioKind) {
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "flac":
      return "audio/flac";
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "webm":
      return "audio/webm";
    default:
      return "application/octet-stream";
  }
}

/** @param {string|null|undefined} imageKind */
export function mimeForImageKind(imageKind) {
  switch (imageKind) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/** File extension for whisper / storage from audio kind. */
export function extForAudioKind(audioKind) {
  if (audioKind === "mp3") return "mp3";
  if (audioKind === "wav") return "wav";
  if (audioKind === "flac") return "flac";
  if (audioKind === "m4a") return "m4a";
  if (audioKind === "webm") return "webm";
  if (audioKind === "ogg") return "ogg";
  return "bin";
}

/**
 * Validate buffer is real media (not FB JS junk). Optionally require audio or image.
 * @param {Buffer|Uint8Array} buffer
 * @param {{ expect?: "audio"|"image"|"any" }} [opts]
 * @returns {{ ok: true, kind: string, subkind: string, mime: string, ext: string } | { ok: false, error: string }}
 */
export function validateMediaBuffer(buffer, opts = {}) {
  const expect = opts.expect || "any";
  const b = asBuf(buffer);
  if (!b || !b.length) return { ok: false, error: "empty buffer" };

  const audio = detectAudioKind(b);
  const image = detectImageKind(b);

  if (expect === "audio") {
    if (!audio) {
      if (isLikelyJunkMediaBuffer(b)) return { ok: false, error: "not_audio_junk" };
      return { ok: false, error: "not_audio_magic" };
    }
    return {
      ok: true,
      kind: "audio",
      subkind: audio,
      mime: mimeForAudioKind(audio),
      ext: extForAudioKind(audio),
    };
  }
  if (expect === "image") {
    if (!image) {
      if (isLikelyJunkMediaBuffer(b)) return { ok: false, error: "not_image_junk" };
      return { ok: false, error: "not_image_magic" };
    }
    return {
      ok: true,
      kind: "image",
      subkind: image,
      mime: mimeForImageKind(image),
      ext: image === "jpeg" ? "jpg" : image,
    };
  }

  // any: accept audio or image; reject junk/unknown
  if (audio) {
    return {
      ok: true,
      kind: "audio",
      subkind: audio,
      mime: mimeForAudioKind(audio),
      ext: extForAudioKind(audio),
    };
  }
  if (image) {
    return {
      ok: true,
      kind: "image",
      subkind: image,
      mime: mimeForImageKind(image),
      ext: image === "jpeg" ? "jpg" : image,
    };
  }
  if (isLikelyJunkMediaBuffer(b)) return { ok: false, error: "junk_media" };
  return { ok: false, error: "unknown_media_magic" };
}

/**
 * Upload decrypted media bytes to private GCS (no public ACL).
 * Rejects non-media junk (FB JS packages, HTML) via magic-byte validation.
 * @param {{ buffer: Buffer, chatId: string, msgId: string, mime?: string, expect?: "audio"|"image"|"any" }} opts
 * @returns {Promise<{ ok: true, path: string, bytes: number, mime: string, kind: string, subkind: string } | { ok: false, error: string }>}
 */
export async function uploadWaMediaBytes({ buffer, chatId, msgId, mime, expect = "any" }) {
  const bucket = waMediaBucket();
  if (!bucket) return { ok: false, error: "GCS bucket not configured" };
  if (!Buffer.isBuffer(buffer) || !buffer.length) return { ok: false, error: "empty buffer" };
  if (buffer.length > 25 * 1024 * 1024) return { ok: false, error: "media too large (>25MB)" };

  // Infer expect from claimed mime when not set explicitly
  let expectKind = expect;
  if (expectKind === "any" && mime) {
    const m = String(mime).toLowerCase();
    if (m.startsWith("audio/")) expectKind = "audio";
    else if (m.startsWith("image/")) expectKind = "image";
  }

  const validated = validateMediaBuffer(buffer, { expect: expectKind });
  if (!validated.ok) return { ok: false, error: validated.error };

  // Prefer magic-derived mime over client claim (prevents audio/ogg + JS body)
  const contentType = validated.mime || String(mime || "application/octet-stream").slice(0, 128);
  const path = waMediaObjectPath(chatId, msgId, validated.ext || extFromMime(contentType));

  try {
    const file = storage.bucket(bucket).file(path);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=3600",
        metadata: {
          chat_id: String(chatId || "").slice(0, 120),
          msg_id: String(msgId || "").slice(0, 180),
          media_kind: validated.kind,
          media_subkind: validated.subkind,
        },
      },
    });
    return {
      ok: true,
      path,
      bytes: buffer.length,
      mime: contentType,
      kind: validated.kind,
      subkind: validated.subkind,
    };
  } catch (err) {
    return { ok: false, error: err?.message || "gcs upload failed" };
  }
}

/**
 * @param {string} objectPath
 * @param {{ expiresMs?: number }} [opts]
 * @returns {Promise<string|null>}
 */
export async function getWaMediaSignedUrl(objectPath, opts = {}) {
  const bucket = waMediaBucket();
  if (!bucket || !objectPath) return null;
  const expiresMs = Number(opts.expiresMs || 60 * 60 * 1000);
  try {
    const file = storage.bucket(bucket).file(objectPath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresMs,
    });
    return url;
  } catch {
    return null;
  }
}

/**
 * @param {string} objectPath
 * @returns {Promise<Buffer|null>}
 */
export async function downloadWaMediaBytes(objectPath) {
  const bucket = waMediaBucket();
  if (!bucket || !objectPath) return null;
  try {
    const file = storage.bucket(bucket).file(objectPath);
    const [buf] = await file.download();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  } catch {
    return null;
  }
}

/** True if text looks like a media/system placeholder we may overwrite with transcript. */
export function isPlaceholderText(text) {
  if (text == null) return true;
  const t = String(text).trim();
  if (!t) return true;
  if (/^\[(Nota de voz|Imagen|Video|Sticker|Documento|Ubicación|audio|image|video)/i.test(t)) {
    return true;
  }
  if (/^🎙|^🖼|^🎬|^📄|^📍/.test(t)) return true;
  return false;
}

/**
 * Build audio voice-note placeholder from message meta (duration when known).
 * Used when clearing STT-filled text so cockpit does not keep invented Spanish body.
 * @param {object|null|undefined} meta
 * @returns {string}
 */
export function audioVoiceNotePlaceholder(meta) {
  const m = meta && typeof meta === "object" ? meta : {};
  const media = m.media && typeof m.media === "object" ? m.media : {};
  const durRaw = media.duration ?? m.duration ?? null;
  const dur = durRaw != null && String(durRaw).trim() !== "" ? String(durRaw).trim() : null;
  if (dur) return `[Nota de voz · ${dur}s]`;
  return "[Nota de voz]";
}

/**
 * Whether clearing media/transcript should revert `text` (STT had filled it from placeholder).
 * Requires STT provenance — never treat "audio + non-placeholder body" alone as STT,
 * or junk clear / CLEAR_JUNK wipes human captions and ingest text.
 * @param {{ type?: string, text?: string|null, transcript?: string|null, meta?: object|null }} row
 */
export function shouldRevertSttFilledText(row) {
  const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
  // Local STT worker / POST /wa/transcript
  if (meta.stt_source || meta.stt_at) return true;
  // Cloud transcript worker (waTranscriptWorker) markers
  if (meta.transcript_ms != null || meta.transcript_lang) return true;
  // Body identical to stored transcript ⇒ STT (or copy) filled it
  const body = row?.text != null ? String(row.text).trim() : "";
  const tr = row?.transcript != null ? String(row.transcript).trim() : "";
  if (body && tr && body === tr && !isPlaceholderText(body)) return true;
  return false;
}

/**
 * Compute the text value after media/transcript clear.
 * @param {{ type?: string, text?: string|null, meta?: object|null }} row
 * @param {{ clearTranscript?: boolean }} [opts]
 * @returns {{ text: string|null, reverted: boolean, placeholder?: string }}
 */
export function textAfterMediaClear(row, opts = {}) {
  const clearTranscript = opts.clearTranscript !== false;
  if (!clearTranscript) {
    return { text: row?.text ?? null, reverted: false };
  }
  if (!shouldRevertSttFilledText(row)) {
    return { text: row?.text ?? null, reverted: false };
  }
  const placeholder = audioVoiceNotePlaceholder(row?.meta);
  return { text: placeholder, reverted: true, placeholder };
}
