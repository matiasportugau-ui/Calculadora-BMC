#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const knowledgeDir = path.join(repoRoot, "docs", "team", "knowledge");
const reportsDir = path.join(knowledgeDir, "reports");

export const paths = {
  repoRoot,
  knowledgeDir,
  reportsDir,
  sourcesRegistry: path.join(knowledgeDir, "sources-registry.json"),
  referencesCatalog: path.join(knowledgeDir, "references-catalog.json"),
  impactMap: path.join(knowledgeDir, "impact-map.json"),
  eventsLog: path.join(knowledgeDir, "events-log.jsonl"),
};

export function nowIso() {
  return new Date().toISOString();
}

export function asDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function hashId(...parts) {
  const joined = parts.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(joined).digest("hex").slice(0, 16);
}

export async function ensureKnowledgePaths() {
  await fs.mkdir(paths.knowledgeDir, { recursive: true });
  await fs.mkdir(paths.reportsDir, { recursive: true });
  await ensureFile(paths.eventsLog, "");
}

export async function ensureFile(filePath, content = "") {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content, "utf8");
  }
}

export async function readJsonOrDefault(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  const formatted = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(filePath, formatted, "utf8");
}

export async function appendJsonl(filePath, entries) {
  if (!entries.length) return;
  const lines = entries.map((entry) => JSON.stringify(entry)).join("\n");
  await fs.appendFile(filePath, `${lines}\n`, "utf8");
}

export async function readJsonl(filePath, { limit = 0 } = {}) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    if (limit > 0 && parsed.length > limit) {
      return parsed.slice(parsed.length - limit);
    }
    return parsed;
  } catch {
    return [];
  }
}

export function defaultRegistry() {
  const createdAt = nowIso();
  return {
    schemaVersion: "1.0.0",
    updatedAt: createdAt,
    projectProfile: {
      name: "BMC/Panelin",
      focusAreas: [
        "llm-platforms",
        "developer-tooling",
        "frontend-stack",
        "cloud-deploy",
        "workflow-automation",
      ],
      trackedDomains: [
        "calculadora",
        "dashboard",
        "crm",
        "ml-oauth",
        "deploy-cloudrun-vercel",
      ],
    },
    rankingPolicy: {
      authorityWeight: 0.35,
      freshnessWeight: 0.2,
      signalWeight: 0.25,
      projectFitWeight: 0.2,
      promoteThreshold: 0.75,
      demoteThreshold: 0.35,
    },
    sources: [
      {
        id: "openai-news-rss",
        name: "OpenAI News",
        type: "rss",
        category: "ai-lab",
        status: "active",
        url: "https://openai.com/news/rss.xml",
        authorityScore: 0.98,
        projectFitWeight: 0.95,
        tags: ["openai", "models", "api", "agent"],
        trustTier: "tier-1",
        evidenceLinks: ["https://openai.com/news/"],
        createdAt,
        updatedAt: createdAt,
        lastCheckedAt: null,
        stats: { eventsSeen: 0, acceptedEvents: 0, rejectedEvents: 0, avgEventScore: 0 },
      },
      {
        id: "anthropic-news-rss",
        name: "Anthropic News",
        type: "rss",
        category: "ai-lab",
        status: "active",
        url: "https://www.anthropic.com/news/rss.xml",
        authorityScore: 0.95,
        projectFitWeight: 0.9,
        tags: ["anthropic", "llm", "api", "safety"],
        trustTier: "tier-1",
        evidenceLinks: ["https://www.anthropic.com/news"],
        createdAt,
        updatedAt: createdAt,
        lastCheckedAt: null,
        stats: { eventsSeen: 0, acceptedEvents: 0, rejectedEvents: 0, avgEventScore: 0 },
      },
      {
        id: "vercel-releases",
        name: "Vercel Releases",
        type: "github_releases",
        category: "platform",
        status: "active",
        url: "https://github.com/vercel/vercel/releases",
        apiUrl: "https://api.github.com/repos/vercel/vercel/releases",
        authorityScore: 0.92,
        projectFitWeight: 0.86,
        tags: ["vercel", "deployment", "edge", "ci-cd"],
        trustTier: "tier-1",
        evidenceLinks: ["https://vercel.com/changelog"],
        createdAt,
        updatedAt: createdAt,
        lastCheckedAt: null,
        stats: { eventsSeen: 0, acceptedEvents: 0, rejectedEvents: 0, avgEventScore: 0 },
      },
      {
        id: "supabase-releases",
        name: "Supabase Releases",
        type: "github_releases",
        category: "platform",
        status: "active",
        url: "https://github.com/supabase/supabase/releases",
        apiUrl: "https://api.github.com/repos/supabase/supabase/releases",
        authorityScore: 0.88,
        projectFitWeight: 0.82,
        tags: ["supabase", "postgres", "realtime", "auth"],
        trustTier: "tier-2",
        evidenceLinks: ["https://supabase.com/changelog"],
        createdAt,
        updatedAt: createdAt,
        lastCheckedAt: null,
        stats: { eventsSeen: 0, acceptedEvents: 0, rejectedEvents: 0, avgEventScore: 0 },
      },
      {
        id: "arxiv-cs-ai-rss",
        name: "arXiv cs.AI",
        type: "rss",
        category: "research",
        status: "active",
        url: "https://export.arxiv.org/rss/cs.AI",
        authorityScore: 0.82,
        projectFitWeight: 0.74,
        tags: ["research", "papers", "benchmarks"],
        trustTier: "tier-2",
        evidenceLinks: ["https://arxiv.org/list/cs.AI/recent"],
        createdAt,
        updatedAt: createdAt,
        lastCheckedAt: null,
        stats: { eventsSeen: 0, acceptedEvents: 0, rejectedEvents: 0, avgEventScore: 0 },
      },
    ],
    sourceCandidates: [],
  };
}

