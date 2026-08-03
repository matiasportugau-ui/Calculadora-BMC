// Offline unit tests for BmcChatPanel chat health-probe helpers.
// Proves the shipped probe never attaches Authorization (CORS fix).
// Run: node tests/bmcChatHealthProbe.test.js
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".runtime", "test-cache");
const outFile = join(outDir, "bmcChatHealthProbe.bundle.mjs");

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  stdin: {
    contents: `export { buildChatHealthProbe, buildChatAuthPostMessage } from ${JSON.stringify(
      join(root, "src/components/BmcChatPanel.jsx"),
    )};`,
    resolveDir: root,
    sourcefile: "bmcChatHealthProbe.entry.js",
    loader: "js",
  },
  bundle: true,
  write: true,
  outfile: outFile,
  format: "esm",
  platform: "neutral",
  jsx: "automatic",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "react-router-dom",
  ],
});

const {
  buildChatHealthProbe,
  buildChatAuthPostMessage,
} = await import(pathToFileURL(outFile).href);

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    console.error(`  ❌ ${name}\n     ${err.message}`);
  }
}

console.log("bmcChatHealthProbe — CORS-safe health probe");

t("buildChatHealthProbe points at /api/inquiries under chatBase", () => {
  const { url } = buildChatHealthProbe("https://bmc-chat.example.com");
  assert.equal(url, "https://bmc-chat.example.com/api/inquiries");
});

t("buildChatHealthProbe strips trailing slash on chatBase", () => {
  const { url } = buildChatHealthProbe("https://bmc-chat.example.com/");
  assert.equal(url, "https://bmc-chat.example.com/api/inquiries");
});

t("buildChatHealthProbe init has no headers / no Authorization", () => {
  const { init } = buildChatHealthProbe("https://bmc-chat.example.com", {
    timeoutMs: 1500,
  });
  assert.ok(init, "init present");
  assert.equal(
    init.headers,
    undefined,
    "must not set headers (would invite Authorization)",
  );
  const keys = Object.keys(init);
  assert.ok(!keys.some((k) => k.toLowerCase() === "headers"));
  // Even if a caller later spreads a token, the factory must not accept one for auth.
  assert.equal(buildChatHealthProbe.length, 1, "only chatBase is required (opts optional)");
});

t("buildChatHealthProbe ignores accessToken-like second-arg misuse for auth", () => {
  // If someone passes a token as opts by mistake, still no Authorization header.
  const { init } = buildChatHealthProbe("https://bmc-chat.example.com", {
    Authorization: "Bearer leaked",
    accessToken: "leaked",
    headers: { Authorization: "Bearer leaked" },
    timeoutMs: 500,
  });
  assert.equal(init.headers, undefined);
  assert.ok(!("Authorization" in init));
  assert.ok(!("accessToken" in init));
});

t("buildChatHealthProbe provides AbortSignal timeout", () => {
  const { init } = buildChatHealthProbe("https://x", { timeoutMs: 500 });
  assert.ok(init.signal, "signal required for probe timeout");
  assert.equal(typeof init.signal.aborted, "boolean");
});

t("buildChatAuthPostMessage keeps bmc-chat-auth postMessage contract", () => {
  const msg = buildChatAuthPostMessage("jwt-abc");
  assert.deepEqual(msg, { type: "bmc-chat-auth", token: "jwt-abc" });
});

t("health probe URL is not the postMessage path (auth stays on iframe channel)", () => {
  const { url } = buildChatHealthProbe("https://bmc-chat.example.com");
  const auth = buildChatAuthPostMessage("t");
  assert.match(url, /\/api\/inquiries$/);
  assert.equal(auth.type, "bmc-chat-auth");
  assert.notEqual(url, auth.type);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
