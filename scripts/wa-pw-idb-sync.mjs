/**
 * Playwright IDB sync: scrape in WA Web page context, POST from Node (avoids CORS).
 *
 *   WA_TOKEN=… WA_API=… PROFILE=… node scripts/wa-pw-idb-sync.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PROFILE = process.env.PROFILE || path.join(ROOT, ".runtime/chrome-wa-profile");
const TOKEN = process.env.WA_TOKEN;
const API = (process.env.WA_API || "https://panelin-calc-q74zutv7dq-uc.a.run.app").replace(/\/+$/, "");
const WAIT_MS = Number(process.env.WAIT_MS || 90000);
const BATCH = Number(process.env.BATCH || 80);
const MEDIA_CAP = Number(process.env.MEDIA_CAP || 25);

if (!TOKEN) {
  console.error("WA_TOKEN required");
  process.exit(1);
}

for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
  try {
    fs.unlinkSync(path.join(PROFILE, f));
  } catch {
    /* */
  }
}

console.log("Launch profile", PROFILE);

let context;
const launchOpts = {
  headless: false,
  viewport: { width: 1280, height: 900 },
  args: ["--no-first-run", "--disable-blink-features=AutomationControlled"],
  timeout: 120000,
};
try {
  context = await chromium.launchPersistentContext(PROFILE, { ...launchOpts, channel: "chrome" });
  console.log("channel: chrome");
} catch (e) {
  console.warn("chrome channel failed", e.message);
  context = await chromium.launchPersistentContext(PROFILE, launchOpts);
}

const page = context.pages()[0] || (await context.newPage());
await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded", timeout: 120000 });

async function state() {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const qr =
      !!document.querySelector("canvas[aria-label]") ||
      /Escanea el código QR|Scan the QR|escanear/i.test(text);
    const chatList =
      !!document.querySelector('[data-testid="chat-list"]') ||
      !!document.querySelector("#pane-side") ||
      !!document.querySelector('[aria-label*="Lista de chats"]') ||
      !!document.querySelector('[aria-label*="Chat list"]');
    return { qr, chatList };
  });
}

console.log("Waiting for login…");
const t0 = Date.now();
let logged = false;
while (Date.now() - t0 < WAIT_MS) {
  const st = await state().catch((e) => ({ error: e.message }));
  if (st.chatList && !st.qr) {
    logged = true;
    console.log("Logged in");
    break;
  }
  process.stdout.write(st.qr ? "Q" : ".");
  await page.waitForTimeout(2500);
}
console.log("");
if (!logged) {
  const dbs = await page.evaluate(async () => {
    try {
      return ((await indexedDB.databases?.()) || []).map((d) => d.name);
    } catch {
      return [];
    }
  });
  if (!dbs.some((n) => /model-storage|wawc/i.test(String(n)))) {
    console.error("Not logged in and no IDB — scan QR and re-run");
    await page.waitForTimeout(30000);
    await context.close();
    process.exit(3);
  }
  console.log("Proceeding with offline IDB");
}

await page.waitForTimeout(logged ? 6000 : 1500);