export function defaultReferencesCatalog() {
  return {
    schemaVersion: "1.0.0",
    updatedAt: nowIso(),
    references: [],
  };
}

export function defaultImpactMap() {
  return {
    schemaVersion: "1.0.0",
    updatedAt: nowIso(),
    domains: [
      "llm-platforms",
      "frontend-stack",
      "deployment-stack",
      "data-and-storage",
      "workflow-automation",
    ],
    mappings: [],
  };
}

export async function loadRegistry() {
  return readJsonOrDefault(paths.sourcesRegistry, defaultRegistry());
}

export async function loadReferencesCatalog() {
  return readJsonOrDefault(paths.referencesCatalog, defaultReferencesCatalog());
}

export async function loadImpactMap() {
  return readJsonOrDefault(paths.impactMap, defaultImpactMap());
}

export function normalizeText(input) {
  return String(input || "").replace(/\s+/g, " ").trim();
}

export function stripHtml(input) {
  return normalizeText(String(input || "").replace(/<[^>]*>/g, " "));
}

function decodeXmlEntities(input) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

export function parseRssItems(xml) {
  const content = String(xml || "");
  const items = [...content.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  return items.map((itemRaw) => {
    const title = decodeXmlEntities(extractTag(itemRaw, "title"));
    const link = decodeXmlEntities(extractTag(itemRaw, "link"));
    const pubDate = extractTag(itemRaw, "pubDate");
    const description = decodeXmlEntities(stripHtml(extractTag(itemRaw, "description")));
    return { title, link, pubDate, description };
  }).filter((item) => item.title && item.link);
}

export function extractTag(text, tagName) {
  const match = String(text || "").match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return normalizeText(match ? match[1] : "");
}

export async function fetchText(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: { "User-Agent": "bmc-knowledge-antenna/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  return res.text();
}

export async function fetchJson(url, timeoutMs = 15000) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "bmc-knowledge-antenna/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  return res.json();
}

export function pickTier(score) {
  if (score >= 0.85) return "tier-1";
  if (score >= 0.65) return "tier-2";
  return "tier-3";
}

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function daysAgoIso(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
