// ═══════════════════════════════════════════════════════════════════════════
// tests/skills-routes.test.js — integration tests for /api/skills
// ───────────────────────────────────────────────────────────────────────────
// Spins up Express with the real router (server/routes/skills.js) over a
// hermetic fixture skill tree injected via skillsCatalog.__test__.setRoots.
//   - auth gate (401 without token, 200 with static API_AUTH_TOKEN)
//   - list: shape, ?q= search, ?source= filter, invalid source → 400
//   - detail: body present, unknown → 404, traversal-ish id → 400
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

// Must be set BEFORE importing the router (config reads it at import time).
const TOKEN = "test-skills-token-xxxxxxxxxxxxxxxx";
process.env.API_AUTH_TOKEN = TOKEN;
process.env.APP_ENV = "test";

const skillsCatalog = await import("../server/lib/skillsCatalog.js");
const skillsRouter = (await import("../server/routes/skills.js")).default;

// ─── Fixture tree ──────────────────────────────────────────────────────────
let tmpRoot;

function writeSkill(root, id, frontmatter, body = "# Body\n\nhello\n") {
  const dir = path.join(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n${body}`);
}

let server, port;

before(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bmc-skills-"));
  const cursorDir = path.join(tmpRoot, ".cursor", "skills");
  const claudeDir = path.join(tmpRoot, ".claude", "skills");

  writeSkill(cursorDir, "alpha-tool", "name: alpha-tool\ndescription: >\n  Does the alpha thing for pricing.");
  writeSkill(cursorDir, "beta-tool", "name: beta-tool\ndescription: Beta helper for **security** review.");
  // Same id in a second root → should appear once, with claude in alsoIn.
  writeSkill(cursorDir, "shared", "name: shared\ndescription: shared skill.");
  writeSkill(claudeDir, "shared", "name: shared\ndescription: shared skill (claude copy).");
  writeSkill(claudeDir, "claude-only", "name: claude-only\ndescription: only in claude root.");

  skillsCatalog.__test__.setRoots(
    [
      { source: "cursor", dir: cursorDir },
      { source: "claude", dir: claudeDir },
    ],
    tmpRoot,
  );

  const app = express();
  app.use(express.json());
  app.use(skillsRouter);
  await new Promise((resolve) => {
    server = app.listen(0, () => { port = server.address().port; resolve(); });
  });
});

after(async () => {
  skillsCatalog.__test__.reset();
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
});

function url(p) { return `http://127.0.0.1:${port}${p}`; }
const authed = { headers: { Authorization: `Bearer ${TOKEN}` } };

describe("GET /api/skills — auth", () => {
  it("401 without a token", async () => {
    const r = await fetch(url("/api/skills"));
    assert.equal(r.status, 401);
  });

  it("200 with static API_AUTH_TOKEN", async () => {
    const r = await fetch(url("/api/skills"), authed);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(typeof j.count, "number");
    assert.ok(Array.isArray(j.skills));
  });
});

describe("GET /api/skills — listing", () => {
  it("dedupes by id and records alsoIn; entries carry no body", async () => {
    const j = await (await fetch(url("/api/skills"), authed)).json();
    // alpha, beta, shared, claude-only = 4 unique ids
    assert.equal(j.count, 4);
    const ids = j.skills.map((s) => s.id).sort();
    assert.deepEqual(ids, ["alpha-tool", "beta-tool", "claude-only", "shared"]);
    const shared = j.skills.find((s) => s.id === "shared");
    assert.equal(shared.source, "cursor");
    assert.deepEqual(shared.alsoIn, ["claude"]);
    // description cleaned (markdown emphasis stripped)
    const beta = j.skills.find((s) => s.id === "beta-tool");
    assert.ok(!beta.description.includes("**"));
    assert.ok(!("body" in beta));
  });

  it("?q= filters by substring over id/name/description", async () => {
    const j = await (await fetch(url("/api/skills?q=alpha"), authed)).json();
    assert.equal(j.count, 1);
    assert.equal(j.skills[0].id, "alpha-tool");
  });

  it("?source=claude keeps skills present in the claude root", async () => {
    const j = await (await fetch(url("/api/skills?source=claude"), authed)).json();
    const ids = j.skills.map((s) => s.id).sort();
    // shared (alsoIn claude) + claude-only
    assert.deepEqual(ids, ["claude-only", "shared"]);
  });

  it("invalid ?source= → 400", async () => {
    const r = await fetch(url("/api/skills?source=bogus"), authed);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "invalid_source");
  });
});

describe("GET /api/skills/:id — detail", () => {
  it("returns metadata + markdown body", async () => {
    const r = await fetch(url("/api/skills/alpha-tool"), authed);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.skill.id, "alpha-tool");
    assert.equal(j.skill.frontmatter.name, "alpha-tool");
    assert.ok(j.skill.body.includes("hello"));
    assert.ok(!j.skill.body.startsWith("---"));
  });

  it("401 without a token", async () => {
    const r = await fetch(url("/api/skills/alpha-tool"));
    assert.equal(r.status, 401);
  });

  it("unknown id → 404", async () => {
    const r = await fetch(url("/api/skills/does-not-exist"), authed);
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error, "skill_not_found");
  });

  it("path-traversal-ish id → 400 (never touches the filesystem)", async () => {
    const r = await fetch(url("/api/skills/..%2f..%2fpackage.json"), authed);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "invalid_skill_id");
  });
});
