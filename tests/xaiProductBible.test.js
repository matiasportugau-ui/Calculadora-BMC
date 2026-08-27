/**
 * Tests for scripts/xai-product-bible.mjs
 * Drives exported planners/builders (no live xAI).
 * Run: node tests/xaiProductBible.test.js
 */

import path from "node:path";
import { Writable } from "node:stream";
import {
  COLLECTION_NAME,
  BIBLE_FILENAMES,
  DEFAULT_SEARCH_QUERY,
  MANAGEMENT_API_HOST,
  SEARCH_API_HOST,
  MANAGEMENT_API_ORIGIN,
  SEARCH_API_ORIGIN,
  MISSING_MANAGEMENT_KEY_MESSAGE,
  buildUploadPlan,
  formatDryPlan,
  parseArgs,
  requireManagementKey,
  buildCreateCollectionRequest,
  buildSearchRequest,
  buildListCollectionsRequest,
  buildAddDocumentRequest,
  buildFileUploadUrl,
  isForbiddenUploadPath,
  searchHitCount,
  main,
} from "../scripts/xai-product-bible.mjs";

let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}
function group(name, fn) { console.log(`\n— ${name}`); fn(); }

group("buildUploadPlan — collection, files, query, hosts", () => {
  const plan = buildUploadPlan();
  assert(plan.collectionName === "bmc-product-bible", "collection name exact");
  assert(plan.collectionName === COLLECTION_NAME, "COLLECTION_NAME export matches");
  const names = plan.files.map((f) => f.name);
  assert(names.includes("LINES.md"), "includes LINES.md");
  assert(names.includes("SELL-RULES.md"), "includes SELL-RULES.md");
  assert(plan.files.length === 2, "default upload set is exactly two bible files");
  assert(plan.files.every((f) => f.path.endsWith("LINES.md") || f.path.endsWith("SELL-RULES.md")), "source paths end in bible filenames");
  assert(plan.files.some((f) => f.path.endsWith(`${path.sep}LINES.md`) || f.path.endsWith("LINES.md")), "LINES.md path suffix");
  assert(plan.searchQuery.includes("ISOFRIG"), "query includes ISOFRIG");
  assert(plan.searchQuery.includes("ISODEC"), "query includes ISODEC");
  assert(DEFAULT_SEARCH_QUERY.includes("techo"), "default query is about techo");
  assert(plan.hosts.management === "management-api.x.ai", "management host");
  assert(plan.hosts.search === "api.x.ai", "search host");
  assert(new URL(plan.urls.management).host === "management-api.x.ai", "management URL host");
  assert(new URL(plan.urls.search).host === "api.x.ai", "search URL host");
  assert(!names.includes("constants.js"), "does not upload constants.js");
  assert(BIBLE_FILENAMES.length === 2, "BIBLE_FILENAMES is two files");
});

group("formatDryPlan — printable dry payload", () => {
  const text = formatDryPlan(buildUploadPlan());
  assert(text.includes("bmc-product-bible"), "dry plan names collection");
  assert(text.includes("LINES.md"), "dry plan names LINES.md");
  assert(text.includes("SELL-RULES.md"), "dry plan names SELL-RULES.md");
  assert(text.includes("ISOFRIG") && text.includes("ISODEC"), "dry plan has search query");
  assert(text.includes("management-api.x.ai"), "dry plan management host");
  assert(text.includes("api.x.ai"), "dry plan search host");
});

