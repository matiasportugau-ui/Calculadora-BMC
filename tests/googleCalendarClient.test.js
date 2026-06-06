// ═══════════════════════════════════════════════════════════════════════════
// Unit tests — server/lib/googleCalendarClient.js
// Run: node tests/googleCalendarClient.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Covers the Phase D Google Calendar mirror used by Tareas rich fields:
// - Calendar event time serialization (all-day vs wall-clock timed events)
// - Event create/update/delete HTTP payloads
// - 401 refresh-and-retry path shared with googleTasksClient
// - 403 missing-scope path must NOT refresh a scope-less token

process.env.GOOGLE_TASKS_CLIENT_ID = "calendar-test-client.apps.googleusercontent.com";
process.env.GOOGLE_TASKS_CLIENT_SECRET = "calendar-test-secret";
process.env.SUPABASE_PGP_ENCRYPT_KEY = "calendar-test-pgp-key";
process.env.GOOGLE_CALENDAR_TIME_ZONE = "America/Montevideo";
process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MIN = "30";

const {
  GoogleCalendarError,
  buildEventTimes,
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
} = await import("../server/lib/googleCalendarClient.js");

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makePool({
  accessToken = "access-token",
  encryptedAccessToken = "encrypted-access-token",
  refreshToken = "refresh-token-valid",
} = {}) {
  const queries = [];
  const updates = [];
  const syncLogs = [];

  return {
    queries,
    updates,
    syncLogs,
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, " ").trim().toLowerCase();
      queries.push({ sql: norm, params });

      if (norm.startsWith("select access_token_encrypted")) {
        return { rows: [{ access_token_encrypted: encryptedAccessToken }] };
      }

      if (norm.includes("pgp_sym_decrypt(refresh_token_encrypted")) {
        return { rows: [{ rt: refreshToken }] };
      }

      if (norm.startsWith("select pgp_sym_decrypt($1::bytea")) {
        return { rows: [{ token: accessToken }] };
      }

      if (norm.startsWith("update tasks.oauth_tokens")) {
        updates.push(params);
        return { rows: [] };
      }

      if (norm.startsWith("insert into tasks.sync_log")) {
        syncLogs.push(params);
        return { rows: [] };
      }

      throw new Error(`unhandled SQL in test shim: ${norm.slice(0, 160)}`);
    },
  };
}

async function withMockedFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls.length);
  };
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function runEventTimeTests() {
  console.log("\n═══ SUITE: googleCalendarClient event time builders ═══");

  const allDay = buildEventTimes({
    due: "2026-06-06",
    dueTime: "09:30",
    isAllDay: true,
  });
  assert("all-day event uses date-only start", allDay.start.date === "2026-06-06", allDay.start, { date: "2026-06-06" });
  assert("all-day event uses exclusive next-day end", allDay.end.date === "2026-06-07", allDay.end, { date: "2026-06-07" });

  const timed = buildEventTimes({
    due: "2026-06-06",
    dueTime: "23:45",
    isAllDay: false,
  });
  assert(
    "timed event normalizes HH:MM to HH:MM:SS",
    timed.start.dateTime === "2026-06-06T23:45:00",
    timed.start,
    { dateTime: "2026-06-06T23:45:00" },
  );
  assert(
    "timed event adds default duration across midnight",
    timed.end.dateTime === "2026-06-07T00:15:00",
    timed.end,
    { dateTime: "2026-06-07T00:15:00" },
  );
  assert(
    "timed event carries configured timezone",
    timed.start.timeZone === "America/Montevideo" && timed.end.timeZone === "America/Montevideo",
    timed,
    "America/Montevideo",
  );
}

