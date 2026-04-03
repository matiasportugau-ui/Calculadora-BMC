#!/usr/bin/env node
import fs from "node:fs/promises";
import { fetchJson, fetchText, loadRegistry, paths } from "./knowledge-antenna-lib.mjs";

const mode = process.argv.includes("--strict") ? "strict" : "soft";
const sampleSize = Number(
  process.argv.find((arg) => arg.startsWith("--sample="))?.split("=")[1] || "3"
);

function isIsoDate(value) {
  if (!value) return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts);
}

async function assertJsonFile(filePath, requiredKeys = []) {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content);
  for (const key of requiredKeys) {
    if (!(key in parsed)) {
      throw new Error(`Missing key "${key}" in ${filePath}`);
    }
  }
  return parsed;
}

async function checkSource(source) {
  try {
    if (source.type === "rss") {
      const xml = await fetchText(source.url, 12000);
      return { ok: xml.includes("<item>") || xml.includes("<entry>"), reason: "rss fetched" };
    }
    if (source.type === "github_releases") {
      const data = await fetchJson(source.apiUrl || source.url, 12000);
      return { ok: Array.isArray(data), reason: "github releases fetched" };
    }
    return { ok: true, reason: "unsupported source type skipped" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const checks = [];

  await fs.access(paths.knowledgeDir);
  await fs.access(paths.reportsDir);

  const registry = await assertJsonFile(paths.sourcesRegistry, ["schemaVersion", "sources"]);
  await assertJsonFile(paths.referencesCatalog, ["schemaVersion", "references"]);
  await assertJsonFile(paths.impactMap, ["schemaVersion", "mappings"]);
  await fs.access(paths.eventsLog);

  checks.push({
    name: "schemas",
    ok: true,
    details: "knowledge schema files are readable and valid JSON",
  });

  const activeSources = (registry.sources || []).filter((source) => source.status === "active");
  const sampled = activeSources.slice(0, Math.max(1, sampleSize));

  const sourceChecks = [];
  for (const source of sampled) {
    const result = await checkSource(source);
    sourceChecks.push({
      sourceId: source.id,
      ok: result.ok,
      reason: result.reason,
      lastCheckedAtValid: source.lastCheckedAt ? isIsoDate(source.lastCheckedAt) : true,
    });
  }
  const sourceOk = sourceChecks.every((check) => check.ok);
  checks.push({
    name: "source-connectivity",
    ok: sourceOk,
    details: sourceChecks,
  });

  const summary = {
    ok: checks.every((check) => check.ok),
    mode,
    generatedAt: new Date().toISOString(),
    checks,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (mode === "strict" && !summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
