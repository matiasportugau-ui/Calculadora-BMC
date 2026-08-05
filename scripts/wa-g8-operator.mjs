#!/usr/bin/env node
/**
 * G8 operator one-shot — automate everything possible so you only do a few clicks.
 *
 * Flow:
 *  1) Preflight (token, profile, whisper)
 *  2) Open headed Chrome (persistent WA Web profile)
 *  3) Open target chat (default "Jose Luis") and try to play voice notes
 *  4) Capture any real Ogg/Opus responses from network → POST /api/wa/media
 *  5) CDN decrypt backfill for remaining audio (mediaKey + directPath)
 *  6) Local Whisper STT once
 *  7) Print scorecard + cockpit link
 *
 * Usage:
 *   ./scripts/wa-g8-one-click.sh
 *   # or:
 *   WA_TOKEN=… node scripts/wa-g8-operator.mjs
 *
 * Env:
 *   WA_TOKEN          required (or set via one-click.sh from Doppler)
 *   WA_API            default panelin-calc URL
 *   PROFILE           default .runtime/chrome-wa-profile
 *   CHAT_QUERY        default "Jose Luis" (search string in WA Web)
 *   CHAT_ID           optional hard filter e.g. 115500310863875@lid
 *   AUTO_PLAY_MAX     default 8 voice notes to click
 *   WAIT_USER_SEC     default 90 — after auto-play, wait for you to finish manual plays
 *   SKIP_BROWSER=1    only backfill+STT (no UI)
 *   SKIP_STT=1        skip whisper
 *   WHISPER_MODEL     default turbo (falls back if missing)
 *   HEADLESS=1        headless browser (not recommended for first run)
 */
import { chromium } from "playwright";
import { spawn, spawnSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { detectAudioKind, validateMediaBuffer } from "../server/lib/waMedia.js";
import { profileProcPattern } from "./lib/waChromeProfileMatch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILE = process.env.PROFILE || path.join(ROOT, ".runtime/chrome-wa-profile");
const API = (process.env.WA_API || "https://panelin-calc-q74zutv7dq-uc.a.run.app").replace(/\/+$/, "");
const TOKEN = process.env.WA_TOKEN;
const CHAT_QUERY = process.env.CHAT_QUERY || "Jose Luis";
const CHAT_ID = process.env.CHAT_ID || "115500310863875@lid";
const AUTO_PLAY_MAX = Number(process.env.AUTO_PLAY_MAX || 8);
const WAIT_USER_SEC = Number(process.env.WAIT_USER_SEC || 90);
const SKIP_BROWSER = process.env.SKIP_BROWSER === "1";
const SKIP_STT = process.env.SKIP_STT === "1";
const HEADLESS = process.env.HEADLESS === "1";
const MEDIA_CAP = Number(process.env.MEDIA_CAP || 20);
const LOG_DIR = path.join(ROOT, ".runtime");
const LOG = path.join(LOG_DIR, "wa-g8-operator.log");

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG, line + "\n");
  } catch {
    /* */
  }
}

if (!TOKEN) {
  console.error("WA_TOKEN required. Use: ./scripts/wa-g8-one-click.sh");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "X-Operator-Id": "matias-g8-operator",
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
  const expanded = Buffer.from(
    crypto.hkdfSync("sha256", mediaKey, Buffer.alloc(32), info, 112),
  );
  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);
  const cipher = encBuf.length > 10 ? encBuf.subarray(0, encBuf.length - 10) : encBuf;
  const decipher = crypto.createDecipheriv("aes-256-cbc", cipherKey, iv);
  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}

async function apiGet(pathname) {
  const res = await fetch(`${API}${pathname}`, { headers });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `${pathname} ${res.status}`);
  return j;
}

