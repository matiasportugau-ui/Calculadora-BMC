// ═══════════════════════════════════════════════════════════════════════════
// Offline regression tests for server/lib/googleCalendarClient.js
// Run: node tests/googleCalendarClient.test.js
//
// Covers the Phase D Tasks→Calendar mirror path without hitting Google:
//   - event time shape for all-day and timed tasks
//   - explicit recurrence clearing on PATCH
//   - 403 missing calendar scope does not refresh a token
//   - 401 refreshes once and retries the Calendar call
// ═══════════════════════════════════════════════════════════════════════════

import assert from "node:assert/strict";
import {
  GoogleCalendarError,
  buildEventTimes,
  createEvent,
  updateEvent,
} from "../server/lib/googleCalendarClient.js";
import { config } from "../server/config.js";

config.googleCalendarTimeZone = "America/Montevideo";
config.googleCalendarDefaultDurationMin = 30;
config.googleTasksClientId = "tasks-client.test";
config.googleTasksClientSecret = "tasks-secret.test";
config.supabasePgpEncryptKey = "pgp-test-key";

let passed = 0;
let failed = 0;

function assertTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}\n     ${err.stack || err.message}`);
  }
}

async function assertAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}\n     ${err.stack || err.message}`);
  }
}

function makeJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makePool({ accessToken = "old-access-token", refreshToken = "stored-refresh-token" } = {}) {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({ sql: String(sql), params });
      const norm = String(sql).replace(/\s+/g, " ").trim().toLowerCase();

      if (norm.startsWith("select access_token_encrypted")) {
        return { rows: [{ access_token_encrypted: "encrypted-access" }] };
      }
      if (norm.startsWith("select pgp_sym_decrypt($1::bytea")) {
        return { rows: [{ token: accessToken }] };
      }
      if (norm.startsWith("select pgp_sym_decrypt(refresh_token_encrypted::bytea")) {
        return { rows: [{ rt: refreshToken }] };
      }
      if (norm.startsWith("update tasks.oauth_tokens")) {
        return { rows: [] };
      }
      if (norm.startsWith("insert into tasks.sync_log")) {
        return { rows: [] };
      }

      throw new Error(`unhandled SQL in googleCalendarClient test: ${norm.slice(0, 120)}`);
    },
  };
}

const originalFetch = globalThis.fetch;

console.log("\n═══ googleCalendarClient — offline regressions ═══");

assertTest("buildEventTimes uses exclusive next-day end for all-day tasks", () => {
  assert.deepEqual(
    buildEventTimes({
      due: "2026-06-07",
      dueTime: null,
      isAllDay: true,
    }),
    {
      start: { date: "2026-06-07" },
      end: { date: "2026-06-08" },
    },
  );
});

assertTest("buildEventTimes preserves wall-clock timezone and rolls timed end over midnight", () => {
  assert.deepEqual(
    buildEventTimes({
      due: "2026-06-30",
      dueTime: "23:45",
      isAllDay: false,
      durationMin: 30,
    }),
    {
      start: {
        dateTime: "2026-06-30T23:45:00",
        timeZone: "America/Montevideo",
      },
      end: {
        dateTime: "2026-07-01T00:15:00",
        timeZone: "America/Montevideo",
      },
    },
  );
});

await assertAsync("updateEvent sends recurrence: [] to clear a repeated Calendar event", async () => {
  const pool = makePool();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return makeJsonResponse(200, { id: "event-1" });
  };

  try {
    const result = await updateEvent({
      pool,
      userId: "user-1",
      eventId: "event-1",
      summary: "Seguimiento",
      description: null,
      start: { date: "2026-06-07" },
      end: { date: "2026-06-08" },
      recurrence: [],
    });

    assert.equal(result.id, "event-1");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.method, "PATCH");
    assert.match(calls[0].url, /\/events\/event-1$/);
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      summary: "Seguimiento",
      description: null,
      start: { date: "2026-06-07" },
      end: { date: "2026-06-08" },
      recurrence: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await assertAsync("createEvent surfaces 403 calendar scope failures without refreshing token", async () => {
  const pool = makePool();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return makeJsonResponse(403, { error: { status: "PERMISSION_DENIED" } });
  };

  try {
    await assert.rejects(
      createEvent({
        pool,
        userId: "user-1",
        summary: "Llamar cliente",
        start: { date: "2026-06-07" },
        end: { date: "2026-06-08" },
      }),
      (err) => {
        assert.ok(err instanceof GoogleCalendarError);
        assert.equal(err.status, 403);
        assert.equal(err.message, "google_calendar_http_403");
        return true;
      },
    );

    assert.equal(calls.length, 1, "403 should not trigger OAuth refresh fetch");
    assert.ok(
      !pool.queries.some((q) => q.sql.includes("refresh_token_encrypted")),
      "403 must not read refresh_token_encrypted",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await assertAsync("createEvent refreshes once after 401 and retries with new access token", async () => {
  const pool = makePool();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("calendar/v3")) {
      if (calls.filter((c) => c.url.includes("calendar/v3")).length === 1) {
        return makeJsonResponse(401, { error: "expired" });
      }
      return makeJsonResponse(200, { id: "event-after-refresh" });
    }
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return makeJsonResponse(200, {
        access_token: "fresh-access-token",
        expires_in: 3600,
      });
    }
    throw new Error(`unexpected fetch URL: ${url}`);
  };

  try {
    const result = await createEvent({
      pool,
      userId: "user-1",
      summary: "Reunión",
      start: { dateTime: "2026-06-07T10:00:00", timeZone: "America/Montevideo" },
      end: { dateTime: "2026-06-07T10:30:00", timeZone: "America/Montevideo" },
    });

    assert.equal(result.id, "event-after-refresh");
    assert.deepEqual(
      calls.map((c) => c.url.includes("oauth2.googleapis.com/token") ? "token" : "calendar"),
      ["calendar", "token", "calendar"],
    );
    assert.equal(calls[0].init.headers.Authorization, "Bearer old-access-token");
    assert.equal(calls[2].init.headers.Authorization, "Bearer fresh-access-token");
    assert.ok(
      pool.queries.some((q) => q.sql.includes("refresh_token_encrypted")),
      "401 path reads refresh_token_encrypted",
    );
    assert.ok(
      pool.queries.some((q) => q.sql.includes("access_token_encrypted = pgp_sym_encrypt")),
      "401 path persists refreshed access token",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