console.log("Scraping model-storage…");
const scraped = await page.evaluate(async () => {
  const out = { read: 0, messages: [], names: 0, types: {}, errors: [] };

  function openDb(name) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  function stringifyJid(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      return String(v._serialized || (v.user && v.server && `${v.user}@${v.server}`) || "");
    }
    return "";
  }

  function parseMessageId(row) {
    const id = row.id ?? row.key?.id ?? row._id;
    if (id == null) return null;
    if (typeof id === "string") {
      const parts = id.split("_");
      if (parts.length >= 3 && (parts[0] === "true" || parts[0] === "false")) {
        return {
          isOut: parts[0] === "true",
          chatId: parts.slice(1, -1).join("_"),
          msgId: id,
        };
      }
      return null;
    }
    if (typeof id === "object") {
      const isOut = Boolean(id.fromMe ?? row.fromMe);
      const chatId = stringifyJid(id.remote) || stringifyJid(row.from) || stringifyJid(row.to) || "";
      const inner = id.id != null ? String(id.id) : "";
      const msgId = id._serialized || `${isOut}_${chatId}_${inner || Date.now()}`;
      if (!chatId) return null;
      return { isOut, chatId, msgId: String(msgId).slice(0, 250) };
    }
    return null;
  }

  const NOISE = new Set([
    "e2e_notification",
    "notification_template",
    "gp2",
    "ciphertext",
    "call_log",
    "call_log_self",
    "protocol",
    "revoked",
    "notification",
  ]);

  function mapType(raw) {
    const r = String(raw || "chat").toLowerCase();
    if (r === "image" || r === "ptt-image") return "image";
    if (r === "ptt" || r === "audio") return "audio";
    if (r === "video") return "video";
    if (r === "sticker") return "sticker";
    if (r === "location" || r === "live_location") return "location";
    if (r === "document" || r === "doc") return "doc";
    return "text";
  }

  function extractText(row, type, rawType) {
    for (const k of ["body", "text", "caption", "comment", "matchedText", "description", "title", "filename", "fileName", "file_name"]) {
      if (typeof row[k] === "string" && row[k].trim()) return row[k].trim();
    }
    const dur =
      row.duration != null && Number.isFinite(Number(row.duration))
        ? ` · ${Math.round(Number(row.duration))}s`
        : "";
    if (type === "audio" || rawType === "ptt") return `[Nota de voz${dur}]`;
    if (type === "image") return "[Imagen]";
    if (type === "video") return `[Video${dur}]`;
    if (type === "sticker") return "[Sticker]";
    if (type === "doc") return row.filename || row.fileName || "[Documento]";
    if (type === "location") return "[Ubicación]";
    return null;
  }

  function mediaKeyToB64(mediaKey) {
    if (!mediaKey) return null;
    if (typeof mediaKey === "string") return mediaKey;
    try {
      if (mediaKey instanceof ArrayBuffer) {
        return btoa(String.fromCharCode(...new Uint8Array(mediaKey)));
      }
      if (mediaKey?.buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(mediaKey.buffer)));
      }
    } catch {
      /* */
    }
    return null;
  }

  function extractMedia(row) {
    const directPath =
      row.directPath || row.deprecatedMms3Url || row.mediaData?.directPath || null;
    const mediaKey = mediaKeyToB64(row.mediaKey || row.mediaData?.mediaKey);
    if (!directPath && !mediaKey) return null;
    return {
      directPath: directPath ? String(directPath) : null,
      mediaKey: mediaKey || null,
      mimetype: row.mimetype || row.mediaData?.mimetype || null,
      size: row.size ?? row.fileLength ?? null,
      duration: row.duration ?? null,
      mediaKeyTimestamp: row.mediaKeyTimestamp ?? null,
    };
  }

  const names = new Map();
  {
    const cdb = await openDb("model-storage");
    if (cdb) {
      for (const storeName of ["chat", "contact"]) {
        if (!Array.from(cdb.objectStoreNames).includes(storeName)) continue;
        await new Promise((resolve) => {
          const tx = cdb.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const req = store.openCursor();
          req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve();
            const row = cur.value;
            const id =
              typeof row?.id === "string"
                ? row.id
                : row?.id?._serialized ||
                  (row?.id?.user && row?.id?.server ? `${row.id.user}@${row.id.server}` : null);
            const name =
              row?.name || row?.formattedTitle || row?.pushname || row?.pushName || row?.verifiedName;
            if (id && name) names.set(String(id), String(name).trim());
            cur.continue();
          };
          req.onerror = () => resolve();
        });
      }
      cdb.close();
    }
  }
  out.names = names.size;

  const rows = [];
  {
    const db = await openDb("model-storage");
    if (!db) {
      out.errors.push("no model-storage");
      return out;
    }
    let storeName = null;
    for (const cand of ["message", "messages"]) {
      if (Array.from(db.objectStoreNames).includes(cand)) {
        storeName = cand;
        break;
      }
    }
    if (!storeName) {
      for (const sn of Array.from(db.objectStoreNames)) {
        if (/message/i.test(sn) && sn !== "chat") {
          storeName = sn;
          break;
        }
      }
    }
    if (!storeName) {
      out.errors.push("no message store");
      db.close();
      return out;
    }
    await new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        rows.push(cur.value);
        out.read++;
        cur.continue();
      };
      req.onerror = () => resolve();
    });
    db.close();
  }

  for (const row of rows) {
    const parsed = parseMessageId(row);
    if (!parsed) continue;
    const rawType = String(row.type ?? row.msgType ?? "chat").toLowerCase();
    if (NOISE.has(rawType)) continue;
    if (row.isRevoked || row.revoked) continue;
    const type = mapType(rawType);
    const tsRaw = row.t ?? row.timestamp ?? row.ts;
    const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
    const ms = Number.isFinite(tsNum) ? (tsNum > 1e12 ? tsNum : tsNum * 1000) : Date.now();
    const media = extractMedia(row);
    const contactName = names.get(parsed.chatId) || row.notifyName || row.pushName || null;
    out.types[type] = (out.types[type] || 0) + 1;
    out.messages.push({
      chat_id: parsed.chatId,
      msg_id: parsed.msgId,
      ts: new Date(ms).toISOString(),
      direction: parsed.isOut ? "out" : "in",
      type,
      text: extractText(row, type, rawType),
      reply_to: null,
      source: "wa_web",
      contact_name: contactName,
      from: { phone: null, name: contactName },
      raw: { idb_keys: Object.keys(row).slice(0, 20), wa_type: rawType },
      meta: {
        duration: row.duration ?? null,
        mimetype: row.mimetype ?? null,
        ...(media ? { media } : {}),
      },
    });
  }

  // Prefer newer for media work
  out.messages.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return out;
});

