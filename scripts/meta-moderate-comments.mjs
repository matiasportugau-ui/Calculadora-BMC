#!/usr/bin/env node
/**
 * Meta Page comment moderation workflow (Graph API).
 *
 * Default: dry-run (lists matches only) and registers them in the local ledger.
 * Apply:   node scripts/meta-moderate-comments.mjs --apply
 * Block:   node scripts/meta-moderate-comments.mjs --apply --block
 *
 * Required env:
 *   FB_PAGE_TOKEN  — Page access token with pages_read_engagement + pages_manage_engagement
 *   META_PAGE_ID   — Facebook Page id (Bmcuruguay)
 *
 * Optional:
 *   META_MODERATE_AUTHOR   — default "Fernando Guglielmelly" (case, accents, and extra spaces folded)
 *   META_GRAPH_VERSION     — default v21.0 (same pin as the rest of this repo; do not lower it)
 *   META_POST_LIMIT        — posts to scan (default 50)
 *   META_COMMENT_LIMIT     — comments per post (default 100)
 *
 * Ledger: data/meta-comments/registry.jsonl (gitignored). A later shorter scan
 * does not remove rows already registered. META_COMMENTS_ENABLED stays off;
 * this script does not subscribe Page webhooks.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  authorMatches,
  hideRequest,
  knownAuthorIds,
  mergeLedger,
  readLedger,
  truncationReport,
  writeLedger,
} from "./lib/metaCommentMatch.mjs";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN || "";
const PAGE_ID = process.env.META_PAGE_ID || "";
const AUTHOR_NEEDLE = (process.env.META_MODERATE_AUTHOR || "Fernando Guglielmelly").trim();
const POST_LIMIT = Number(process.env.META_POST_LIMIT || 50);
const COMMENT_LIMIT = Number(process.env.META_COMMENT_LIMIT || 100);
const LEDGER_DIR = resolve(process.cwd(), "data/meta-comments");
const LEDGER_PATH = resolve(LEDGER_DIR, "registry.jsonl");
const REPORT_PATH = resolve(LEDGER_DIR, "last-report.json");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DO_BLOCK = args.has("--block");
const HELP = args.has("--help") || args.has("-h");

function usage() {
  console.log(`Usage:
  FB_PAGE_TOKEN=... META_PAGE_ID=... node scripts/meta-moderate-comments.mjs
  FB_PAGE_TOKEN=... META_PAGE_ID=... node scripts/meta-moderate-comments.mjs --apply
  FB_PAGE_TOKEN=... META_PAGE_ID=... node scripts/meta-moderate-comments.mjs --apply --block

Env:
  META_MODERATE_AUTHOR   filter author name (default: Fernando Guglielmelly)
  META_GRAPH_VERSION     Graph version (default: v21.0)
  META_POST_LIMIT        posts to scan (default: 50)
  META_COMMENT_LIMIT     comments per post (default: 100)

Ledger (local, not committed):
  data/meta-comments/registry.jsonl
`);
}

async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", PAGE_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    const code = body?.error?.code;
    throw new Error(`GET ${path} failed (${res.status}${code != null ? ` code=${code}` : ""}): ${msg}`);
  }
  return body;
}

async function graphPost(path, params = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", PAGE_TOKEN);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    const code = body?.error?.code;
    throw new Error(`POST ${path} failed (${res.status}${code != null ? ` code=${code}` : ""}): ${msg}`);
  }
  return body;
}

async function graphGetFirst(path, params) {
  try {
    return await graphGet(path, { ...params, summary: "total_count" });
  } catch (err) {
    if (!/summary/i.test(String(err.message || err))) throw err;
    return graphGet(path, params);
  }
}

async function collectAll(path, params, maxItems) {
  const out = [];
  let totalCount = null;
  let data = await graphGetFirst(path, params);
  if (data.summary?.total_count != null) totalCount = Number(data.summary.total_count);
  out.push(...(data.data || []));
  let hasNext = Boolean(data.paging?.next);
  while (data.paging?.next && out.length < maxItems) {
    const res = await fetch(data.paging.next);
    data = await res.json();
    if (data.error) throw new Error(data.error.message || "paging failed");
    if (data.summary?.total_count != null) totalCount = Number(data.summary.total_count);
    out.push(...(data.data || []));
    hasNext = Boolean(data.paging?.next);
  }
  const items = out.slice(0, maxItems);
  return {
    items,
    ...truncationReport({
      scannedCount: items.length,
      totalCount,
      hasNext: hasNext && items.length >= maxItems,
    }),
  };
}

function loadLedger() {
  try {
    return readLedger(readFileSync(LEDGER_PATH, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function saveLedger(rows) {
  mkdirSync(LEDGER_DIR, { recursive: true });
  writeFileSync(LEDGER_PATH, writeLedger(rows));
}

async function main() {
  if (HELP) {
    usage();
    process.exit(0);
  }
  if (!PAGE_TOKEN || !PAGE_ID) {
    console.error("Missing FB_PAGE_TOKEN and/or META_PAGE_ID.");
    usage();
    process.exit(2);
  }
  if (GRAPH_VERSION !== "v21.0") {
    console.log(`Graph version override: ${GRAPH_VERSION} (repo pin is v21.0)`);
  }

  const previous = loadLedger();
  const knownIds = knownAuthorIds(previous);
  const nowIso = new Date().toISOString();

  console.log(JSON.stringify({
    mode: APPLY ? "APPLY" : "DRY_RUN",
    block: DO_BLOCK,
    pageId: PAGE_ID,
    authorFilter: AUTHOR_NEEDLE,
    graphVersion: GRAPH_VERSION,
    postLimit: POST_LIMIT,
    commentLimit: COMMENT_LIMIT,
    ledgerRows: previous.length,
    knownAuthorIds: knownIds.size,
  }));

  const me = await graphGet("/me", { fields: "id,name" });
  console.log(`Token identity: ${me.name || "?"} (${me.id})`);

  const postsPage = await collectAll(`/${PAGE_ID}/posts`, {
    fields: "id,message,created_time,permalink_url",
    limit: Math.min(POST_LIMIT, 100),
  }, POST_LIMIT);
  const posts = postsPage.items;
  console.log(`Posts scanned: ${posts.length}${postsPage.truncated ? ` truncated total=${postsPage.totalCount ?? "?"}` : ""}`);

  const matches = [];
  const authorIds = new Set();
  let commentsTruncated = 0;

  for (const post of posts) {
    let commentsPage;
    try {
      commentsPage = await collectAll(`/${post.id}/comments`, {
        fields: "id,message,created_time,from,is_hidden,permalink_url",
        filter: "stream",
        limit: Math.min(COMMENT_LIMIT, 100),
      }, COMMENT_LIMIT);
    } catch (err) {
      console.warn(`Skip comments for post ${post.id}: ${err.message}`);
      continue;
    }
    if (commentsPage.truncated) {
      commentsTruncated += 1;
      console.warn(`truncated: true post=${post.id} scanned=${commentsPage.scannedCount} total=${commentsPage.totalCount ?? "?"}`);
    }
    for (const c of commentsPage.items) {
      if (!authorMatches(c.from, AUTHOR_NEEDLE, knownIds)) continue;
      matches.push({
        commentId: c.id,
        authorId: c.from?.id || null,
        authorName: c.from?.name || "",
        message: c.message || "",
        isHidden: Boolean(c.is_hidden),
        createdTime: c.created_time || null,
        postId: post.id,
        postPermalink: post.permalink_url || null,
        commentPermalink: c.permalink_url || null,
      });
      if (c.from?.id) authorIds.add(String(c.from.id));
    }
  }

  console.log(`Matching comments this scan: ${matches.length}`);
  console.log(`Distinct author ids this scan: ${authorIds.size}`);

  const hideResults = [];
  const hideStatusByComment = new Map();
  if (APPLY) {
    for (const m of matches) {
      if (m.isHidden) {
        hideResults.push({ commentId: m.commentId, status: "already_hidden" });
        hideStatusByComment.set(m.commentId, "already_hidden");
        continue;
      }
      const req = hideRequest(m.commentId);
      try {
        await graphPost(req.path, req.params);
        hideResults.push({ commentId: m.commentId, status: "hidden" });
        hideStatusByComment.set(m.commentId, "hidden");
        console.log(`HIDDEN ${m.commentId} — ${m.message.slice(0, 80)}`);
      } catch (err) {
        hideResults.push({ commentId: m.commentId, status: "error", error: err.message });
        hideStatusByComment.set(m.commentId, "error");
        console.error(`FAIL hide ${m.commentId}: ${err.message}`);
      }
    }
  } else {
    for (const m of matches) {
      hideStatusByComment.set(m.commentId, m.isHidden ? "already_hidden" : "dry_run");
      console.log(`[dry-run] would hide ${m.commentId} (${m.isHidden ? "already hidden" : "visible"}): ${m.message.slice(0, 100)}`);
    }
  }

  const blockResults = [];
  const blockStatusByAuthor = new Map();
  if (APPLY && DO_BLOCK) {
    for (const uid of authorIds) {
      try {
        const r = await graphPost(`/${PAGE_ID}/blocked`, { asuid: uid });
        blockResults.push({ userId: uid, status: "blocked", response: r });
        blockStatusByAuthor.set(uid, "blocked");
        console.log(`BLOCKED user ${uid}`);
      } catch (err) {
        blockResults.push({ userId: uid, status: "error", error: err.message });
        blockStatusByAuthor.set(uid, "error");
        console.error(`FAIL block ${uid}: ${err.message}`);
      }
    }
  } else if (DO_BLOCK && !APPLY) {
    for (const uid of authorIds) {
      blockStatusByAuthor.set(uid, "dry_run");
      console.log(`[dry-run] would block user ${uid}`);
    }
  }

  const scannedRows = matches.map((m) => {
    const hideStatus = hideStatusByComment.get(m.commentId) || "dry_run";
    const authorId = m.authorId != null ? String(m.authorId) : null;
    return {
      commentId: m.commentId,
      authorId,
      authorName: m.authorName,
      message: m.message,
      isHidden: hideStatus === "hidden" || hideStatus === "already_hidden" || m.isHidden,
      postId: m.postId,
      postPermalink: m.postPermalink,
      commentPermalink: m.commentPermalink,
      hideStatus,
      blockStatus: (authorId && blockStatusByAuthor.get(authorId)) || "not_requested",
    };
  });

  const ledger = mergeLedger(previous, scannedRows, nowIso);
  if (APPLY && DO_BLOCK) {
    for (const row of ledger) {
      const status = row.authorId != null ? blockStatusByAuthor.get(String(row.authorId)) : null;
      if (status) row.blockStatus = status;
    }
  }
  saveLedger(ledger);

  const report = {
    generatedAt: nowIso,
    mode: APPLY ? "APPLY" : "DRY_RUN",
    blockRequested: DO_BLOCK,
    pageId: PAGE_ID,
    authorFilter: AUTHOR_NEEDLE,
    graphVersion: GRAPH_VERSION,
    postsScanned: posts.length,
    postsTruncated: postsPage.truncated,
    postsTotal: postsPage.totalCount,
    commentPagesTruncated: commentsTruncated,
    matches,
    ledgerRows: ledger.length,
    ledgerPath: LEDGER_PATH,
    hideResults,
    blockResults,
    nextUiSteps: [
      "Meta Business Suite → Configuración → filtrar palabras ofensivas (chantas, hdp, garcas, cagadores)",
      "En publicaciones clave: ⋯ → Desactivar comentarios / restringir quién puede comentar",
      "Revisar Comentarios de Instagram (misma persona si aplica)",
    ],
  };

  mkdirSync(LEDGER_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Ledger: ${LEDGER_PATH} (${ledger.length} rows)`);
  console.log(`Report: ${REPORT_PATH}`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to hide, and --apply --block to also block authors.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
