// TraKtiMe detach (floating timer) — offline logic smoke.
// Verifies detach.js without a browser: flag detection, the popup fallback,
// and that the Document Picture-in-Picture path is preferred when available.
// The actual always-on-top rendering is browser-only (verified manually).
//
// Run: node tests/traktime-detach.test.js

import { isDetachedTimerWindow, openFloatingTimer } from "../src/components/traktime/Timer/detach.js";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); failed++; }
}

async function main() {
  console.log("\n═══ TraKtiMe · detach (offline) ═══");

  // 1. Flag detection
  globalThis.window = { location: { search: "?tkDetached=1", href: "https://app/hub/traktime?x=1" } };
  assert("isDetachedTimerWindow true with ?tkDetached=1", isDetachedTimerWindow() === true);
  globalThis.window.location.search = "?foo=2";
  assert("isDetachedTimerWindow false otherwise", isDetachedTimerWindow() === false);

  // 2. Popup fallback when Document PiP is unavailable
  let opened = null;
  globalThis.window = {
    location: { href: "https://app/hub/traktime", search: "" },
    open: (url, name, feat) => { opened = { url, name, feat }; return { closed: false }; },
  };
  const r = await openFloatingTimer({ width: 360, height: 240 });
  assert("fallback returns documentPiP=false", r && r.documentPiP === false, JSON.stringify(r));
  assert("fallback opens window named traktime-timer", opened?.name === "traktime-timer", opened?.name);
  assert("fallback url carries ?tkDetached=1", /[?&]tkDetached=1/.test(opened?.url || ""), opened?.url);
  assert(
    "fallback features include popup+resizable",
    /popup=yes/.test(opened?.feat) && /resizable=yes/.test(opened?.feat),
    opened?.feat,
  );

  // 3. Document PiP path preferred when supported
  let pipReq = null;
  globalThis.window = {
    location: { href: "https://app/hub/traktime", search: "" },
    documentPictureInPicture: {
      requestWindow: async (o) => {
        pipReq = o;
        return {
          document: { head: { appendChild() {} }, body: { style: {} }, createElement: () => ({}) },
          addEventListener() {},
        };
      },
    },
  };
  globalThis.document = { styleSheets: [] };
  const r2 = await openFloatingTimer({ width: 360, height: 240 });
  assert("PiP path returns documentPiP=true", r2 && r2.documentPiP === true, JSON.stringify(r2));
  assert("PiP requestWindow called with size", pipReq && pipReq.width === 360 && pipReq.height === 240, JSON.stringify(pipReq));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
