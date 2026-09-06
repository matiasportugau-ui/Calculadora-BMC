/**
 * Shared IAlfred/Panelin brain ranking + local hydrate.
 * Run: node tests/brainKBRank.test.js
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  rankLessons,
  brainBlock,
  brainStatus,
  tryHydrateBrainFromLocalFiles,
  __setBrainCacheForTests,
} from "../server/lib/brainKB.js";

const lessons = [
  {
    id: "install-isodec",
    status: "active",
    confidence: 0.95,
    trigger: "cómo se instala isodec",
    rule: "IsoDec install: acopio → U en platea → muros.",
  },
  {
    id: "flete-zona",
    status: "active",
    confidence: 0.7,
    trigger: "flete montevideo",
    rule: "Flete MVD se cotiza aparte.",
  },
  {
    id: "retired-noise",
    status: "retired",
    confidence: 0.99,
    trigger: "isodec install",
    rule: "Retired must never inject.",
  },
  {
    id: "draft-skip",
    status: "draft",
    confidence: 0.99,
    trigger: "isodec",
    rule: "Draft must never inject.",
  },
  null,
];

{
  const ranked = rankLessons(lessons, "cómo se instala isodec", 5);
  assert.equal(ranked.length, 2, "retired/draft/null stay out");
  assert.equal(ranked[0].l.id, "install-isodec");
  assert.ok(!ranked.some(({ l }) => l.id === "retired-noise" || l.id === "draft-skip"));
  console.log("  ✓ rankLessons drops retired/draft/null");
}

{
  const byConf = rankLessons(lessons, "", 2);
  assert.equal(byConf.length, 2);
  assert.equal(byConf[0].l.id, "install-isodec", "empty query ranks by confidence");
  assert.equal(byConf[1].l.id, "flete-zona");
  const capped = rankLessons(lessons, "", 1);
  assert.equal(capped.length, 1);
  assert.equal(capped[0].l.id, "install-isodec");
  console.log("  ✓ empty query + cap use confidence");
}

{
  const n0 = rankLessons(lessons, "", 0);
  const nan = rankLessons(lessons, "", Number.NaN);
  assert.ok(n0.length >= 1, "n=0 falls through to inject cap (current, not a fix)");
  assert.ok(nan.length >= 1, "NaN n falls through to inject cap");
  console.log("  ✓ n=0 / NaN keep inject-cap fallback");
}

{
  __setBrainCacheForTests(lessons, "test");
  const block = brainBlock("cómo se instala isodec", 3);
  assert.ok(block.includes("CONOCIMIENTO ACUMULADO"));
  assert.ok(block.includes("IsoDec install: acopio"));
  assert.ok(!block.includes("Retired must never inject"));
  assert.ok(!block.includes("Draft must never inject"));
  __setBrainCacheForTests([], "none");
  assert.equal(brainBlock("isodec"), "");
  const st = brainStatus();
  assert.equal(st.total, 0);
  assert.equal(st.active, 0);
  console.log("  ✓ brainBlock injects active rules only; empty cache is fail-soft");
}

{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bmc-brain-"));
  const bad = path.join(dir, "bad.json");
  const emptyArr = path.join(dir, "empty.json");
  const wrapped = path.join(dir, "lessons.json");
  fs.writeFileSync(bad, "{not json");
  fs.writeFileSync(emptyArr, "[]");
  fs.writeFileSync(
    wrapped,
    JSON.stringify({
      lessons: [
        {
          id: "local-wrap",
          status: "active",
          confidence: 0.9,
          trigger: "isoroof",
          rule: "Local wrapped lessons hydrate.",
        },
      ],
    }),
  );

  __setBrainCacheForTests([], "none");
  const miss = tryHydrateBrainFromLocalFiles([path.join(dir, "missing.json"), bad, emptyArr]);
  assert.equal(miss.ok, false);
  assert.equal(miss.count, 0);

  const ok = tryHydrateBrainFromLocalFiles([bad, emptyArr, wrapped]);
  assert.equal(ok.ok, true);
  assert.equal(ok.source, "local");
  assert.equal(ok.count, 1);
  assert.ok(brainBlock("isoroof").includes("Local wrapped lessons hydrate"));

  const warm = tryHydrateBrainFromLocalFiles([
    path.join(dir, "other.json"),
  ]);
  assert.equal(warm.ok, true);
  assert.equal(warm.count, 1, "warm cache is not replaced");
  assert.ok(brainBlock("isoroof").includes("Local wrapped lessons hydrate"));

  __setBrainCacheForTests([], "none");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("  ✓ hydrate skips bad/empty, accepts {lessons}, keeps warm cache");
}

console.log("brainKBRank.test.js: ok");
