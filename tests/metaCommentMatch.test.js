import assert from "node:assert/strict";
import {
  authorMatches,
  hideRequest,
  knownAuthorIds,
  mergeLedger,
  normalizeName,
  readLedger,
  truncationReport,
  writeLedger,
} from "../scripts/lib/metaCommentMatch.mjs";

const needle = "Fernando Guglielmelly";

assert.equal(normalizeName("  Fernándo   GUGLIELMELLY "), "fernando guglielmelly");

for (const name of ["FERNANDO GUGLIELMELLY", "Fernando Guglielmelly", "Fernándo  Guglielmelly"]) {
  assert.equal(authorMatches({ id: "9", name }, needle), true, name);
}

assert.equal(authorMatches({ id: "1", name: "Otra Persona" }, needle), false);

const previous = [{
  commentId: "c1",
  authorId: "9",
  authorName: "Fernando Guglielmelly",
  message: "primero",
  isHidden: false,
  postId: "p1",
  postPermalink: "https://example.test/p1",
  commentPermalink: "https://example.test/c1",
  firstSeenAt: "2026-10-01T00:00:00.000Z",
  lastSeenAt: "2026-10-01T00:00:00.000Z",
  hideStatus: "dry_run",
  blockStatus: "not_requested",
}];

const known = knownAuthorIds(previous);
assert.equal(authorMatches({ id: "9", name: "Nombre Nuevo" }, needle, known), true);
assert.equal(authorMatches({ id: "2", name: "Nombre Nuevo" }, needle, known), false);

const secondScan = [{
  commentId: "c2",
  authorId: "9",
  authorName: "FERNANDO GUGLIELMELLY",
  message: "segundo",
  isHidden: false,
  postId: "p2",
  hideStatus: "dry_run",
  blockStatus: "not_requested",
}];

const merged = mergeLedger(previous, secondScan, "2026-10-03T00:00:00.000Z");
const byId = new Map(merged.map((row) => [row.commentId, row]));
assert.equal(byId.size, 2);
assert.equal(byId.get("c1").message, "primero");
assert.equal(byId.get("c1").lastSeenAt, "2026-10-01T00:00:00.000Z");
assert.equal(byId.get("c2").firstSeenAt, "2026-10-03T00:00:00.000Z");

const roundTrip = readLedger(writeLedger(merged));
assert.equal(roundTrip.length, 2);
assert.equal(roundTrip[0].commentId, "c1");

const hide = hideRequest("c2");
assert.equal(hide.method, "POST");
assert.notEqual(hide.method, "DELETE");
assert.equal(hide.params.is_hidden, "true");
assert.equal(hide.path, "/c2");

assert.deepEqual(
  truncationReport({ scannedCount: 100, totalCount: 140, hasNext: false }),
  { truncated: true, scannedCount: 100, totalCount: 140 },
);
assert.equal(truncationReport({ scannedCount: 3, totalCount: null, hasNext: false }).truncated, false);

console.log("metaCommentMatch OK");
