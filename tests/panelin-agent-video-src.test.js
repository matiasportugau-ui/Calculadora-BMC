import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PANELIN_AGENT_VIDEO_SRC } from "../src/utils/panelinAgentVideoSrc.js";

test("default deploy uses the shared Panelin loop, not LAM", () => {
  assert.match(PANELIN_AGENT_VIDEO_SRC, /panelin-lista-loop\.mp4$/);
  assert.doesNotMatch(PANELIN_AGENT_VIDEO_SRC, /panelin-lam/);
});

function probe(slug) {
  const r = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `
      process.env.VITE_WHITELABEL = ${JSON.stringify(slug)};
      process.env.WHITELABEL = ${JSON.stringify(slug)};
      const m = await import("./src/utils/panelinAgentVideoSrc.js");
      process.stdout.write(JSON.stringify({ src: m.PANELIN_AGENT_VIDEO_SRC, poster: m.PANELIN_AGENT_POSTER_SRC }));
    `],
    { cwd: new URL("..", import.meta.url).pathname.replace(/tests\/$/, ""), encoding: "utf8" },
  );
  const line = (r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
  assert.ok(line, r.stderr || r.stdout);
  return JSON.parse(line);
}

test("WHITELABEL=bc uses the BC polo portrait", () => {
  const j = probe("bc");
  assert.match(j.src, /panelin-bc-loop\.mp4$/);
  assert.match(j.poster, /panelin-bc-poster\.jpg$/);
});

test("WHITELABEL=paneleslam uses the LAM portrait, not BC", () => {
  const j = probe("paneleslam");
  assert.match(j.src, /panelin-lam-loop\.mp4$/);
  assert.doesNotMatch(j.src, /panelin-bc/);
});

test("WHITELABEL=smartbuilding uses its own loop, not BC/LAM/BMC", () => {
  const j = probe("smartbuilding");
  assert.match(j.src, /panelin-smartbuilding-loop\.mp4$/);
  assert.match(j.poster, /panelin-smartbuilding-poster\.jpg$/);
  assert.doesNotMatch(j.src, /panelin-bc|panelin-lam|panelin-lista/);
});