async function uploadMedia({ msg_id, chat_id, type, mimetype, buffer }) {
  const v = validateMediaBuffer(buffer, { expect: type === "audio" ? "audio" : "any" });
  if (!v.ok) {
    return { ok: false, error: v.error, bytes: buffer.length };
  }
  const res = await fetch(`${API}/api/wa/media`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      msg_id,
      chat_id,
      type: type || v.kind,
      mimetype: v.mime || mimetype,
      bytes_base64: buffer.toString("base64"),
    }),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, ...j, subkind: v.subkind, bytes: buffer.length };
}

async function listAudioCandidates() {
  const conv = await apiGet("/api/wa/conversations?limit=80");
  const out = [];
  for (const c of conv.items || []) {
    if (CHAT_ID && c.chat_id !== CHAT_ID) continue;
    const mj = await apiGet(
      `/api/wa/messages?chat_id=${encodeURIComponent(c.chat_id)}&limit=120`,
    );
    for (const m of mj.items || []) {
      if ((m.type || "").toLowerCase() !== "audio") continue;
      out.push({
        msg_id: m.msg_id,
        chat_id: c.chat_id,
        contact: c.contact_name || c.chat_id,
        has_media: Boolean(m.has_media),
        transcript_status: m.transcript_status,
        transcript: m.transcript,
        text: m.display_text || m.text,
        media: m.meta?.media || null,
      });
    }
  }
  return out;
}