async function runCrudPayloadTests() {
  console.log("\n═══ SUITE: googleCalendarClient event CRUD payloads ═══");

  const pool = makePool({ accessToken: "calendar-access-token" });
  await withMockedFetch(
    (url, init, callNumber) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (callNumber === 1) {
        assert("createEvent posts to primary calendar events", url.endsWith("/calendar/v3/calendars/primary/events"), url, "/events");
        assert("createEvent uses bearer access token", init.headers.Authorization === "Bearer calendar-access-token", init.headers, "Bearer calendar-access-token");
        assert("createEvent includes recurrence when provided", body.recurrence?.[0] === "RRULE:FREQ=WEEKLY", body, "RRULE:FREQ=WEEKLY");
        return jsonResponse({ id: "evt-created" });
      }
      if (callNumber === 2) {
        assert("updateEvent PATCHes encoded event id", init.method === "PATCH" && url.endsWith("/events/evt%2Fneeds%20encoding"), { method: init.method, url }, "PATCH encoded id");
        assert("updateEvent preserves explicit recurrence clear", Array.isArray(body.recurrence) && body.recurrence.length === 0, body, { recurrence: [] });
        return jsonResponse({ id: "evt/needs encoding", updated: true });
      }
      if (callNumber === 3) {
        assert("deleteEvent DELETEs encoded event id", init.method === "DELETE" && url.endsWith("/events/evt%2Fneeds%20encoding"), { method: init.method, url }, "DELETE encoded id");
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected fetch call ${callNumber}`);
    },
    async () => {
      const start = { dateTime: "2026-06-06T10:00:00", timeZone: "America/Montevideo" };
      const end = { dateTime: "2026-06-06T10:30:00", timeZone: "America/Montevideo" };
      const created = await createEvent({
        pool,
        userId: "user-calendar-1",
        summary: "Llamar cliente",
        description: "Confirmar medidas",
        start,
        end,
        recurrence: ["RRULE:FREQ=WEEKLY"],
      });
      assert("createEvent returns parsed Google event", created.id === "evt-created", created, { id: "evt-created" });

      const updated = await updateEvent({
        pool,
        userId: "user-calendar-1",
        eventId: "evt/needs encoding",
        recurrence: [],
      });
      assert("updateEvent returns parsed Google event", updated.updated === true, updated, { updated: true });

      const deleted = await deleteEvent({
        pool,
        userId: "user-calendar-1",
        eventId: "evt/needs encoding",
      });
      assert("deleteEvent returns null on 204", deleted === null, deleted, null);
    },
  );
}

async function runRefreshRetryTest() {
  console.log("\n═══ SUITE: googleCalendarClient auth refresh behavior ═══");

  const pool = makePool({ accessToken: "expired-access-token" });
  await withMockedFetch(
    (url, init, callNumber) => {
      if (callNumber === 1) {
        assert("first Calendar call uses expired token", init.headers.Authorization === "Bearer expired-access-token", init.headers, "Bearer expired-access-token");
        return jsonResponse({ error: "expired" }, 401);
      }
      if (callNumber === 2) {
        assert("401 triggers OAuth token refresh endpoint", url === "https://oauth2.googleapis.com/token", url, "token endpoint");
        const body = init.body;
        assert("refresh request sends refresh_token grant", body.get("grant_type") === "refresh_token", body.toString(), "refresh_token");
        return jsonResponse({ access_token: "fresh-access-token", expires_in: 1800 });
      }
      if (callNumber === 3) {
        assert("Calendar request is retried with fresh token", init.headers.Authorization === "Bearer fresh-access-token", init.headers, "Bearer fresh-access-token");
        return jsonResponse({ id: "evt-after-refresh" });
      }
      throw new Error(`unexpected fetch call ${callNumber}`);
    },
    async (calls) => {
      const event = await getEvent({
        pool,
        userId: "user-calendar-refresh",
        eventId: "evt-refresh",
      });
      assert("getEvent succeeds after refresh retry", event.id === "evt-after-refresh", event, { id: "evt-after-refresh" });
      assert("refresh flow made exactly three HTTP calls", calls.length === 3, calls.length, 3);
      assert("refresh flow persisted new access token", pool.updates[0]?.[0] === "fresh-access-token", pool.updates, "fresh-access-token");
      assert("refresh flow writes sync log breadcrumb", pool.syncLogs.length === 1, pool.syncLogs.length, 1);
    },
  );
}

async function runForbiddenNoRefreshTest() {
  console.log("\n═══ SUITE: googleCalendarClient missing-scope behavior ═══");

  const pool = makePool({ accessToken: "tasks-only-token" });
  await withMockedFetch(
    () => jsonResponse({ error: { status: "PERMISSION_DENIED" } }, 403),
    async (calls) => {
      try {
        await createEvent({
          pool,
          userId: "user-no-calendar-scope",
          summary: "Tiene hora pero falta scope",
          start: { dateTime: "2026-06-06T09:00:00", timeZone: "America/Montevideo" },
          end: { dateTime: "2026-06-06T09:30:00", timeZone: "America/Montevideo" },
        });
        assert("403 path throws", false, "no error", "GoogleCalendarError");
      } catch (err) {
        assert("403 surfaces as GoogleCalendarError", err instanceof GoogleCalendarError, err?.constructor?.name, "GoogleCalendarError");
        assert("403 keeps original status", err.status === 403 && err.message === "google_calendar_http_403", { status: err.status, message: err.message }, { status: 403, message: "google_calendar_http_403" });
      }
      assert("403 missing-scope does not attempt refresh", calls.length === 1, calls.length, 1);
      assert("403 missing-scope does not persist token update", pool.updates.length === 0, pool.updates.length, 0);
    },
  );
}

async function runTimeoutMappingTest() {
  console.log("\n═══ SUITE: googleCalendarClient timeout mapping ═══");

  const pool = makePool();
  await withMockedFetch(
    () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    },
    async () => {
      try {
        await getEvent({ pool, userId: "user-timeout", eventId: "evt-timeout" });
        assert("AbortError path throws", false, "no error", "GoogleCalendarError");
      } catch (err) {
        assert("AbortError maps to google_timeout", err instanceof GoogleCalendarError && err.message === "google_timeout", { name: err?.constructor?.name, message: err?.message }, "google_timeout");
        assert("AbortError maps to 504", err.status === 504, err.status, 504);
      }
    },
  );
}

try {
  await runEventTimeTests();
  await runCrudPayloadTests();
  await runRefreshRetryTest();
  await runForbiddenNoRefreshTest();
  await runTimeoutMappingTest();
} catch (err) {
  console.error("Suite crashed:", err);
  process.exit(1);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
