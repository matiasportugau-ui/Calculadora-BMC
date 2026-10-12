/**
 * Scrape IndexedDB in the already-open WhatsApp Web Chrome tab (AppleScript JS),
 * then POST batches to production /api/wa/ingest from Node (no CORS, no Playwright).
 *
 *   doppler run --project bmc-backend --config prd -- \
 *     node scripts/wa-idb-ingest-open-tab.mjs
 */
import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { filterIngestMessagesSince } from "../server/lib/waValidate.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.API_AUTH_TOKEN || process.env.WA_TOKEN;
const API = (process.env.WA_API || "https://panelin-calc-642127786762.us-central1.run.app").replace(
  /\/+$/,
  "",
);
const SINCE = process.env.WA_SINCE || "2026-08-27T00:00:00.000Z";
const BATCH = Number(process.env.BATCH || 80);
const OUT = process.env.WA_INGEST_OUT || "";

if (!TOKEN && !process.argv.includes("--dump-js")) {
  console.error("API_AUTH_TOKEN or WA_TOKEN required");
  process.exit(1);
}

const scrapeJs = `(() => {
  const SINCE = ${JSON.stringify(SINCE)};
  const sinceMs = Date.parse(SINCE);
  const out = { read: 0, kept: 0, messages: [], names: 0, types: {}, errors: [], dbs: [] };

  function openDb(name) {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function stringifyJid(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      return String(v._serialized || (v.user && v.server && v.user + "@" + v.server) || "");
    }
    return "";
  }

  function parseMessageId(row) {
    const id = row.id ?? row.key?.id ?? row._id;
    if (id == null) return null;
    if (typeof id === "string") {
      const parts = id.split("_");
      if (parts.length >= 3 && (parts[0] === "true" || parts[0] === "false")) {
        return { isOut: parts[0] === "true", chatId: parts.slice(1, -1).join("_"), msgId: id };
      }
      return null;
    }
    if (typeof id === "object") {
      const isOut = Boolean(id.fromMe ?? row.fromMe);
      const chatId = stringifyJid(id.remote) || stringifyJid(row.from) || stringifyJid(row.to) || "";
      const inner = id.id != null ? String(id.id) : "";
      const msgId = id._serialized || (isOut + "_" + chatId + "_" + (inner || Date.now()));
      if (!chatId) return null;
      return { isOut, chatId, msgId: String(msgId).slice(0, 250) };
    }
    return null;
  }

  const NOISE = new Set([
    "e2e_notification","notification_template","gp2","ciphertext","call_log",
    "call_log_self","protocol","revoked","notification","hsm",
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
    for (const k of ["body","text","caption","comment","matchedText","description","title","filename","fileName"]) {
      if (typeof row[k] === "string" && row[k].trim()) return row[k].trim().slice(0, 7900);
    }
    const dur = row.duration != null && Number.isFinite(Number(row.duration))
      ? " · " + Math.round(Number(row.duration)) + "s" : "";
    if (type === "audio" || rawType === "ptt") return "[Nota de voz" + dur + "]";
    if (type === "image") return "[Imagen]";
    if (type === "video") return "[Video" + dur + "]";
    if (type === "sticker") return "[Sticker]";
    if (type === "doc") return row.filename || row.fileName || "[Documento]";
    if (type === "location") return "[Ubicación]";
    return null;
  }

  return (async () => {
    try {
      const list = (await indexedDB.databases?.()) || [];
      out.dbs = list.map((d) => d.name);
    } catch (e) {
      out.errors.push(String(e));
    }
    const names = new Map();
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
            const id = typeof row?.id === "string"
              ? row.id
              : row?.id?._serialized || (row?.id?.user && row?.id?.server ? row.id.user + "@" + row.id.server : null);
            const name = row?.name || row?.formattedTitle || row?.pushname || row?.pushName || row?.verifiedName;
            if (id && name) names.set(String(id), String(name).trim());
            cur.continue();
          };
          req.onerror = () => resolve();
        });
      }
      cdb.close();
    }
    out.names = names.size;

    const db = await openDb("model-storage");
    if (!db) {
      out.errors.push("no model-storage");
      return JSON.stringify(out);
    }
    let storeName = null;
    for (const cand of ["message", "messages"]) {
      if (Array.from(db.objectStoreNames).includes(cand)) { storeName = cand; break; }
    }
    if (!storeName) {
      for (const sn of Array.from(db.objectStoreNames)) {
        if (/message/i.test(sn) && sn !== "chat") { storeName = sn; break; }
      }
    }
    if (!storeName) {
      out.errors.push("no message store names=" + Array.from(db.objectStoreNames).join(","));
      db.close();
      return JSON.stringify(out);
    }
    await new Promise((resolve) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        out.read++;
        const row = cur.value;
        const parsed = parseMessageId(row);
        if (!parsed) { cur.continue(); return; }
        const rawType = String(row.type ?? row.msgType ?? "chat").toLowerCase();
        if (NOISE.has(rawType) || row.isRevoked || row.revoked) { cur.continue(); return; }
        const tsRaw = row.t ?? row.timestamp ?? row.ts;
        const tsNum = typeof tsRaw === "number" ? tsRaw : Number(tsRaw);
        const ms = Number.isFinite(tsNum) ? (tsNum > 1e12 ? tsNum : tsNum * 1000) : 0;
        if (ms && ms < sinceMs) { cur.continue(); return; }
        const type = mapType(rawType);
        const contactName = names.get(parsed.chatId) || row.notifyName || row.pushName || null;
        out.types[type] = (out.types[type] || 0) + 1;
        out.kept++;
        out.messages.push({
          chat_id: parsed.chatId,
          msg_id: parsed.msgId,
          ts: new Date(ms || Date.now()).toISOString(),
          direction: parsed.isOut ? "out" : "in",
          type,
          text: extractText(row, type, rawType),
          source: "wa_web",
          contact_name: contactName,
          from: { phone: null, name: contactName },
          raw: { wa_type: rawType },
          meta: { duration: row.duration ?? null },
        });
        cur.continue();
      };
      req.onerror = () => resolve();
    });
    db.close();
    return JSON.stringify(out);
  })();
})()`;

