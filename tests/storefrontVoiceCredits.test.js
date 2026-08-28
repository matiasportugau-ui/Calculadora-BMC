// Credits-dead cache for the public shop orb.
// Run: node tests/storefrontVoiceCredits.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isGrokCreditsError,
  markStorefrontCreditsDead,
  markStorefrontCreditsLive,
  storefrontVoiceBubbleOn,
  storefrontVoiceStatus,
  storefrontCreditsDenyBody,
  __resetStorefrontVoiceCredits,
  __setStorefrontCreditsDeadUntil,
} from "../server/lib/voice/storefrontVoiceCredits.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

__resetStorefrontVoiceCredits();

assert.equal(
  isGrokCreditsError({
    status: 403,
    body: "Your team has used all available credits or reached monthly spending limit",
  }),
  true,
);
assert.equal(isGrokCreditsError({ status: 402, body: "payment required" }), true);
assert.equal(isGrokCreditsError({ status: 502, message: "mint failed" }), false);
assert.equal(isGrokCreditsError({ status: 503, message: "API key not configured" }), false);

assert.equal(storefrontVoiceBubbleOn(), true);
assert.equal(storefrontVoiceStatus().bubble, true);

const marked = markStorefrontCreditsDead({
  status: 400,
  body: '{"error":"used all available credits or reached monthly spending limit"}',
});
assert.equal(marked, true);
assert.equal(storefrontVoiceBubbleOn(), false);
assert.equal(storefrontVoiceStatus().bubble, false);

assert.equal(markStorefrontCreditsDead({ status: 500, body: "upstream timeout" }), false);

markStorefrontCreditsLive();
assert.equal(storefrontVoiceBubbleOn(), true);

__setStorefrontCreditsDeadUntil(Date.now() + 60_000);
assert.deepEqual(storefrontCreditsDenyBody(), {
  ok: false,
  bubble: false,
  code: "credits",
  error: "No se pudo iniciar la voz.",
});
__resetStorefrontVoiceCredits();

const publicVoice = fs.readFileSync(path.join(ROOT, "server/routes/publicVoice.js"), "utf8");
assert.match(publicVoice, /router\.get\("\/status"/, "GET /status for the widget probe");
assert.match(publicVoice, /storefrontVoiceStatus/, "status uses credits cache");
assert.match(publicVoice, /markStorefrontCreditsDead/, "mint maps credits → cache");
assert.match(publicVoice, /code: "credits"|storefrontCreditsDenyBody/, "widget can hide on 403 credits");

const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
assert.match(widget, /\/api\/public\/voice\/status/, "probe before mount");
assert.match(widget, /function hideBubble/, "unmount orb when dry");
assert.match(widget, /j\.bubble === false/, "status.bubble false skips the orb");
assert.match(widget, /err\?\.code === "credits"/, "live mint 403 unmounts");
assert.ok(!widget.includes("document.body.appendChild(root);"), "do not append before status");

// #1170 hideBubble on credits + parallel openMic orphaned MediaStream (no Cortar voz UI).
// Mint /session first; only then getUserMedia.
{
  const startCallIdx = widget.indexOf("async function startCall()");
  assert.ok(startCallIdx >= 0, "startCall present");
  const startCallChunk = widget.slice(startCallIdx, startCallIdx + 3600);
  const sessFetchIdx = startCallChunk.search(/fetch\(`\$\{API\}\/api\/public\/voice\/session`/);
  const openMicIdx = startCallChunk.indexOf("await openMic()");
  assert.ok(sessFetchIdx >= 0, "startCall mints /session");
  assert.ok(openMicIdx >= 0, "startCall opens mic");
  assert.ok(
    sessFetchIdx < openMicIdx,
    "session mint before openMic — failed /session must not leave mic tracks live",
  );
  assert.ok(
    !/Promise\.all\(\[micP,\s*sessP\]\)/.test(startCallChunk),
    "no parallel mic+session (orphans MediaStream on reject)",
  );
  assert.match(
    startCallChunk,
    /if \(stream\) \{[\s\S]*getTracks\(\)\.forEach/,
    "error path stops mic if opened after a successful mint",
  );
  const creditsIdx = startCallChunk.indexOf('err?.code === "credits"');
  const stopIdx = startCallChunk.search(/if \(stream\) \{/);
  assert.ok(creditsIdx > 0 && stopIdx > 0 && stopIdx < creditsIdx, "stop mic before hideBubble on credits");
}

console.log("storefrontVoiceCredits.test.js ok");