console.log("scrape", {
  read: scraped.read,
  messages: scraped.messages?.length,
  names: scraped.names,
  types: scraped.types,
  errors: scraped.errors,
});

if (!scraped.messages?.length) {
  console.error("No messages scraped");
  await context.close();
  process.exit(1);
}

// Ingest from Node (no CORS)
let sent = 0;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
  "X-Operator-Id": "matias",
};
for (let i = 0; i < scraped.messages.length; i += BATCH) {
  const batch = scraped.messages.slice(i, i + BATCH);
  const res = await fetch(`${API}/api/wa/ingest`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operator_id: "matias",
      batch_id: crypto.randomUUID(),
      live: false,
      messages: batch,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("ingest fail", res.status, t.slice(0, 200));
  } else {
    const j = await res.json().catch(() => ({}));
    sent += batch.length;
    console.log(`ingest batch ${i / BATCH + 1}: inserted=${j.inserted} rejected=${j.rejected_count}`);
  }
}
console.log("sent", sent);

// Media: decrypt in page (CDN cookies), upload from Node
const mediaCandidates = scraped.messages.filter(
  (m) =>
    (m.type === "image" || m.type === "audio") &&
    m.meta?.media?.directPath &&
    m.meta?.media?.mediaKey,
);
console.log("media candidates", mediaCandidates.length, "cap", MEDIA_CAP);

let mediaOk = 0,
  mediaFail = 0;
