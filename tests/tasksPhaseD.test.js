// Tasks Phase D - scheduling / Calendar pairing pure helper coverage.
// Run: node --test tests/tasksPhaseD.test.js

import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.APP_ENV = "test";

const { config } = await import("../server/config.js");
const { buildEventTimes } = await import("../server/lib/googleCalendarClient.js");
const tasks = await import("../server/routes/tasks.js");
const tasksSync = await import("../server/routes/tasksSync.js");

const {
  normalizeRecurrence,
  normalizeDueTime,
  classifyCalendarError,
  reconcileCalendarEvent,
} = tasks.__test__;

const { detectCalendarDrift, verifyHmacSignature } = tasksSync.__test__;

describe("Tasks Phase D rich scheduling helpers", () => {
  it("builds all-day Calendar event ranges with an exclusive end date", () => {
    assert.deepEqual(
      buildEventTimes({
        due: "2026-06-10",
        dueTime: null,
        isAllDay: true,
      }),
      {
        start: { date: "2026-06-10" },
        end: { date: "2026-06-11" },
      },
    );
  });

  it("builds timed Calendar event ranges with timezone and wall-clock rollover", () => {
    assert.deepEqual(
      buildEventTimes({
        due: "2026-06-10",
        dueTime: "23:45",
        isAllDay: false,
        timeZone: "America/Montevideo",
        durationMin: 30,
      }),
      {
        start: {
          dateTime: "2026-06-10T23:45:00",
          timeZone: "America/Montevideo",
        },
        end: {
          dateTime: "2026-06-11T00:15:00",
          timeZone: "America/Montevideo",
        },
      },
    );
  });

  it("normalizes due_time values and rejects invalid wall-clock inputs", () => {
    assert.equal(normalizeDueTime(null), null);
    assert.equal(normalizeDueTime(""), null);
    assert.equal(normalizeDueTime("9:05"), "09:05:00");
    assert.equal(normalizeDueTime("09:05:30"), "09:05:30");
    assert.equal(normalizeDueTime("25:00"), undefined);
    assert.equal(normalizeDueTime("09:60"), undefined);
    assert.equal(normalizeDueTime("9:5"), undefined);
  });

  it("normalizes recurrence aliases to stored RRULE values", () => {
    assert.equal(normalizeRecurrence(null), null);
    assert.equal(normalizeRecurrence("none"), null);
    assert.equal(normalizeRecurrence("does_not_repeat"), null);
    assert.equal(normalizeRecurrence(" weekly "), "RRULE:FREQ=WEEKLY");
    assert.equal(normalizeRecurrence("RRULE:FREQ=DAILY;COUNT=3"), "RRULE:FREQ=DAILY;COUNT=3");
    assert.equal(normalizeRecurrence("sometimes"), null);
  });

  it("classifies Calendar failures into frontend-safe soft error codes", () => {
    assert.equal(classifyCalendarError({ status: 403 }), "calendar_scope_missing");
    assert.equal(classifyCalendarError({ status: 504 }), "calendar_timeout");
    assert.equal(classifyCalendarError({ message: "google_timeout" }), "calendar_timeout");
    assert.equal(classifyCalendarError({ message: "no_oauth_token" }), "calendar_not_connected");
    assert.equal(classifyCalendarError(new Error("boom")), "calendar_unavailable");
  });

  it("honors the Calendar kill switch without throwing or clearing an existing link", async () => {
    const previous = config.googleCalendarEnabled;
    config.googleCalendarEnabled = false;
    try {
      await assert.doesNotReject(
        reconcileCalendarEvent({
          pool: null,
          userId: "user-1",
          existingEventId: "event-123",
          title: "Follow up",
          notes: null,
          due: "2026-06-10",
          dueTime: "10:00:00",
          isAllDay: false,
          recurrenceRule: "RRULE:FREQ=WEEKLY",
        }),
      );
      assert.deepEqual(
        await reconcileCalendarEvent({
          pool: null,
          userId: "user-1",
          existingEventId: "event-123",
          title: "Follow up",
          notes: null,
          due: "2026-06-10",
          dueTime: "10:00:00",
          isAllDay: false,
          recurrenceRule: "RRULE:FREQ=WEEKLY",
        }),
        { calendarEventId: "event-123", calendarError: null },
      );
    } finally {
      config.googleCalendarEnabled = previous;
    }
  });
});

describe("Tasks Phase D sync drift and scheduler auth helpers", () => {
  it("detects missing Calendar events", () => {
    assert.equal(
      detectCalendarDrift(
        { is_all_day: false, due_time: "10:00:00", recurrence_rule: null },
        null,
      ),
      "event_missing",
    );
  });

  it("detects all-day, time, and recurrence drift", () => {
    assert.equal(
      detectCalendarDrift(
        { is_all_day: true, due_time: null, recurrence_rule: null },
        { start: { dateTime: "2026-06-10T10:00:00" } },
      ),
      "all_day_mismatch",
    );
    assert.equal(
      detectCalendarDrift(
        { is_all_day: false, due_time: "10:00:00", recurrence_rule: null },
        { start: { dateTime: "2026-06-10T11:00:00" } },
      ),
      "time_mismatch",
    );
    assert.equal(
      detectCalendarDrift(
        { is_all_day: false, due_time: "10:00:00", recurrence_rule: "RRULE:FREQ=WEEKLY" },
        {
          start: { dateTime: "2026-06-10T10:00:00" },
          recurrence: ["RRULE:FREQ=MONTHLY"],
        },
      ),
      "recurrence_mismatch",
    );
  });

  it("does not report drift when all-day/time/recurrence match", () => {
    assert.equal(
      detectCalendarDrift(
        { is_all_day: false, due_time: "10:00:00", recurrence_rule: "rrule:freq=weekly" },
        {
          start: { dateTime: "2026-06-10T10:00:00" },
          recurrence: ["RRULE:FREQ=WEEKLY"],
        },
      ),
      null,
    );
    assert.equal(
      detectCalendarDrift(
        { is_all_day: true, due_time: null, recurrence_rule: null },
        { start: { date: "2026-06-10" } },
      ),
      null,
    );
  });

  it("verifies scheduler signatures in constant-time safe shape", () => {
    assert.equal(verifyHmacSignature("secret-token", "secret-token"), true);
    assert.equal(verifyHmacSignature("secret-token", "wrong-token"), false);
    assert.equal(verifyHmacSignature("short", "secret-token"), false);
    assert.equal(verifyHmacSignature("", "secret-token"), false);
    assert.equal(verifyHmacSignature("secret-token", ""), false);
  });
});
