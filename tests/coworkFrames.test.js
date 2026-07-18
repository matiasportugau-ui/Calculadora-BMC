/**
 * Unit tests — Panelin Co-Work frame validation & adapters.
 * Run: node tests/coworkFrames.test.js
 */
import {
  normalizeAttachments,
  normalizeBase64,
  approxDecodedBytes,
  toClaudeContent,
  toGeminiParts,
  buildMultimodalMessages,
  formatOperatorContextBlock,
  COWORK_ALLOWED_MIME,
} from "../server/lib/coworkFrames.js";
import { resolveWorkbook, proposeWrite, sheetsAllowlist } from "../server/lib/coworkSheets.js";

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}
function group(name, fn) {
  console.log(`\n— ${name}`);
  fn();
}

// Must be long enough to pass min length check in normalizeAttachments
const TINY_B64 = Buffer.from("hello-cowork-panelin-frame-buffer-xx".repeat(4)).toString("base64");

group("normalizeBase64", () => {
  assert(normalizeBase64(`data:image/jpeg;base64,${TINY_B64}`) === TINY_B64, "strips data-URL");
  assert(approxDecodedBytes(TINY_B64) > 8, "approxDecodedBytes > 8");
});

group("normalizeAttachments", () => {
  const ok = normalizeAttachments([{ mime: "image/jpeg", data: TINY_B64, source: "oneshot" }]);
  assert(ok.ok === true, "ok true");
  assert(ok.attachments.length === 1, "1 attachment");
  assert(ok.attachments[0].mime === "image/jpeg", "mime jpeg");
  assert(COWORK_ALLOWED_MIME.has("image/png"), "png allowed");

  const bad = normalizeAttachments([
    { mime: "application/pdf", data: TINY_B64 },
    { mime: "image/png", data: "" },
  ]);
  assert(bad.attachments.length === 0, "drops bad");
  assert(bad.dropped.length >= 2, "dropped >= 2");

  const many = Array.from({ length: 6 }, () => ({ mime: "image/jpeg", data: TINY_B64 }));
  const capped = normalizeAttachments(many);
  assert(capped.attachments.length <= 4, "max attachments cap");
  assert(capped.dropped.some((d) => d.reason === "max_attachments"), "max_attachments reason");
});

group("provider adapters", () => {
  const blocks = toClaudeContent("hola", [{ mime: "image/jpeg", data: TINY_B64 }]);
  assert(blocks.some((b) => b.type === "image"), "claude image block");
  assert(blocks.some((b) => b.type === "text" && b.text.includes("hola")), "claude text");

  const parts = toGeminiParts("x", [{ mime: "image/png", data: TINY_B64 }]);
  assert(parts.some((p) => p.inlineData), "gemini inlineData");
});

group("buildMultimodalMessages", () => {
  const { messages, framesAccepted, hasVision } = buildMultimodalMessages(
    [
      { role: "user", content: "hi", attachments: [{ mime: "image/jpeg", data: TINY_B64 }] },
      { role: "assistant", content: "ok" },
      { role: "user", content: "now", attachments: [{ mime: "image/jpeg", data: TINY_B64 }] },
    ],
    "claude",
  );
  assert(hasVision === true, "hasVision");
  assert(framesAccepted === 1, "framesAccepted 1");
  const last = messages[messages.length - 1];
  assert(Array.isArray(last.content), "last content is blocks array");
  assert(typeof messages[0].content === "string", "first user is text-only");
});

group("operator context + sheets allowlist", () => {
  const block = formatOperatorContextBlock({ surface: "admin_ingreso", selectedRow: 14, liveAssist: true });
  assert(block.includes("14"), "row 14");
  assert(block.includes("Live assist"), "live assist line");

  const r = resolveWorkbook("not-a-real-id-xyz");
  if (Object.keys(sheetsAllowlist()).length === 0) {
    assert(r.ok === false, "unknown rejected when empty allowlist");
    assert(r.error === "spreadsheet_not_allowlisted", "error code");
  } else {
    assert(true, "allowlist has entries — skip empty-allowlist case");
  }

  const pw = proposeWrite({ workbook: "admin", range: "A1", values: [] });
  assert(pw.ok === false, "proposeWrite empty values fails");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
