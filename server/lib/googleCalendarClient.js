// ═══════════════════════════════════════════════════════════════════════════
// server/lib/googleCalendarClient.js — outbound writes BMC → Google Calendar
// ───────────────────────────────────────────────────────────────────────────
// Tareas Phase D. The Google Tasks REST API persists only title/notes/due(date)/
// status/parent. Time-of-day + recurrence in the Google Tasks UI are backed by
// a paired Google Calendar event — so BMC mirrors a task into a Calendar event
// whenever due_time or recurrence_rule is set. tasks.tasks.calendar_event_id
// links the two.
//
// BMC stays system-of-record: the time/recurrence fields live in tasks.tasks
// regardless of Calendar. The Calendar event is a MIRROR. Callers must treat a
// Calendar failure (incl. 403 missing-scope) as non-fatal to the task write —
// persist the task with calendar_event_id = NULL and surface a soft flag so the
// SPA can prompt re-consent. See server/routes/tasks.js.
//
// Mirrors server/lib/googleTasksClient.js: same getAccessToken via SQL
// pgp_sym_decrypt (key never touches JS in plaintext form except ~1 RTT),
// the same call() wrapper with transparent 401-refresh-retry + 30s timeout,
// and it REUSES refreshAccessToken from googleTasksClient (no duplication).
//
// IMPORTANT: a token missing the calendar.events scope returns HTTP 403, NOT
// 401. We deliberately do NOT route 403 into the refresh path — refreshing a
// scope-less token yields another scope-less token, so it would just burn a
// refresh and 403 again. 403 surfaces to the caller as GoogleCalendarError so
// the route can return calendar_unavailable and prompt re-consent.
// ═══════════════════════════════════════════════════════════════════════════

import { config } from "../config.js";
import { refreshAccessToken } from "./googleTasksClient.js";

const CALENDAR_ID = "primary";
const EVENTS_URL = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
const EVENT_URL = (eventId) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`;

export class GoogleCalendarError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// Decrypt user's access token via SQL — never log it in plaintext.
async function getAccessToken(pool, userId) {
  const r = await pool.query(
    `SELECT access_token_encrypted
       FROM tasks.oauth_tokens
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
  if (!r.rows.length) {
    throw new GoogleCalendarError("no_oauth_token", 401, null);
  }
  const dec = await pool.query(
    `SELECT pgp_sym_decrypt($1::bytea, $2)::text AS token`,
    [r.rows[0].access_token_encrypted, config.supabasePgpEncryptKey],
  );
  const token = dec.rows[0]?.token;
  if (!token) throw new GoogleCalendarError("decrypt_failed", 500, null);
  return token;
}

// Generic Google Calendar API caller. Mirrors googleTasksClient.call():
//   - transparent 401-refresh retry (refresh access_token, replay once)
//   - 30s AbortController guard → google_timeout (504) instead of a hung worker
// 403 (missing calendar.events scope) is NOT refreshed — it surfaces as
// GoogleCalendarError so the route can prompt re-consent.
async function call({ pool, userId, method, url, body, timeoutMs = 30000 }) {
  const doFetch = (tok) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }).finally(() => clearTimeout(timer));
  };

  try {
    let token = await getAccessToken(pool, userId);
    let res = await doFetch(token);

    if (res.status === 401) {
      try {
        token = await refreshAccessToken(pool, userId);
        res = await doFetch(token);
      } catch {
        // Refresh itself failed — fall through with the original 401 below.
      }
    }

    if (res.status === 204) return null; // DELETE success
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new GoogleCalendarError(
        `google_calendar_http_${res.status}`,
        res.status,
        json,
      );
    }
    return json;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new GoogleCalendarError("google_timeout", 504, null);
    }
    throw err;
  }
}

// ─── Event time builders ───────────────────────────────────────────────────
// Google Calendar event times are either date-only (all-day) or dateTime+TZ.
//   all-day → { date: 'YYYY-MM-DD' }; end.date is EXCLUSIVE (next day).
//   timed   → { dateTime: 'YYYY-MM-DDTHH:MM:SS', timeZone: 'America/Montevideo' }
// dateTime is wall-clock (no 'Z'); Google applies timeZone. End = start +
// durationMin, computed on the naive wall-clock components so day/hour rollover
// is correct independent of the real offset.

function toDateStr(due) {
  if (due instanceof Date) return due.toISOString().slice(0, 10);
  return String(due).slice(0, 10);
}

function normalizeTime(t) {
  // Accept 'HH:MM' or 'HH:MM:SS' → 'HH:MM:SS'
  const parts = String(t).split(":");
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
  const s = String(parseInt(parts[2] || "0", 10) || 0).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function addDays(dateStr, days) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function addMinutesToWallClock(dateStr, timeStr, minutes) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi, s] = normalizeTime(timeStr).split(":").map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi, s) + minutes * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${end.getUTCFullYear()}-${p(end.getUTCMonth() + 1)}-${p(end.getUTCDate())}` +
    `T${p(end.getUTCHours())}:${p(end.getUTCMinutes())}:${p(end.getUTCSeconds())}`
  );
}

/**
 * Build { start, end } for a Calendar event from BMC's task fields.
 * @param {object} a
 * @param {string|Date} a.due       — task due date (required to pair an event)
 * @param {string|null} a.dueTime   — 'HH:MM' / 'HH:MM:SS' or null
 * @param {boolean} a.isAllDay
 * @param {string} [a.timeZone]
 * @param {number} [a.durationMin]
 */
export function buildEventTimes({
  due,
  dueTime,
  isAllDay,
  timeZone = config.googleCalendarTimeZone,
  durationMin = config.googleCalendarDefaultDurationMin || 30,
}) {
  const dateStr = toDateStr(due);
  if (isAllDay || !dueTime) {
    return {
      start: { date: dateStr },
      end: { date: addDays(dateStr, 1) }, // exclusive end
    };
  }
  const startTime = normalizeTime(dueTime);
  return {
    start: { dateTime: `${dateStr}T${startTime}`, timeZone },
    end: {
      dateTime: addMinutesToWallClock(dateStr, startTime, durationMin),
      timeZone,
    },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function createEvent({
  pool, userId, summary, description, start, end, recurrence,
}) {
  const body = { summary, start, end };
  if (description !== undefined && description !== null) body.description = description;
  if (Array.isArray(recurrence) && recurrence.length) body.recurrence = recurrence;
  return call({ pool, userId, method: "POST", url: EVENTS_URL, body });
}

export async function updateEvent({
  pool, userId, eventId, summary, description, start, end, recurrence,
}) {
  const body = {};
  if (summary !== undefined) body.summary = summary;
  if (description !== undefined) body.description = description;
  if (start !== undefined) body.start = start;
  if (end !== undefined) body.end = end;
  // recurrence: [] explicitly clears repeat; undefined leaves it untouched.
  if (recurrence !== undefined) body.recurrence = recurrence;
  return call({ pool, userId, method: "PATCH", url: EVENT_URL(eventId), body });
}

export async function deleteEvent({ pool, userId, eventId }) {
  return call({ pool, userId, method: "DELETE", url: EVENT_URL(eventId) });
}

export async function getEvent({ pool, userId, eventId }) {
  return call({ pool, userId, method: "GET", url: EVENT_URL(eventId) });
}
