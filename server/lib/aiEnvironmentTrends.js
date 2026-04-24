/**
 * Agrega señales del "entorno IA" local (Panelin Knowledge / events-log.jsonl)
 * para un modo analítico: tags, fuentes, ventana temporal, comparación simple.
 */

import fs from "node:fs";
import path from "node:path";

function isoWeekKey(d) {
  const date = new Date(d);
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function eventDate(ev) {
  const raw = ev.capturedAt || ev.publishedAt || "";
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function inc(map, key, by = 1) {
  const k = String(key || "—").trim() || "—";
  map.set(k, (map.get(k) || 0) + by);
}

/**
 * @param {object} opts
 * @param {string} opts.filePath - absoluto al JSONL
 * @param {number} opts.daysWindow - días hacia atrás desde ahora
 */
export function buildAiEnvironmentTrends({ filePath, daysWindow = 60 }) {
  const windowMs = Math.max(1, Math.min(Number(daysWindow) || 60, 365)) * 86400000;
  const now = Date.now();
  const cutoff = now - windowMs;
  const mid = cutoff + windowMs / 2;

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      ok: false,
      error: "events_log_missing",
      filePath,
      totalEvents: 0,
      byTag: [],
      bySource: [],
      byWeek: [],
      decisions: {},
      scoreStats: null,
      trends: ["No se encontró el archivo de eventos o la ruta es inválida."],
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const tags = new Map();
  const sources = new Map();
  const weeks = new Map();
  const tagsEarly = new Map();
  const tagsLate = new Map();
  const decisions = new Map();
  let parsed = 0;
  let skipped = 0;
  const scores = [];

  for (const line of lines) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    const t = eventDate(ev);
    if (t == null || t < cutoff) continue;
    parsed += 1;
    const tagList = Array.isArray(ev.tags) ? ev.tags : [];
    for (const tg of tagList) inc(tags, tg);
    inc(sources, ev.sourceName || ev.sourceId || "unknown");
    inc(weeks, isoWeekKey(t));
    if (typeof ev.eventScore === "number" && Number.isFinite(ev.eventScore)) scores.push(ev.eventScore);
    inc(decisions, ev.decision || "unset");
    for (const tg of tagList) {
      if (t < mid) inc(tagsEarly, tg);
      else inc(tagsLate, tg);
    }
  }

  const toSorted = (m) =>
    [...m.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

  const byTag = toSorted(tags);
  const bySource = toSorted(sources);
  const byWeek = toSorted(weeks).sort((a, b) => a.key.localeCompare(b.key));

  const scoreStats =
    scores.length > 0
      ? {
          n: scores.length,
          avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000,
          min: Math.min(...scores),
          max: Math.max(...scores),
        }
      : null;

  const trends = [];
  if (parsed === 0) {
    trends.push("No hay eventos en la ventana seleccionada (revisá days o la fecha de capturedAt/publishedAt).");
  } else {
    if (byTag[0]) trends.push(`Tag dominante: ${byTag[0].key} (${byTag[0].count} eventos en la ventana).`);
    if (bySource[0]) trends.push(`Fuente más activa: ${bySource[0].key} (${bySource[0].count}).`);
    if (scoreStats) trends.push(`eventScore medio ${scoreStats.avg} (n=${scoreStats.n}).`);

    const topTags = byTag.slice(0, 8).map((x) => x.key);
    for (const tg of topTags) {
      const a = tagsEarly.get(tg) || 0;
      const b = tagsLate.get(tg) || 0;
      if (a + b < 3) continue;
      const delta = b - a;
      const pct = a ? Math.round((delta / a) * 100) : b > 0 ? 100 : 0;
      if (Math.abs(pct) >= 25 && Math.abs(delta) >= 2) {
        trends.push(
          delta > 0
            ? `Subida fuerte en tag "${tg}" en la mitad reciente de la ventana (+${pct}% vs primera mitad).`
            : `Bajada en tag "${tg}" en la mitad reciente (${pct}% vs primera mitad).`
        );
      }
    }
    if (trends.length <= 2 && byWeek.length >= 2) {
      const last = byWeek[byWeek.length - 1];
      const prev = byWeek[byWeek.length - 2];
      if (last && prev) {
        const ch = last.count - prev.count;
        trends.push(`Semana ${last.key}: ${last.count} eventos (${ch >= 0 ? "+" : ""}${ch} vs ${prev.key}).`);
      }
    }
  }

  return {
    ok: true,
    filePath,
    windowDays: Math.round(windowMs / 86400000),
    totalLines: lines.length,
    parsedInWindow: parsed,
    skippedLines: skipped,
    byTag,
    bySource,
    byWeek,
    decisions: Object.fromEntries(decisions),
    scoreStats,
    trends,
  };
}

export function defaultKnowledgeEventsLogPath(cwd = process.cwd()) {
  return path.join(cwd, "docs/team/knowledge/events-log.jsonl");
}