if (process.argv.includes("--dump-js")) {
  const dumpPath = process.env.WA_SCRAPE_JS || join(ROOT, ".runtime", "wa-idb-scrape.js");
  mkdirSync(dirname(dumpPath), { recursive: true });
  writeFileSync(dumpPath, scrapeJs, "utf8");
  console.log("wrote", dumpPath, scrapeJs.length);
  process.exit(0);
}

function chromeEval(js) {
  const jsPath =
    process.env.WA_SCRAPE_JS ||
    join(process.env.WA_INGEST_OUT ? dirname(process.env.WA_INGEST_OUT) : ROOT, ".runtime", "wa-idb-scrape.js");
  mkdirSync(dirname(jsPath), { recursive: true });
  writeFileSync(jsPath, js, "utf8");
  const script = `
set jsPath to "${jsPath.replace(/"/g, '\\"')}"
set js to read POSIX file jsPath as «class utf8»
tell application "Google Chrome"
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      set u to URL of t as text
      if u starts with "https://web.whatsapp.com" then
        set active tab index of w to i
        set index of w to 1
        return execute t javascript js
      end if
    end repeat
  end repeat
  return "NO_WA_TAB"
end tell
`;
  return execFileSync("osascript", ["-e", script], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
    timeout: 180000,
  }).trim();
}

console.log("Scraping open WA tab since", SINCE);
let raw;
try {
  raw = chromeEval(scrapeJs);
} catch (e) {
  console.error("AppleScript evaluate failed", e.message);
  process.exit(2);
}
if (raw === "NO_WA_TAB" || raw.startsWith("JS_ERR")) {
  console.error(raw);
  process.exit(3);
}

let scraped;
try {
  scraped = JSON.parse(raw);
} catch (e) {
  console.error("JSON parse fail", raw.slice(0, 400));
  process.exit(4);
}

console.log("scrape", {
  read: scraped.read,
  kept: scraped.kept,
  messages: scraped.messages?.length,
  names: scraped.names,
  types: scraped.types,
  errors: scraped.errors,
  dbs: scraped.dbs,
});

const messages = filterIngestMessagesSince(scraped.messages || [], SINCE);
console.log("after window filter", messages.length);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ scrape: { ...scraped, messages: undefined }, n: messages.length }, null, 2));
}

if (!messages.length) {
  console.error("No in-window messages");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
  "X-Operator-Id": "matias",
};

let sent = 0;
let inserted = 0;
let rejected = 0;
for (let i = 0; i < messages.length; i += BATCH) {
  const batch = messages.slice(i, i + BATCH);
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
  const t = await res.text();
  let j = {};
  try {
    j = JSON.parse(t);
  } catch {
    j = { raw: t.slice(0, 200) };
  }
  if (!res.ok) {
    console.error("ingest fail", res.status, t.slice(0, 300));
    process.exit(5);
  }
  sent += batch.length;
  inserted += Number(j.inserted || 0);
  rejected += Number(j.rejected_count || 0);
  console.log(`batch ${i / BATCH + 1}: inserted=${j.inserted} rejected=${j.rejected_count} chats=${j.chats_touched}`);
}
console.log("done sent", sent, "inserted", inserted, "rejected", rejected);
process.exit(0);
