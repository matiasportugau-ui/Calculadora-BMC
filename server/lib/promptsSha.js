/**
 * IMP-13 — content hash of chat prompt modules for boot / capabilities.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

const PROMPT_FILES = ["chatPrompts.js", "channelRenderer.js"];

/**
 * @returns {{ prompts_sha: string, files: string[], bytes: number }}
 */
export function computePromptsSha() {
  const h = createHash("sha256");
  let bytes = 0;
  const files = [];
  for (const name of PROMPT_FILES) {
    try {
      const p = join(__dir, name);
      const buf = readFileSync(p);
      h.update(name);
      h.update("\0");
      h.update(buf);
      bytes += buf.length;
      files.push(name);
    } catch {
      /* optional missing */
    }
  }
  return {
    prompts_sha: h.digest("hex").slice(0, 16),
    files,
    bytes,
  };
}

let _cached = null;
export function getPromptsShaCached() {
  if (!_cached) _cached = computePromptsSha();
  return _cached;
}