for (const m of mediaCandidates.slice(0, MEDIA_CAP)) {
  const kind = m.type === "audio" ? "audio" : "image";
  const media = m.meta.media;
  const decrypted = await page.evaluate(
    async ({ directPath, mediaKeyB64, kind }) => {
      const HKDF_INFO = {
        image: "WhatsApp Image Keys",
        video: "WhatsApp Video Keys",
        audio: "WhatsApp Audio Keys",
        document: "WhatsApp Document Keys",
        sticker: "WhatsApp Image Keys",
      };
      function b64ToBytes(b64) {
        const clean = b64.replace(/-/g, "+").replace(/_/g, "/");
        const bin = atob(clean);
        const outb = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) outb[i] = bin.charCodeAt(i);
        return outb;
      }
      function bytesToBase64(bytes) {
        let s = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          s += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(s);
      }
      try {
        const mediaKey = b64ToBytes(mediaKeyB64);
        const info = new TextEncoder().encode(HKDF_INFO[kind] || HKDF_INFO.image);
        const baseKey = await crypto.subtle.importKey("raw", mediaKey, "HKDF", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits(
          { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info },
          baseKey,
          112 * 8,
        );
        const expanded = new Uint8Array(bits);
        const iv = expanded.slice(0, 16);
        const cipherKey = expanded.slice(16, 48);
        const p = directPath.startsWith("/") ? directPath : `/${directPath}`;
        let url = directPath.startsWith("http") ? directPath : `https://mmg.whatsapp.net${p}`;
        let res = await fetch(url, { method: "GET", credentials: "include" });
        if (!res.ok && !directPath.startsWith("http")) {
          res = await fetch(`https://media.fna.whatsapp.net${p}`, {
            method: "GET",
            credentials: "include",
          });
        }
        if (!res.ok) return { ok: false, status: res.status };
        const enc = new Uint8Array(await res.arrayBuffer());
        const cipher = enc.length > 10 ? enc.slice(0, enc.length - 10) : enc;
        const key = await crypto.subtle.importKey("raw", cipherKey, { name: "AES-CBC" }, false, [
          "decrypt",
        ]);
        const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, cipher));
        return { ok: true, b64: bytesToBase64(plain), bytes: plain.byteLength };
      } catch (e) {
        return { ok: false, error: String(e?.message || e) };
      }
    },
    { directPath: media.directPath, mediaKeyB64: media.mediaKey, kind },
  );

  if (!decrypted?.ok) {
    mediaFail++;
    console.log("media decrypt fail", m.type, decrypted);
    continue;
  }

  const up = await fetch(`${API}/api/wa/media`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      msg_id: m.msg_id,
      chat_id: m.chat_id,
      type: m.type,
      mimetype: media.mimetype || (m.type === "audio" ? "audio/ogg" : "image/jpeg"),
      bytes_base64: decrypted.b64,
    }),
  });
  if (up.ok) {
    mediaOk++;
    console.log("media ok", m.type, decrypted.bytes, "bytes");
  } else {
    mediaFail++;
    const t = await up.text().catch(() => "");
    console.log("media upload fail", up.status, t.slice(0, 120));
  }
}
console.log({ mediaOk, mediaFail });

console.log("Waiting 40s for STT…");
await page.waitForTimeout(40000);

const health = await (await fetch(`${API}/api/wa/health`)).json();
console.log("health", health);

const conv = await (await fetch(`${API}/api/wa/conversations?limit=40`, { headers })).json();
let withMedia = 0,
  withStt = 0,
  total = 0,
  images = 0,
  audios = 0,
  realText = 0;
const mediaSamples = [];
for (const c of (conv.items || []).slice(0, 30)) {
  const mj = await (
    await fetch(`${API}/api/wa/messages?chat_id=${encodeURIComponent(c.chat_id)}&limit=100`, {
      headers,
    })
  ).json();
  for (const m of mj.items || []) {
    total++;
    if (m.type === "image") images++;
    if (m.type === "audio") audios++;
    if (m.has_media) {
      withMedia++;
      if (mediaSamples.length < 6) {
        mediaSamples.push({
          chat: c.contact_name || c.chat_id.slice(0, 16),
          type: m.type,
          text: (m.display_text || m.text || m.transcript || "").slice(0, 70),
          stt: m.transcript_status,
        });
      }
    }
    if (m.transcript_status === "done" || m.transcript) withStt++;
    const body = (m.display_text || m.text || "").trim();
    if (body && !body.startsWith("[")) realText++;
  }
}
console.log({ total, images, audios, withMedia, withStt, realText, mediaSamples });

console.log("Done — closing in 8s");
await page.waitForTimeout(8000);
await context.close();
process.exit(sent > 0 ? 0 : 1);
