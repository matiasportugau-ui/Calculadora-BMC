/**
 * responseFeedback.js — Per-response feedback store.
 *
 * Stores feedback events in a daily JSONL file and converts
 * high-signal ones (corrections, confirmations) to KB entries.
 *
 * Ratings:
 *   "good"   → confirms the response was correct → KB active entry
 *   "bad"    → marks it wrong without correction → KB pending entry (queue for review)
 *   "edit"   → provides the correct version → KB active entry with badAnswer=original
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { addTrainingEntry } from "./trainingKB.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const feedbackDir = path.join(repoRoot, "data", "response-feedback");

function ensureDir() {
  if (!fs.existsSync(feedbackDir)) fs.mkdirSync(feedbackDir, { recursive: true });
}

function dayFile() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(feedbackDir, `FEEDBACK-${day}.jsonl`);
}

function appendEvent(event) {
  ensureDir();
  fs.appendFileSync(dayFile(), `${JSON.stringify(event)}\n`, "utf8");
}

/**
 * Save feedback on a generated response.
 *
 * @param {object} opts
 * @param {"chat"|"wa"|"ml"} opts.channel
 * @param {string} opts.question      — the user's question / topic
 * @param {string} opts.generatedText — what the agent produced
 * @param {"good"|"bad"|"edit"} opts.rating
 * @param {string} [opts.correction]  — correct version (for "edit")
 * @param {string} [opts.comment]     — free-text note from reviewer
 * @param {string} [opts.convId]      — conversation ID (for traceability)
 * @param {string} [opts.rowId]       — CRM row / ML question ID
 * @returns {{ ok: boolean, feedbackId: string, kbEntryId?: string }}
 */
export function saveFeedback({ channel, question, generatedText, rating, correction, comment, convId, rowId }) {
  const feedbackId = crypto.randomUUID();
  const ts = new Date().toISOString();

  const event = {
    feedbackId, ts, channel,
    question: String(question || "").trim(),
    generatedText: String(generatedText || "").trim(),
    rating,
    correction: correction ? String(correction).trim() : null,
    comment: comment ? String(comment).trim() : null,
    convId: convId || null,
    rowId: rowId || null,
  };

  appendEvent(event);

  let kbEntryId = null;

  if (rating === "good" && event.question && event.generatedText) {
    try {
      const entry = addTrainingEntry({
        question: event.question,
        goodAnswer: event.generatedText,
        category: channel === "ml" ? "sales" : "conversational",
        context: `[feedback:good] canal:${channel}${comment ? ` — ${comment}` : ""}`,
        source: "feedback_good",
        status: "active",
        confidence: 0.95,
        convId: convId || null,
      });
      kbEntryId = entry.id;
    } catch { /* non-critical */ }
  }

  if (rating === "edit" && event.question && event.correction) {
    try {
      const entry = addTrainingEntry({
        question: event.question,
        goodAnswer: event.correction,
        badAnswer: event.generatedText,
        category: channel === "ml" ? "sales" : "conversational",
        context: `[feedback:edit] canal:${channel}${comment ? ` — ${comment}` : ""}`,
        source: "feedback_edit",
        status: "active",
        confidence: 1.0,
        convId: convId || null,
      });
      kbEntryId = entry.id;
    } catch { /* non-critical */ }
  }

  if (rating === "bad" && event.question && event.generatedText) {
    try {
      const entry = addTrainingEntry({
        question: event.question,
        goodAnswer: event.generatedText,
        badAnswer: "",
        category: channel === "ml" ? "sales" : "conversational",
        context: `[feedback:bad] canal:${channel}${comment ? ` — ${comment}` : ""}`,
        source: "feedback_bad",
        status: "pending",
        confidence: 0,
        convId: convId || null,
      });
      kbEntryId = entry.id;
    } catch { /* non-critical */ }
  }

  return { ok: true, feedbackId, kbEntryId };
}

/**
 * Load feedback events from the last N days.
 * @param {number} days
 * @returns {Array<object>}
 */
export function loadRecentFeedback({ days = 7 } = {}) {
  ensureDir();
  const events = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const fp = path.join(feedbackDir, `FEEDBACK-${d}.jsonl`);
    if (!fs.existsSync(fp)) continue;
    try {
      const lines = fs.readFileSync(fp, "utf8").split("\n").filter(Boolean);
      for (const l of lines) {
        try { events.push(JSON.parse(l)); } catch { /* skip malformed */ }
      }
    } catch { /* skip unreadable */ }
  }
  return events.sort((a, b) => b.ts.localeCompare(a.ts));
}

export function getFeedbackStats({ days = 30 } = {}) {
  const events = loadRecentFeedback({ days });
  const byChannel = {};
  const byRating = { good: 0, bad: 0, edit: 0 };
  for (const e of events) {
    byChannel[e.channel] = (byChannel[e.channel] || 0) + 1;
    byRating[e.rating] = (byRating[e.rating] || 0) + 1;
  }
  return { total: events.length, byChannel, byRating };
}
