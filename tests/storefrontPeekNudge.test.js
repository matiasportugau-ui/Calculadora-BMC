/**
 * Panelin Front sales peek (#1216): max 3 asomas, session dismiss,
 * scroll/load thresholds, same orb offset from WhatsApp.
 * Complementary to storefrontVoicePack chip-string smoke.
 * Run: node tests/storefrontPeekNudge.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const widget = fs.readFileSync(path.join(ROOT, "server/public/storefront-voice/widget.js"), "utf8");

console.log("storefrontPeekNudge");

assert.match(widget, /const NUDGE_KEY = "bmc_panelin_nudge"/, "session flag key");
assert.match(widget, /sessionStorage\.getItem\(NUDGE_KEY\) === "off"/, "dismiss is session-scoped");
assert.match(widget, /sessionStorage\.setItem\(NUDGE_KEY, "off"\)/, "chip × persists off");
assert.match(widget, /return nudge\.shown < 3/, "max 3 asomas per tab");
assert.match(widget, /if \(nudge\.shown >= 3\) root\.classList\.add\("nudge-done"\)/, "3rd peek docks");
assert.match(widget, /if \(y < 180 && nudge\.scrolled < 8\) return/, "ignore tiny header scrolls");
assert.match(widget, /setTimeout\(\(\) => asoma\(\), 400\)/, "asoma after scroll pause");
assert.match(widget, /if \(nudge\.shown === 0\) asoma\(\)/, "first peek on load");
assert.match(widget, /,\s*4000\)/, "first peek waits 4s");
assert.match(widget, /,\s*8000\)/, "peek holds 8s then tucks");

assert.ok(widget.includes("¿Te armo una aproximación?"));
assert.ok(widget.includes("Te asesoro acá — ficha, carrito o PDF"));
assert.ok(widget.includes("Lista web, sin flete. ¿Hablamos?"));

assert.match(
  widget,
  /#bmc-paneli-voice\{[^}]*right:92px/,
  "desktop orb sits left of the WhatsApp FAB",
);
assert.match(
  widget,
  /@media\(max-width:640px\)\{#bmc-paneli-voice\{[^}]*bottom:calc\(88px/,
  "mobile orb sits above the WhatsApp FAB",
);
assert.ok(
  !/whatsapp|wa\.me|59892663245/i.test(widget.slice(widget.indexOf("function asoma()"), widget.indexOf("function asoma()") + 800)),
  "asoma() does not open or cover WhatsApp",
);

assert.match(widget, /function dismissNudge\(\)/, "explicit dismiss");
assert.match(widget, /root\.classList\.add\("nudge-off"\)/, "dismiss docks the chip");
assert.match(widget, /root\.classList\.contains\("open"\)/, "open chat never asomas");

console.log("storefrontPeekNudge: ok");
