/**
 * server/lib/voiceErrorLog.js
 * In-memory ring buffer for voice mode errors (session mint failures, network errors).
 * IMP-09: also dual-writes privacy-safe events to voiceMetrics (Postgres when DATABASE_URL set).
 */

import { recordVoiceEvent } from "./voiceMetrics.js";

const MAX_ENTRIES = 50;
const MAX_MESSAGE_CHARS = 500;
const MAX_DETAIL_CHARS = 2000;
const buffer = [];

function clip(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? `${s.slice(0, max)}…(truncated ${s.length - max})` : s;
}

export function recordVoiceError({ kind, message, status = null, detail = null }) {
  const entry = {
    ts: new Date().toISOString(),
    kind: String(kind || "unknown"),
    message: clip(message, MAX_MESSAGE_CHARS) || "",
    status: status == null ? null : Number(status) || null,
    detail: clip(detail, MAX_DETAIL_CHARS),
  };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.splice(0, buffer.length - MAX_ENTRIES);
  }
  // Durable dual-write (no raw audio; short detail only)
  try {
    recordVoiceEvent({
      kind: entry.kind,
      detail: entry.message || entry.detail,
      surface: "voice",
    });
  } catch {
    /* never block voice path */
  }
  return entry;
}

export function listVoiceErrors() {
  return buffer.slice().reverse();
}

export function clearVoiceErrors() {
  buffer.length = 0;
}
