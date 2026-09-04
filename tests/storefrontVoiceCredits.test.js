// Credits-dead cache for the public shop orb.
// Run: node tests/storefrontVoiceCredits.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isGrokCreditsError,
  isStorefrontTextQuotaError,
  shopperSafeChatError,
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
assert.equal(
  isGrokCreditsError({
    status: 403,
    error: { message: "Your team has used all available credits or reached monthly spending limit" },
  }),
  true,
  "OpenAI SDK nested error.message",
);
assert.equal(isGrokCreditsError({ status: 502, message: "mint failed" }), false);
assert.equal(isGrokCreditsError({ status: 503, message: "API key not configured" }), false);
assert.equal(
  isStorefrontTextQuotaError({ status: 429, message: "You have no credits remaining. Add credits to continue" }),
  true,
);
assert.equal(isStorefrontTextQuotaError({ status: 429, message: "429 status code (no body)" }), true);
{
  const safe = shopperSafeChatError({ status: 429, message: "429 status code (no body)" });
  assert.equal(safe.status, 429);
  assert.match(safe.message, /ocupado/i);
  assert.ok(!/no body/i.test(safe.message));
}

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
assert.match(publicVoice, /storefrontBrainStatus/, "status reports public-safe shared brain");
assert.match(publicVoice, /markStorefrontCreditsDead/, "mint maps credits → cache");
assert.match(publicVoice, /code: "credits"|storefrontCreditsDenyBody/, "widget can hide on 403 credits");

const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");
assert.match(widget, /\/api\/public\/voice\/status/, "probe before mount");
assert.match(widget, /function hideBubble/, "hideBubble helper retained");
assert.match(widget, /j\.bubble === false/, "status.bubble false is detected");
assert.ok(
  !/j\.bubble === false && !LOCAL_HOST\) return/.test(widget),
  "must not skip attachBubble when Grok credits are dead (pipeline/text still work)",
);
assert.match(
  widget,
  /voiceMode = "pipeline"/,
  "realtime mode downgrades to pipeline when bubble is false",
);
assert.match(widget, /realtimeAvailable = false/, "marks realtime unavailable when dry");
assert.match(widget, /err\?\.code === "credits"/, "live mint 403 is handled");
assert.match(widget, /el chat no se cierra|El chat sigue/, "credits must not unmount an open chat");
assert.match(widget, /open \.bmc-launch\{visibility:hidden;pointer-events:none\}/, "open panel ignores orb clicks without collapsing the chat");
assert.ok(!widget.includes("document.body.appendChild(root);"), "do not append before status");
assert.match(widget, /attachBubble\(\)/, "boot always mounts after status probe");

console.log("storefrontVoiceCredits.test.js ok");