function preflight() {
  log("preflight API", API);
  if (!fs.existsSync(PROFILE)) {
    log("WARN profile missing — first run may need QR scan:", PROFILE);
  }
  try {
    const r = spawn("python3", ["-m", "whisper", "--help"], { stdio: "ignore" });
    // fire-and-forget existence
    r.on("error", () => log("WARN whisper module may be missing"));
  } catch {
    log("WARN cannot spawn python3 whisper");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** True when another Chrome already holds this exact user-data-dir. */
function profileBusy() {
  if (process.env.WA_G8_ALLOW_BUSY_PROFILE === "1") return false;
  const pattern = profileProcPattern(PROFILE);
  const r = spawnSync("pgrep", ["-f", pattern], { encoding: "utf8" });
  return r.status === 0;
}

function assertProfileExclusive() {
  if (!profileBusy()) return;
  console.error("");
  console.error("ERROR: Chrome is already using this PROFILE (always-on / another session).");
  console.error("  Profile:", PROFILE);
  console.error("Sharing the profile with Playwright deletes SingletonLock and can unlink WA Web.");
  console.error("Stop always-on first, then re-run G8:");
  console.error("  ./scripts/wa-chrome-always-on.sh --stop");
  console.error("  ./scripts/wa-g8-one-click.sh");
  console.error("  ./scripts/wa-chrome-always-on.sh");
  console.error("Or play ▶ in the always-on window and run STT only:");
  console.error("  ONCE=1 node scripts/wa-local-stt-worker.mjs");
  console.error("Escape hatch (unsafe): WA_G8_ALLOW_BUSY_PROFILE=1");
  process.exit(3);
}

async function openWaAndPlay(capturedBuffers) {
  assertProfileExclusive();
  for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try {
      fs.unlinkSync(path.join(PROFILE, f));
    } catch {
      /* */
    }
  }

  log("launching Chrome headed — if QR appears, scan once");
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: HEADLESS,
    channel: "chrome",
    args: ["--no-first-run", "--disable-blink-features=AutomationControlled"],
    viewport: { width: 1280, height: 900 },
  });

  // Capture network responses that look like real audio
  context.on("response", async (res) => {
    try {
      const ct = (res.headers()["content-type"] || "").toLowerCase();
      const url = res.url();
      if (!res.ok()) return;
      const looksMedia =
        ct.includes("audio") ||
        ct.includes("ogg") ||
        ct.includes("octet-stream") ||
        /mmg\.whatsapp|media\.fna\.whatsapp|pps\.whatsapp/.test(url);
      if (!looksMedia) return;
      const body = Buffer.from(await res.body());
      if (body.length < 2000) return;
      const kind = detectAudioKind(body);
      if (!kind) return; // skip JS/html junk
      capturedBuffers.push({ url: url.slice(0, 120), kind, buffer: body, at: Date.now() });
      log("NET audio", kind, body.length, url.slice(0, 70));
    } catch {
      /* ignore */
    }
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto("https://web.whatsapp.com/", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  // Wait for main UI or QR
  log("waiting for WhatsApp Web ready (QR or chat list)…");
  try {
    await page.waitForSelector(
      '[data-testid="chat-list"], [data-testid="qrcode"], canvas[aria-label*="QR"], div[role="textbox"]',
      { timeout: 120000 },
    );
  } catch {
    log("WARN timed out waiting for WA UI — continue anyway");
  }

  // If QR, give operator time
  const qr = await page.$('[data-testid="qrcode"], canvas[aria-label*="QR"]');
  if (qr) {
    log(">>> QR visible — SCAN with your phone (waiting up to 3 min)…");
    await page
      .waitForSelector('[data-testid="chat-list"], div[role="textbox"]', { timeout: 180000 })
      .catch(() => log("WARN still no chat list after QR wait"));
  }

  // Search chat
  log("opening chat search for:", CHAT_QUERY);
  try {
    // Focus search — several WA Web variants
    const searchSelectors = [
      '[data-testid="chat-list-search"]',
      'div[title="Search input textbox"]',
      'div[contenteditable="true"][data-tab="3"]',
      '[aria-label="Search input textbox"]',
      'button[aria-label="Search or start new chat"]',
    ];
    let focused = false;
    for (const sel of searchSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 3000 }).catch(() => {});
        focused = true;
        break;
      }
    }
    if (!focused) {
      await page.keyboard.press("Meta+Alt+/").catch(() => {});
      await page.keyboard.press("Control+/").catch(() => {});
    }
    await sleep(500);
    // Type into active search
    await page.keyboard.type(CHAT_QUERY, { delay: 40 });
    await sleep(1500);
    await page.keyboard.press("Enter");
    await sleep(2000);
  } catch (e) {
    log("WARN search failed — click the chat manually:", e.message);
  }

  // Try click first search result / chat title
  try {
    const result = page
      .locator(`[data-testid="cell-frame-container"], span[title*="${CHAT_QUERY}" i]`)
      .first();
    if (await result.count()) {
      await result.click({ timeout: 5000 });
      await sleep(1500);
    }
  } catch {
    log("WARN could not auto-open chat — click", CHAT_QUERY, "in the left list");
  }

  // Scroll chat up a bit to load older notes
  try {
    const pane = page.locator('[data-testid="conversation-panel-messages"], #main').first();
    for (let i = 0; i < 4; i++) {
      await pane.evaluate((el) => {
        el.scrollTop = 0;
      });
      await sleep(800);
    }
  } catch {
    /* */
  }

  // Auto-click voice note play buttons
  log("auto-playing up to", AUTO_PLAY_MAX, "voice notes…");
  let played = 0;
  try {
    // WA Web audio buttons: play icons near voice messages
    const playButtons = page.locator(
      [
        'button[aria-label*="Play" i]',
        'button[aria-label*="Reproducir" i]',
        'span[data-icon="audio-play"]',
        'span[data-icon="ptt-out-blue"]',
        'div[role="button"] span[data-icon="audio-play"]',
        // fallback: any button inside audio message containers
        'div[data-testid="audio-play"]',
      ].join(", "),
    );
    const n = await playButtons.count();
    log("play controls found:", n);
    const limit = Math.min(n, AUTO_PLAY_MAX);
    for (let i = 0; i < limit; i++) {
      try {
        const btn = playButtons.nth(i);
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click({ timeout: 3000 });
        played++;
        log("played #", i + 1);
        await sleep(3500); // let CDN fetch
      } catch (e) {
        log("play click fail", i, e.message?.slice(0, 60));
      }
    }
  } catch (e) {
    log("WARN auto-play error:", e.message);
  }

  log("");
  log("════════════════════════════════════════════════════════");
  log(" YOUR CLICKS (if anything missing):");
  log("  1. Confirm chat is", CHAT_QUERY);
  log("  2. Click ▶ on remaining voice notes (watch them play)");
  log("  3. Wait until this script continues (or press Enter in terminal)");
  log("════════════════════════════════════════════════════════");
  log(`Waiting ${WAIT_USER_SEC}s for manual plays + network capture…`);

  // Also accept Enter to skip wait early
  const waitPromise = sleep(WAIT_USER_SEC * 1000);
  const enterPromise = new Promise((resolve) => {
    if (!process.stdin.isTTY) return;
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      log("Enter received — continuing early");
      resolve();
    });
  });
  await Promise.race([waitPromise, enterPromise]);
  try {
    process.stdin.setRawMode?.(false);
    process.stdin.pause();
  } catch {
    /* */
  }

  log("network audio captures:", capturedBuffers.length);
  return { context, page, played };
}

