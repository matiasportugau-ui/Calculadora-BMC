#!/usr/bin/env node
/**
 * xai-product-bible.mjs — ensure xAI collection `bmc-product-bible`,
 * upload LINES.md + SELL-RULES.md, wait until searchable, hybrid-search
 * ISOFRIG vs ISODEC for techo.
 *
 * Usage:
 *   node scripts/xai-product-bible.mjs --dry
 *   node scripts/xai-product-bible.mjs
 *
 * Env (live only):
 *   XAI_MANAGEMENT_API_KEY  Management Key with AddFileToCollection
 *   XAI_API_KEY or GROK_API_KEY   for Files upload + documents/search
 *   BMC_PRODUCT_BIBLE_DIR   override bible directory
 *
 * --dry prints the plan and does not call xAI.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COLLECTION_NAME = "bmc-product-bible";
export const BIBLE_FILENAMES = Object.freeze(["LINES.md", "SELL-RULES.md"]);
export const DEFAULT_SEARCH_QUERY =
  "¿Cuándo recomendar ISOFRIG vs ISODEC EPS 100 para techo?";
export const MANAGEMENT_API_HOST = "management-api.x.ai";
export const SEARCH_API_HOST = "api.x.ai";
export const MANAGEMENT_API_ORIGIN = `https://${MANAGEMENT_API_HOST}`;
export const SEARCH_API_ORIGIN = `https://${SEARCH_API_HOST}`;
export const DOCUMENT_STATUS_PROCESSED = "DOCUMENT_STATUS_PROCESSED";
export const DOCUMENT_STATUS_FAILED = "DOCUMENT_STATUS_FAILED";

export const MISSING_MANAGEMENT_KEY_MESSAGE =
  "Missing Management Key (XAI_MANAGEMENT_API_KEY). Create one in xAI Console → Management Keys with permission AddFileToCollection (Collections Endpoint group). Do not use the chat API key.";

export const MISSING_API_KEY_MESSAGE =
  "Missing XAI_API_KEY or GROK_API_KEY (needed for file upload on api.x.ai and documents/search).";

const FORBIDDEN_BASENAME_RE = /^(constants\.js|ledger\.csv)$/i;

export function defaultBibleDir() {
  return path.join(
    os.homedir(),
    "Projects",
    "personal-agent",
    "docs",
    "kb",
    "bmc-product",
  );
}

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    dry: false,
    help: false,
    bibleDir: null,
    searchQuery: null,
    collectionName: null,
  };
  for (const a of argv) {
    if (a === "--dry" || a === "--dry-run") out.dry = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else if (a.startsWith("--bible-dir=")) out.bibleDir = a.slice("--bible-dir=".length);
    else if (a.startsWith("--query=")) out.searchQuery = a.slice("--query=".length);
    else if (a.startsWith("--collection=")) out.collectionName = a.slice("--collection=".length);
  }
  return out;
}

export function readManagementKey(env = process.env) {
  return String(env.XAI_MANAGEMENT_API_KEY ?? "").trim();
}

export function readApiKey(env = process.env) {
  return String(env.XAI_API_KEY || env.GROK_API_KEY || "").trim();
}

export function requireManagementKey(env = process.env) {
  const key = readManagementKey(env);
  if (!key) {
    const err = new Error(MISSING_MANAGEMENT_KEY_MESSAGE);
    err.code = "MISSING_MANAGEMENT_KEY";
    err.exitCode = 2;
    throw err;
  }
  return key;
}

export function isForbiddenUploadPath(filePath) {
  const base = path.basename(filePath);
  return FORBIDDEN_BASENAME_RE.test(base);
}

export function buildUploadPlan(opts = {}) {
  const bibleDir = opts.bibleDir || defaultBibleDir();
  const collectionName = opts.collectionName || COLLECTION_NAME;
  const searchQuery = opts.searchQuery || DEFAULT_SEARCH_QUERY;
  const files = BIBLE_FILENAMES.map((name) => {
    const filePath = path.join(bibleDir, name);
    if (isForbiddenUploadPath(filePath)) {
      throw new Error(`Refusing forbidden upload path: ${filePath}`);
    }
    return {
      name,
      path: filePath,
      docType: name === "SELL-RULES.md" ? "regla" : "bible",
    };
  });
  return {
    collectionName,
    files,
    searchQuery,
    hosts: {
      management: MANAGEMENT_API_HOST,
      search: SEARCH_API_HOST,
    },
    urls: {
      management: MANAGEMENT_API_ORIGIN,
      search: SEARCH_API_ORIGIN,
      collections: `${MANAGEMENT_API_ORIGIN}/v1/collections`,
      files: `${SEARCH_API_ORIGIN}/v1/files`,
      documentsSearch: `${SEARCH_API_ORIGIN}/v1/documents/search`,
    },
  };
}

export function formatDryPlan(plan) {
  const fileLines = plan.files.map((f) => `  - ${f.name}  ${f.path}`).join("\n");
  return [
    `collection: ${plan.collectionName}`,
    `files: ${plan.files.map((f) => f.name).join(", ")}`,
    fileLines,
    `search_query: ${plan.searchQuery}`,
    `management host: ${plan.hosts.management} (${plan.urls.management}) — collection + add document`,
    `search host: ${plan.hosts.search} (${plan.urls.search}) — file upload + documents/search`,
    `collections URL: ${plan.urls.collections}`,
    `files URL: ${plan.urls.files}`,
    `search URL: ${plan.urls.documentsSearch}`,
    "live needs Management Key with AddFileToCollection; search uses XAI_API_KEY / GROK_API_KEY",
    "excluded: constants.js, ledger, BROU statements, WA/Admin PII",
  ].join("\n");
}

export function buildListCollectionsRequest(collectionName = COLLECTION_NAME) {
  const url = new URL("/v1/collections", MANAGEMENT_API_ORIGIN);
  url.searchParams.set("limit", "100");
  url.searchParams.set("filter", `collection_name = "${collectionName}"`);
  return {
    method: "GET",
    url: url.toString(),
    host: MANAGEMENT_API_HOST,
  };
}

export function buildCreateCollectionRequest(collectionName = COLLECTION_NAME) {
  return {
    method: "POST",
    url: `${MANAGEMENT_API_ORIGIN}/v1/collections`,
    host: MANAGEMENT_API_HOST,
    body: {
      collection_name: collectionName,
      collection_description:
        "BMC product bible (LINES.md + SELL-RULES.md). Live prices stay in constants.js / catalog tools.",
      chunk_configuration: { inject_name_into_chunks: true },
      field_definitions: [
        { key: "doc_type", required: false },
        { key: "title", inject_into_chunk: true },
      ],
    },
  };
}

export function buildFileUploadUrl() {
  return `${SEARCH_API_ORIGIN}/v1/files`;
}

export function buildAddDocumentRequest(collectionId, fileId, fields = {}) {
  return {
    method: "POST",
    url: `${MANAGEMENT_API_ORIGIN}/v1/collections/${collectionId}/documents/${fileId}`,
    host: MANAGEMENT_API_HOST,
    body: { fields },
  };
}

export function buildGetDocumentRequest(collectionId, fileId) {
  return {
    method: "GET",
    url: `${MANAGEMENT_API_ORIGIN}/v1/collections/${collectionId}/documents/${fileId}`,
    host: MANAGEMENT_API_HOST,
  };
}

export function buildListDocumentsRequest(collectionId) {
  return {
    method: "GET",
    url: `${MANAGEMENT_API_ORIGIN}/v1/collections/${collectionId}/documents?limit=100`,
    host: MANAGEMENT_API_HOST,
  };
}

export function buildSearchRequest(collectionId, query = DEFAULT_SEARCH_QUERY) {
  return {
    method: "POST",
    url: `${SEARCH_API_ORIGIN}/v1/documents/search`,
    host: SEARCH_API_HOST,
    body: {
      query,
      source: { collection_ids: [collectionId] },
      retrieval_mode: { type: "hybrid" },
    },
  };
}

export function isDocumentProcessed(doc) {
  const status = String(doc?.status || doc?.file_metadata?.processing_status || "");
  return (
    status === DOCUMENT_STATUS_PROCESSED ||
    status.toLowerCase() === "processed" ||
    status.toLowerCase() === "complete"
  );
}

export function isDocumentFailed(doc) {
  const status = String(doc?.status || "");
  return status === DOCUMENT_STATUS_FAILED || status.toLowerCase() === "failed";
}

export function searchHitCount(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const bags = [
    payload.documents,
    payload.matches,
    payload.results,
    payload.citations,
    payload.chunks,
  ].filter(Array.isArray);
  const n = bags.reduce((acc, arr) => acc + arr.length, 0);
  if (n > 0) return n;
  if (payload.document) return 1;
  return 0;
}

export function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/xai-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
}

function helpText() {
  return `Usage: node scripts/xai-product-bible.mjs [--dry] [--bible-dir=DIR] [--query=TEXT]

Ensure xAI collection ${COLLECTION_NAME}, upload ${BIBLE_FILENAMES.join(" + ")},
hybrid-search ISOFRIG vs ISODEC for techo.

  --dry          Print plan (no network, no keys required)
  --bible-dir=   Override KB directory (default ~/Projects/personal-agent/docs/kb/bmc-product)
  --query=       Override search query

Live env: XAI_MANAGEMENT_API_KEY (AddFileToCollection) + XAI_API_KEY or GROK_API_KEY
`;
}

function isCliMain() {
  const invoked = process.argv[1] && path.resolve(process.argv[1]);
  if (!invoked) return false;
  return path.resolve(fileURLToPath(import.meta.url)) === invoked;
}

function authHeader(key) {
  return { Authorization: `Bearer ${key}` };
}

async function jsonFetch(fetchImpl, { method, url, key, body, headers }) {
  const res = await fetchImpl(url, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...authHeader(key),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const snippet = redactSecrets(text).slice(0, 800);
    const err = new Error(`xAI ${method} ${url} → ${res.status}: ${snippet}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function findCollectionByName(listPayload, name) {
  const collections = listPayload?.collections || listPayload?.data || [];
  return collections.find((c) => c.collection_name === name || c.name === name) || null;
}

function docsFromList(payload) {
  return payload?.documents || payload?.data || [];
}

function fileIdOf(doc) {
  return doc?.file_metadata?.file_id || doc?.file_id || doc?.id || null;
}

function fileNameOf(doc) {
  return doc?.file_metadata?.name || doc?.name || "";
}

export async function ensureCollection({ plan, managementKey, fetchImpl }) {
  const listReq = buildListCollectionsRequest(plan.collectionName);
  const listed = await jsonFetch(fetchImpl, {
    method: listReq.method,
    url: listReq.url,
    key: managementKey,
  });
  const existing = findCollectionByName(listed, plan.collectionName);
  if (existing?.collection_id) return existing.collection_id;

  const createReq = buildCreateCollectionRequest(plan.collectionName);
  const created = await jsonFetch(fetchImpl, {
    method: createReq.method,
    url: createReq.url,
    key: managementKey,
    body: createReq.body,
  });
  const id = created?.collection_id;
  if (!id) throw new Error("Create collection returned no collection_id");
  return id;
}

async function uploadFileToXai({ apiKey, filePath, name, fetchImpl }) {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "text/markdown" }), name);
  form.append("purpose", "assistants");
  const uploaded = await jsonFetch(fetchImpl, {
    method: "POST",
    url: buildFileUploadUrl(),
    key: apiKey,
    body: form,
  });
  const fileId = uploaded?.id || uploaded?.file_id;
  if (!fileId) throw new Error(`File upload for ${name} returned no file id`);
  return fileId;
}

export async function waitUntilProcessed({
  collectionId,
  fileId,
  managementKey,
  fetchImpl,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxAttempts = 40,
  intervalMs = 3000,
  log = console.error,
}) {
  const getReq = buildGetDocumentRequest(collectionId, fileId);
  for (let i = 0; i < maxAttempts; i += 1) {
    const doc = await jsonFetch(fetchImpl, {
      method: getReq.method,
      url: getReq.url,
      key: managementKey,
    });
    if (isDocumentFailed(doc)) {
      throw new Error(
        `Document ${fileId} failed: ${redactSecrets(doc.error_message || "unknown")}`,
      );
    }
    if (isDocumentProcessed(doc)) return doc;
    log(`[xai-product-bible] waiting processed ${fileId} (${i + 1}/${maxAttempts})`);
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for document ${fileId} to become searchable`);
}

export async function ensureDocuments({
  plan,
  collectionId,
  managementKey,
  apiKey,
  fetchImpl,
  sleep,
  log = console.error,
}) {
  const listReq = buildListDocumentsRequest(collectionId);
  const listed = await jsonFetch(fetchImpl, {
    method: listReq.method,
    url: listReq.url,
    key: managementKey,
  });
  const existing = docsFromList(listed);
  const out = [];

  for (const file of plan.files) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`Missing bible file: ${file.path}`);
    }
    const match = existing.find((d) => fileNameOf(d) === file.name);
    let fileId = match ? fileIdOf(match) : null;

    if (match && isDocumentProcessed(match) && fileId) {
      log(`[xai-product-bible] reuse processed ${file.name} (${fileId})`);
      out.push({ name: file.name, fileId, reused: true });
      continue;
    }

    if (!fileId || (match && isDocumentFailed(match))) {
      log(`[xai-product-bible] upload ${file.name}`);
      fileId = await uploadFileToXai({
        apiKey,
        filePath: file.path,
        name: file.name,
        fetchImpl,
      });
      const addReq = buildAddDocumentRequest(collectionId, fileId, {
        doc_type: file.docType,
        title: file.name,
      });
      await jsonFetch(fetchImpl, {
        method: addReq.method,
        url: addReq.url,
        key: managementKey,
        body: addReq.body,
      });
    }

    await waitUntilProcessed({
      collectionId,
      fileId,
      managementKey,
      fetchImpl,
      sleep,
      log,
    });
    out.push({ name: file.name, fileId, reused: false });
  }
  return out;
}

export async function runSearch({ plan, collectionId, apiKey, fetchImpl }) {
  const req = buildSearchRequest(collectionId, plan.searchQuery);
  return jsonFetch(fetchImpl, {
    method: req.method,
    url: req.url,
    key: apiKey,
    body: req.body,
  });
}

export async function runLive(opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const log = opts.log || console.error;
  const plan = opts.plan || buildUploadPlan({
    bibleDir: opts.bibleDir,
    searchQuery: opts.searchQuery,
    collectionName: opts.collectionName,
  });

  const managementKey = requireManagementKey(env);
  const apiKey = readApiKey(env);
  if (!apiKey) {
    const err = new Error(MISSING_API_KEY_MESSAGE);
    err.code = "MISSING_API_KEY";
    err.exitCode = 2;
    throw err;
  }

  const collectionId = await ensureCollection({ plan, managementKey, fetchImpl });
  log(`[xai-product-bible] collection_id=${collectionId}`);
  const docs = await ensureDocuments({
    plan,
    collectionId,
    managementKey,
    apiKey,
    fetchImpl,
    sleep: opts.sleep,
    log,
  });
  const search = await runSearch({ plan, collectionId, apiKey, fetchImpl });
  const hits = searchHitCount(search);
  return { collectionId, docs, search, hits, plan };
}

export async function main(argv = process.argv.slice(2), io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const env = io.env || process.env;
  const args = parseArgs(argv);

  if (args.help) {
    stdout.write(helpText());
    return 0;
  }

  const plan = buildUploadPlan({
    bibleDir: args.bibleDir || env.BMC_PRODUCT_BIBLE_DIR,
    searchQuery: args.searchQuery,
    collectionName: args.collectionName,
  });

  if (args.dry) {
    stdout.write(`${formatDryPlan(plan)}\n`);
    return 0;
  }

  try {
    requireManagementKey(env);
  } catch (err) {
    stderr.write(`${err.message}\n`);
    return err.exitCode || 2;
  }

  try {
    const result = await runLive({
      plan,
      env,
      fetchImpl: io.fetchImpl,
      sleep: io.sleep,
      log: (...a) => stderr.write(`${a.join(" ")}\n`),
    });
    stdout.write(
      JSON.stringify(
        {
          ok: true,
          collection: result.plan.collectionName,
          collection_id: result.collectionId,
          files: result.docs,
          hits: result.hits,
          query: result.plan.searchQuery,
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  } catch (err) {
    stderr.write(`${redactSecrets(err.message || err)}\n`);
    return err.exitCode || 1;
  }
}

if (isCliMain()) {
  main().then((code) => {
    process.exit(code);
  });
}
