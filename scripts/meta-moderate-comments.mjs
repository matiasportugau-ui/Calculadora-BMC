#!/usr/bin/env node
/**
 * Meta Page comment moderation workflow (Graph API).
 *
 * Default: dry-run (lists matches only).
 * Apply:   node scripts/meta-moderate-comments.mjs --apply
 * Block:   node scripts/meta-moderate-comments.mjs --apply --block
 *
 * Required env:
 *   FB_PAGE_TOKEN  — Page access token with pages_read_engagement + pages_manage_engagement
 *   META_PAGE_ID   — Facebook Page id (Bmcuruguay)
 *
 * Optional:
 *   META_MODERATE_AUTHOR   — default "Fernando Guglielmelly" (case-insensitive substring)
 *   META_GRAPH_VERSION     — default v21.0
 *   META_POST_LIMIT        — posts to scan (default 50)
 *   META_COMMENT_LIMIT     — comments per post (default 100)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN || "";
const PAGE_ID = process.env.META_PAGE_ID || "";
const AUTHOR_NEEDLE = (process.env.META_MODERATE_AUTHOR || "Fernando Guglielmelly").trim().toLowerCase();
const POST_LIMIT = Number(process.env.META_POST_LIMIT || 50);
const COMMENT_LIMIT = Number(process.env.META_COMMENT_LIMIT || 100);

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
  META_POST_LIMIT        posts to scan (default: 50)
  META_COMMENT_LIMIT     comments per post (default: 100)
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

async function collectAll(path, params, maxItems) {
  const out = [];
  let data = await graphGet(path, params);
  out.push(...(data.data || []));
  while (data.paging?.next && out.length < maxItems) {
    const nextUrl = new URL(data.paging.next);
    const res = await fetch(nextUrl);
    data = await res.json();
    if (data.error) throw new Error(data.error.message || "paging failed");
    out.push(...(data.data || []));
  }
  return out.slice(0, maxItems);
}

function authorMatches(from) {
  const name = String(from?.name || "").toLowerCase();
  return Boolean(name) && name.includes(AUTHOR_NEEDLE);
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

  console.log(JSON.stringify({
    mode: APPLY ? "APPLY" : "DRY_RUN",
    block: DO_BLOCK,
    pageId: PAGE_ID,
    authorFilter: AUTHOR_NEEDLE,
    postLimit: POST_LIMIT,
    commentLimit: COMMENT_LIMIT,
  }));

  const me = await graphGet("/me", { fields: "id,name" });
  console.log(`Token identity: ${me.name || "?"} (${me.id})`);

  const posts = await collectAll(`/${PAGE_ID}/posts`, {
    fields: "id,message,created_time,permalink_url",
    limit: Math.min(POST_LIMIT, 100),
  }, POST_LIMIT);
  console.log(`Posts scanned: ${posts.length}`);

  const matches = [];
  const authorIds = new Set();

  for (const post of posts) {
    let comments = [];
    try {
      comments = await collectAll(`/${post.id}/comments`, {
        fields: "id,message,created_time,from,is_hidden,permalink_url",
        filter: "stream",
        limit: Math.min(COMMENT_LIMIT, 100),
      }, COMMENT_LIMIT);
    } catch (err) {
      console.warn(`Skip comments for post ${post.id}: ${err.message}`);
      continue;
    }
    for (const c of comments) {
      if (!authorMatches(c.from)) continue;
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
      if (c.from?.id) authorIds.add(c.from.id);
    }
  }

  console.log(`Matching comments: ${matches.length}`);
  console.log(`Distinct author ids: ${authorIds.size}`);

  const hideResults = [];
  if (APPLY) {
    for (const m of matches) {
      if (m.isHidden) {
        hideResults.push({ commentId: m.commentId, status: "already_hidden" });
        continue;
      }
      try {
        await graphPost(`/${m.commentId}`, { is_hidden: "true" });
        hideResults.push({ commentId: m.commentId, status: "hidden" });
        console.log(`HIDDEN ${m.commentId} — ${m.message.slice(0, 80)}`);
      } catch (err) {
        hideResults.push({ commentId: m.commentId, status: "error", error: err.message });
        console.error(`FAIL hide ${m.commentId}: ${err.message}`);
      }
    }
  } else {
    for (const m of matches) {
      console.log(`[dry-run] would hide ${m.commentId} (${m.isHidden ? "already hidden" : "visible"}): ${m.message.slice(0, 100)}`);
    }
  }

  const blockResults = [];
  if (APPLY && DO_BLOCK) {
    for (const uid of authorIds) {
      try {
        // Page block: POST /{page-id}/blocked?asuid={user-id}
        const r = await graphPost(`/${PAGE_ID}/blocked`, { asuid: uid });
        blockResults.push({ userId: uid, status: "blocked", response: r });
        console.log(`BLOCKED user ${uid}`);
      } catch (err) {
        blockResults.push({ userId: uid, status: "error", error: err.message });
        console.error(`FAIL block ${uid}: ${err.message}`);
      }
    }
  } else if (DO_BLOCK && !APPLY) {
    for (const uid of authorIds) {
      console.log(`[dry-run] would block user ${uid}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? "APPLY" : "DRY_RUN",
    blockRequested: DO_BLOCK,
    pageId: PAGE_ID,
    authorFilter: AUTHOR_NEEDLE,
    postsScanned: posts.length,
    matches,
    hideResults,
    blockResults,
    nextUiSteps: [
      "Meta Business Suite → Configuración → filtrar palabras ofensivas (chantas, hdp, garcas, cagadores)",
      "En publicaciones clave: ⋯ → Desactivar comentarios / restringir quién puede comentar",
      "Revisar Comentarios de Instagram (misma persona si aplica)",
    ],
  };

  const outDir = resolve("/opt/cursor/artifacts");
  try {
    mkdirSync(outDir, { recursive: true });
  } catch {
    /* ignore */
  }
  const outPath = resolve(outDir, `meta-moderate-${APPLY ? "apply" : "dryrun"}-${Date.now()}.json`);
  try {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${outPath}`);
  } catch {
    writeFileSync(resolve(process.cwd(), "meta-moderate-last-report.json"), JSON.stringify(report, null, 2));
    console.log("Report: ./meta-moderate-last-report.json");
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to hide, and --apply --block to also block authors.");
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
