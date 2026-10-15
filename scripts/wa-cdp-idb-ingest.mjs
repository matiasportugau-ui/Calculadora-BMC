/**
 * Connect to an already-running Chrome (CDP :9334) whose tab is web.whatsapp.com,
 * scrape model-storage IndexedDB (since WA_SINCE), POST /api/wa/ingest from Node.
 * Does not launch Playwright and does not create a new WA device.
 */
import { filterIngestMessagesSince } from "../server/lib/waValidate.js";
import { readFileSync } from "fs";

const TOKEN = process.env.API_AUTH_TOKEN || process.env.WA_TOKEN;
const API = (process.env.WA_API || "https://panelin-calc-642127786762.us-central1.run.app").replace(
  /\/+$/,
  "",
);
const SINCE = process.env.WA_SINCE || "2026-08-27T00:00:00.000Z";
const BATCH = Number(process.env.BATCH || 80);
const CDP = process.env.CDP_URL || "http://127.0.0.1:9334";

if (!TOKEN) {
  console.error("API_AUTH_TOKEN required");
  process.exit(1);
}

const scrapeJs = readFileSync(process.env.WA_SCRAPE_JS, "utf8");

async function cdpCall(ws, id, method, params) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cdp timeout " + method)), 120000);
    function onMsg(ev) {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMsg);
      clearTimeout(timer);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const list = await fetch(CDP + "/json/list").then((r) => r.json());
const isWaTab = (u) => {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" && url.hostname === "web.whatsapp.com";
  } catch {
    return false;
  }
};
const page = (list || []).find((t) => isWaTab(t.url));
if (!page?.webSocketDebuggerUrl) {
  console.error("No WA tab on CDP. tabs=", (list || []).map((t) => t.url).slice(0, 8));
  process.exit(3);
}
console.log("CDP page", page.title, page.url);

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", rej);
});

const ev = await cdpCall(ws, 1, "Runtime.evaluate", {
  expression: scrapeJs,
  awaitPromise: true,
  returnByValue: true,
  timeout: 120000,
});
ws.close();

const raw = ev?.result?.value;
let scraped;
try {
  scraped = typeof raw === "string" ? JSON.parse(raw) : raw;
} catch {
  console.error("parse fail", String(raw).slice(0, 400));
  process.exit(4);
}

console.log("scrape", {
  read: scraped.read,
  kept: scraped.kept,
  n: scraped.messages?.length,
  names: scraped.names,
  types: scraped.types,
  errors: scraped.errors,
  dbs: scraped.dbs,
});

const messages = filterIngestMessagesSince(scraped.messages || [], SINCE);
console.log("window", messages.length);
if (!messages.length) {
  console.error("No in-window messages");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${TOKEN}`,
  "X-Operator-Id": "matias",
};
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
  const j = JSON.parse(t);
  if (!res.ok) {
    console.error("ingest fail", res.status, t.slice(0, 400));
    process.exit(5);
  }
  inserted += Number(j.inserted || 0);
  rejected += Number(j.rejected_count || 0);
  console.log(`batch ${i / BATCH + 1}: inserted=${j.inserted} rejected=${j.rejected_count}`);
}
console.log("done inserted", inserted, "rejected", rejected, "sent", messages.length);
process.exit(0);