async function matchAndUploadCaptured(capturedBuffers, candidates) {
  // Prefer pairing by time order: newest captures → pending audio without media
  const pending = candidates.filter((c) => !c.has_media);
  let uploaded = 0;
  // If we only have captures without msg binding, try CDN path for each candidate first
  for (const c of pending) {
    if (!c.media?.directPath || !c.media?.mediaKey) continue;
    // skip if already has media
  }
  // Attach captures only when we can validate audio magic — still need msg_id.
  // Captures without msg_id are logged for diagnostics; CDN decrypt is the reliable path.
  for (const cap of capturedBuffers) {
    log("captured audio available", cap.kind, cap.bytes || cap.buffer.length, "(used via backfill if CDN fills)");
  }
  return uploaded;
}

async function backfillAudioFromCdn(context, candidates) {
  const pending = candidates
    .filter((c) => !c.has_media && c.media?.directPath && c.media?.mediaKey)
    .slice(0, MEDIA_CAP);
  log("CDN backfill candidates:", pending.length);
  let ok = 0;
  let fail = 0;
  for (const c of pending) {
    const pathPart = c.media.directPath.startsWith("/")
      ? c.media.directPath
      : `/${c.media.directPath}`;
    const urls = c.media.directPath.startsWith("http")
      ? [c.media.directPath]
      : [
          `https://mmg.whatsapp.net${pathPart}`,
          `https://media.fna.whatsapp.net${pathPart}`,
        ];
    let enc = null;
    for (const url of urls) {
      try {
        const res = await context.request.get(url, {
          timeout: 30000,
          headers: {
            Referer: "https://web.whatsapp.com/",
            Origin: "https://web.whatsapp.com",
          },
        });
        if (res.ok()) {
          enc = Buffer.from(await res.body());
          break;
        }
        log("  download", res.status(), url.slice(0, 60));
      } catch (e) {
        log("  download err", e.message?.slice(0, 80));
      }
    }
    if (!enc?.length) {
      fail++;
      log("FAIL download", c.msg_id.slice(0, 36));
      continue;
    }
    try {
      const plain = decryptWaMedia(enc, c.media.mediaKey, "audio");
      const up = await uploadMedia({
        msg_id: c.msg_id,
        chat_id: c.chat_id,
        type: "audio",
        mimetype: c.media.mimetype || "audio/ogg; codecs=opus",
        buffer: plain,
      });
      if (up.ok) {
        ok++;
        log("OK upload", c.msg_id.slice(0, 36), up.bytes, up.subkind || "");
      } else {
        fail++;
        log("FAIL upload", up.error || up.status, c.msg_id.slice(0, 36));
      }
    } catch (e) {
      fail++;
      log("FAIL decrypt", e.message);
    }
  }
  return { ok, fail };
}

async function tryUploadFromPageCache(page, candidates) {
  // Best-effort: scrape media blobs already in browser memory via evaluate (limited)
  // WA doesn't expose easily; return 0 — CDN + network capture are primary.
  void page;
  void candidates;
  return 0;
}

