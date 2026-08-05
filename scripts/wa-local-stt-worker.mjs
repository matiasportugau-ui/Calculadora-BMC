/**
 * Local free STT worker — Whisper large-v3-turbo (or smaller) via Python openai-whisper.
 *
 * Polls prod for audio with media_gcs_path + transcript_status=pending,
 * downloads via signed URL, transcribes offline, PATCHes transcript.
 *
 * Env:
 *   WA_TOKEN          required
 *   WA_API            default panelin-calc URL
 *   WHISPER_MODEL     default turbo (large-v3-turbo if available, else base)
 *   WHISPER_BIN       python -m whisper  (default)
 *   ONCE=1            single pass then exit
 *   INTERVAL_MS       default 60000
 *
 *   WA_TOKEN=… node scripts/wa-local-stt-worker.mjs
 */
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  detectAudioKind,
  extForAudioKind,
  validateMediaBuffer,
} from "../server/lib/waMedia.js";

const TOKEN = process.env.WA_TOKEN;
const API = (process.env.WA_API || "https://panelin-calc-q74zutv7dq-uc.a.run.app").replace(/\/+$/, "");
const MODEL = process.env.WHISPER_MODEL || "turbo";
const INTERVAL = Number(process.env.INTERVAL_MS || 60000);
const ONCE = process.env.ONCE === "1";
const BATCH = Number(process.env.BATCH || 3);
const CLEAR_JUNK = process.env.CLEAR_JUNK !== "0"; // default: clear non-audio media paths

if (!TOKEN) {
  console.error("WA_TOKEN required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "X-Operator-Id": "matias-local-stt",
};

async function listPending() {
  // Walk conversations and find audio with has_media pending (no dedicated endpoint yet)
  const conv = await (await fetch(`${API}/api/wa/conversations?limit=50`, { headers })).json();
  const pending = [];
  for (const c of conv.items || []) {
    const mj = await (
      await fetch(`${API}/api/wa/messages?chat_id=${encodeURIComponent(c.chat_id)}&limit=100`, {
        headers,
      })
    ).json();
    for (const m of mj.items || []) {
      if (m.type !== "audio") continue;
      if (!m.has_media && !m.media_gcs_path) continue;
      if (m.transcript_status === "done") continue;
      if (m.transcript_status === "skipped") continue;
      // include pending, error (retry), or null with media (needs first STT)
      if (
        m.transcript_status === "pending" ||
        m.transcript_status === "error" ||
        (m.has_media && !m.transcript)
      ) {
        pending.push(m);
      }
    }
  }
  return pending.slice(0, BATCH);
}

async function downloadMedia(msgId) {
  const j = await (
    await fetch(`${API}/api/wa/media/${encodeURIComponent(msgId)}?json=1`, { headers })
  ).json();
  if (!j.ok || !j.url) throw new Error(j.error || "no signed url");
  const res = await fetch(j.url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function runWhisper(audioPath, outDir) {
  return new Promise((resolve, reject) => {
    const args = [
      "-m",
      "whisper",
      audioPath,
      "--model",
      MODEL,
      "--language",
      "es",
      "--output_dir",
      outDir,
      "--output_format",
      "txt",
      "--fp16",
      "False",
    ];
    const child = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    let out = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.slice(-800) || `whisper exit ${code}`));
      const base = path.basename(audioPath, path.extname(audioPath));
      const candidates = [
        path.join(outDir, `${base}.txt`),
        ...fs.readdirSync(outDir).filter((f) => f.endsWith(".txt")).map((f) => path.join(outDir, f)),
      ];
      for (const txtPath of candidates) {
        if (fs.existsSync(txtPath)) {
          const text = fs.readFileSync(txtPath, "utf8").trim();
          if (text) return resolve(text);
        }
      }
      // fallback: last non-empty stdout line
      const lines = out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length) return resolve(lines[lines.length - 1]);
      reject(new Error("no txt output: " + err.slice(-300)));
    });
  });
}

async function patchTranscript(msgId, text, status = "done") {
  const res = await fetch(`${API}/api/wa/transcript`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      msg_id: msgId,
      transcript: text,
      transcript_status: status,
      source: "local_whisper_turbo",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `patch ${res.status}`);
  return j;
}

/** Unlink non-audio junk from DB so has_media reflects real obtainable audio only. */
async function clearMedia(msgId, reason) {
  const res = await fetch(`${API}/api/wa/media/clear`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      msg_id: msgId,
      clear_transcript: true,
      reason: reason || "not_audio_magic",
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Older deployments may lack /media/clear — still mark skipped
    console.warn("clear media failed", msgId.slice(0, 40), j.error || res.status);
    return { ok: false, ...j };
  }
  return j;
}

async function processOne(m) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wa-stt-"));
  try {
    const buf = await downloadMedia(m.msg_id);
    // skip tiny junk
    if (buf.length < 2000) {
      await patchTranscript(m.msg_id, "", "skipped");
      if (CLEAR_JUNK) await clearMedia(m.msg_id, "too_small");
      return { ok: false, reason: "too_small", msg_id: m.msg_id, bytes: buf.length };
    }

    // Magic-byte gate: only real audio (OggS/RIFF/fLaC/ID3/…) — never FB JS packages
    const v = validateMediaBuffer(buf, { expect: "audio" });
    if (!v.ok) {
      await patchTranscript(m.msg_id, "", "skipped");
      if (CLEAR_JUNK) await clearMedia(m.msg_id, v.error);
      return {
        ok: false,
        reason: v.error,
        msg_id: m.msg_id,
        bytes: buf.length,
        head: buf.subarray(0, 16).toString("hex"),
      };
    }

    const audioKind = detectAudioKind(buf) || v.subkind;
    const ext = extForAudioKind(audioKind) || "ogg";
    const audioPath = path.join(dir, `a.${ext}`);
    fs.writeFileSync(audioPath, buf);
    const text = await runWhisper(audioPath, dir);
    if (!text) {
      await patchTranscript(m.msg_id, "", "error");
      return { ok: false, reason: "empty_text", msg_id: m.msg_id };
    }
    await patchTranscript(m.msg_id, text, "done");
    return { ok: true, msg_id: m.msg_id, chars: text.length, audio_kind: audioKind };
  } catch (e) {
    try {
      await patchTranscript(m.msg_id, "", "error");
    } catch {
      /* */
    }
    return { ok: false, msg_id: m.msg_id, error: e.message };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function tick() {
  console.log(new Date().toISOString(), "poll…");
  let pending;
  try {
    pending = await listPending();
  } catch (e) {
    console.error("list failed", e.message);
    return;
  }
  console.log("pending", pending.length);
  for (const m of pending) {
    console.log("STT", m.msg_id.slice(0, 40), m.media_bytes || "?");
    const r = await processOne(m);
    console.log(" →", r);
  }
}

console.log("wa-local-stt-worker", { API, MODEL, INTERVAL, ONCE });
if (ONCE) {
  await tick();
  process.exit(0);
}
await tick();
setInterval(() => {
  tick().catch((e) => console.error(e));
}, INTERVAL);
