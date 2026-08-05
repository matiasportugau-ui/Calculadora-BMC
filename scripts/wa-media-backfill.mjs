/**
 * Backfill WA media: download from mmg CDN + decrypt (Node) + POST /api/wa/media.
 * Uses Playwright browser context cookies when CDN requires session.
 *
 *   WA_TOKEN=… WA_API=… PROFILE=… node scripts/wa-media-backfill.mjs
 */
import { chromium } from "playwright";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PROFILE = process.env.PROFILE || path.join(ROOT, ".runtime/chrome-wa-profile");
const TOKEN = process.env.WA_TOKEN;
const API = (process.env.WA_API || "https://panelin-calc-q74zutv7dq-uc.a.run.app").replace(/\/+$/, "");
const MEDIA_CAP = Number(process.env.MEDIA_CAP || 25);

if (!TOKEN) {
  console.error("WA_TOKEN required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "X-Operator-Id": "matias",
};

const INFO = {
  image: "WhatsApp Image Keys",
  video: "WhatsApp Video Keys",
  audio: "WhatsApp Audio Keys",
  document: "WhatsApp Document Keys",
  sticker: "WhatsApp Image Keys",
};

function decryptWaMedia(encBuf, mediaKeyB64, kind) {
  const mediaKey = Buffer.from(mediaKeyB64, "base64");
  const info = Buffer.from(INFO[kind] || INFO.image);
  // HKDF-SHA256 expand 112 bytes, salt empty 32 zeros (Baileys)
  const expanded = Buffer.from(
    crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(32), info, 112),
  );
  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);
  // strip 10-byte MAC trailer
  const cipher = encBuf.length > 10 ? encBuf.subarray(0, encBuf.length - 10) : encBuf;
  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}

// Collect candidates from API
const conv = await (await fetch(`${API}/api/wa/conversations?limit=50`, { headers })).json();
const candidates = [];
for (const c of conv.items || []) {
  const mj = await (
    await fetch(`${API}/api/wa/messages?chat_id=${encodeURIComponent(c.chat_id)}&limit=100`, {
      headers,
    })
  ).json();
  for (const m of mj.items || []) {
    if (m.has_media) continue;
    if (m.type !== "image" && m.type !== "audio") continue;
    const media = m.meta?.media;
    if (!media?.directPath || !media?.mediaKey) continue;
    candidates.push({
      msg_id: m.msg_id,
      chat_id: m.chat_id,
      type: m.type,
      contact: c.contact_name || c.chat_id.slice(0, 16),
      media,
    });
  }
}
console.log("candidates", candidates.length);

for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  try {
    fs.unlinkSync(path.join(PROFILE, f));
  } catch {
    /* */
  }
}

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  channel: "chrome",
  args: ["--no-first-run"],
  viewport: { width: 800, height: 600 },
});
// Warm WA origin so cookies load
const page = context.pages()[0] || (await context.newPage());
await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

let ok = 0,
  fail = 0;
for (const c of candidates.slice(0, MEDIA_CAP)) {
  const pathPart = c.media.directPath.startsWith("/")
    ? c.media.directPath
    : `/${c.media.directPath}`;
  const urls = c.media.directPath.startsWith("http")
    ? [c.media.directPath]
    : [
        `https://mmg.whatsapp.net${pathPart}`,
        `https://media.fna.whatsapp.net${pathPart}`,
        `https://mmg.whatsapp.net${pathPart}${pathPart.includes("?") ? "&" : "?"}__wa=1`,
      ];

  let enc = null;
  let used = null;
  for (const url of urls) {
    try {
      const res = await context.request.get(url, {
        timeout: 30000,
        headers: {
          Referer: "https://web.whatsapp.com/",
          Origin: "https://web.whatsapp.com",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (res.ok()) {
        enc = Buffer.from(await res.body());
        used = url;
        break;
      }
      console.log("  download", res.status(), url.slice(0, 70));
    } catch (e) {
      console.log("  download err", e.message?.slice(0, 80), url.slice(0, 50));
    }
  }

  if (!enc?.length) {
    fail++;
    console.log("FAIL download", c.type, c.contact);
    continue;
  }

  try {
    const kind = c.type === "audio" ? "audio" : "image";
    const plain = decryptWaMedia(enc, c.media.mediaKey, kind);
    const up = await fetch(`${API}/api/wa/media`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        msg_id: c.msg_id,
        chat_id: c.chat_id,
        type: c.type,
        mimetype: c.media.mimetype || (c.type === "audio" ? "audio/ogg; codecs=opus" : "image/jpeg"),
        bytes_base64: plain.toString("base64"),
      }),
    });
    if (up.ok) {
      ok++;
      console.log("OK", c.type, c.contact, plain.length, "bytes via", used?.slice(0, 40));
    } else {
      fail++;
      const t = await up.text().catch(() => "");
      console.log("FAIL upload", up.status, t.slice(0, 100));
    }
  } catch (e) {
    fail++;
    console.log("FAIL decrypt", e.message);
  }
}

console.log({ ok, fail });
await context.close();

// Wait for STT
if (ok) {
  console.log("Waiting 50s for STT worker…");
  await new Promise((r) => setTimeout(r, 50000));
}

// Summary
let withMedia = 0,
  withStt = 0;
const samples = [];
for (const c of (conv.items || []).slice(0, 30)) {
  const mj = await (
    await fetch(`${API}/api/wa/messages?chat_id=${encodeURIComponent(c.chat_id)}&limit=80`, {
      headers,
    })
  ).json();
  for (const m of mj.items || []) {
    if (m.has_media) {
      withMedia++;
      if (samples.length < 8) {
        samples.push({
          chat: c.contact_name || c.chat_id.slice(0, 12),
          type: m.type,
          stt: m.transcript_status,
          text: (m.transcript || m.display_text || m.text || "").slice(0, 80),
        });
      }
    }
    if (m.transcript || m.transcript_status === "done") withStt++;
  }
}
console.log({ withMedia, withStt, samples });
process.exit(ok > 0 ? 0 : 2);