function runLocalStt() {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      WA_TOKEN: TOKEN,
      WA_API: API,
      ONCE: "1",
      WHISPER_MODEL: process.env.WHISPER_MODEL || "turbo",
      BATCH: process.env.BATCH || "5",
      CLEAR_JUNK: "1",
    };
    log("starting local STT worker once… model=", env.WHISPER_MODEL);
    const child = spawn("node", [path.join(ROOT, "scripts/wa-local-stt-worker.mjs")], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: ROOT,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function scorecard() {
  const list = await listAudioCandidates();
  const withMedia = list.filter((a) => a.has_media).length;
  const done = list.filter((a) => a.transcript_status === "done").length;
  const pending = list.filter((a) => a.has_media && a.transcript_status !== "done" && a.transcript_status !== "skipped").length;
  log("");
  log("════════ G8 SCORECARD ════════");
  log("chat filter:", CHAT_ID || CHAT_QUERY);
  log("audio msgs:", list.length);
  log("with_media:", withMedia);
  log("transcript done:", done);
  log("pending STT:", pending);
  for (const a of list) {
    const tr = (a.transcript || "").slice(0, 60);
    log(
      " ·",
      a.msg_id.slice(-18),
      "media=",
      a.has_media,
      "st=",
      a.transcript_status || "-",
      tr ? `«${tr}»` : "",
    );
  }
  log("cockpit:", "https://calculadora-bmc.vercel.app/hub/wa");
  log("log file:", LOG);
  log("══════════════════════════════");
  return { total: list.length, withMedia, done, pending };
}

async function main() {
  preflight();
  log("listing audio rows…");
  let candidates = await listAudioCandidates();
  log("audio candidates:", candidates.length, "with_media", candidates.filter((c) => c.has_media).length);

  const capturedBuffers = [];
  let context = null;

  if (!SKIP_BROWSER) {
    const session = await openWaAndPlay(capturedBuffers);
    context = session.context;
    await tryUploadFromPageCache(session.page, candidates);
    await matchAndUploadCaptured(capturedBuffers, candidates);
    // Refresh candidates after plays
    candidates = await listAudioCandidates();
    const bf = await backfillAudioFromCdn(context, candidates);
    log("backfill result", bf);
    // Keep browser open a moment so user sees success
    await sleep(1500);
    await context.close().catch(() => {});
  } else {
    log("SKIP_BROWSER — CDN-only backfill needs cookies; launching headless profile…");
    assertProfileExclusive();
    for (const f of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
      try {
        fs.unlinkSync(path.join(PROFILE, f));
      } catch {
        /* */
      }
    }
    context = await chromium.launchPersistentContext(PROFILE, {
      headless: true,
      channel: "chrome",
      args: ["--no-first-run"],
    });
    const page = context.pages()[0] || (await context.newPage());
    await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    await sleep(3000);
    const bf = await backfillAudioFromCdn(context, candidates);
    log("backfill result", bf);
    await context.close().catch(() => {});
  }

  if (!SKIP_STT) {
    // Prefer turbo, fall back to base if turbo fails hard
    let stt = await runLocalStt();
    if (stt.code !== 0 && !process.env.WHISPER_MODEL) {
      log("retry STT with model=base");
      process.env.WHISPER_MODEL = "base";
      stt = await runLocalStt();
    }
  } else {
    log("SKIP_STT=1");
  }

  const sc = await scorecard();
  if (sc.done > 0) {
    log("SUCCESS — at least one real Spanish transcript is done.");
    process.exit(0);
  }
  if (sc.withMedia > 0) {
    log("PARTIAL — media uploaded but STT not done. Re-run: ONCE=1 node scripts/wa-local-stt-worker.mjs");
    process.exit(0);
  }
  log("NO_MEDIA — play voice notes until they actually play sound, then re-run this script.");
  log("Tip: leave the headed window open, click ▶, wait 2s each, then press Enter.");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