group("URL builders — two hosts", () => {
  const create = buildCreateCollectionRequest();
  assert(create.host === MANAGEMENT_API_HOST, "create host management");
  assert(new URL(create.url).host === "management-api.x.ai", "create URL host");
  assert(create.body.collection_name === "bmc-product-bible", "create body name");
  const list = buildListCollectionsRequest();
  assert(new URL(list.url).host === "management-api.x.ai", "list URL host");
  const add = buildAddDocumentRequest("collection_abc", "file_xyz", { title: "LINES.md" });
  assert(new URL(add.url).host === "management-api.x.ai", "add document host");
  const search = buildSearchRequest("collection_abc");
  assert(search.host === SEARCH_API_HOST, "search host");
  assert(new URL(search.url).host === "api.x.ai", "search URL host");
  assert(search.body.retrieval_mode.type === "hybrid", "hybrid retrieval");
  assert(search.body.query.includes("ISOFRIG") && search.body.query.includes("ISODEC"), "search query products");
  assert(new URL(buildFileUploadUrl()).host === "api.x.ai", "file upload host is api.x.ai");
  assert(MANAGEMENT_API_ORIGIN.includes("management-api.x.ai"), "management origin");
  assert(SEARCH_API_ORIGIN.includes("api.x.ai"), "search origin");
});

group("parseArgs --dry", () => {
  assert(parseArgs(["--dry"]).dry === true, "--dry");
  assert(parseArgs(["--dry-run"]).dry === true, "--dry-run");
  assert(parseArgs([]).dry === false, "default not dry");
});

group("requireManagementKey — missing / empty / whitespace", () => {
  let threw = false;
  try { requireManagementKey({}); } catch (e) {
    threw = true;
    assert(e.message.includes("Management Key") || e.message.includes("AddFileToCollection"), "message names Management Key or AddFileToCollection");
    assert(e.message.includes("AddFileToCollection"), "message names AddFileToCollection");
    assert(!/Bearer\s+\S+/.test(e.message), "does not print a Bearer token");
  }
  assert(threw, "throws when key absent");
  threw = false;
  try { requireManagementKey({ XAI_MANAGEMENT_API_KEY: "   " }); } catch (e) {
    threw = true;
    assert(e.message === MISSING_MANAGEMENT_KEY_MESSAGE, "whitespace treated as missing");
  }
  assert(threw, "throws when key whitespace");
  assert(requireManagementKey({ XAI_MANAGEMENT_API_KEY: "mgk_test" }) === "mgk_test", "returns trimmed key");
});

group("forbidden uploads", () => {
  assert(isForbiddenUploadPath("/x/constants.js") === true, "constants.js forbidden");
  assert(isForbiddenUploadPath("/x/LINES.md") === false, "LINES.md allowed");
});

group("searchHitCount", () => {
  assert(searchHitCount({ documents: [{ id: 1 }] }) === 1, "documents array");
  assert(searchHitCount({ citations: ["a", "b"] }) === 2, "citations array");
  assert(searchHitCount({}) === 0, "empty payload");
});

console.log("\n— main --dry and missing key (real entry)");
{
  const chunks = [];
  const stdout = new Writable({
    write(c, _e, cb) { chunks.push(String(c)); cb(); },
  });
  const code = await main(["--dry"], { stdout, stderr: stdout, env: {} });
  const text = chunks.join("");
  assert(code === 0, "main --dry exits 0");
  assert(text.includes("bmc-product-bible"), "main --dry prints collection");
  assert(text.includes("LINES.md") && text.includes("SELL-RULES.md"), "main --dry prints files");
  assert(text.includes("ISOFRIG") && text.includes("ISODEC"), "main --dry prints query");
  assert(text.includes("management-api.x.ai") && text.includes("api.x.ai"), "main --dry prints hosts");

  const errChunks = [];
  const stderr = new Writable({
    write(c, _e, cb) { errChunks.push(String(c)); cb(); },
  });
  const liveCode = await main([], {
    stdout: new Writable({ write(_c, _e, cb) { cb(); } }),
    stderr,
    env: { XAI_MANAGEMENT_API_KEY: "" },
  });
  const errText = errChunks.join("");
  assert(liveCode !== 0, "main live without Management Key exits non-zero");
  assert(errText.includes("AddFileToCollection"), "missing-key stderr names AddFileToCollection");
  assert(!/Bearer\s+\S+/.test(errText), "missing-key stderr has no Bearer token");
}

console.log(`\n${failed === 0 ? "✓" : "✗"} xaiProductBible: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
