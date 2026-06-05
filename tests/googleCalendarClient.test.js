import assert from "node:assert/strict";
import { buildEventTimes } from "../server/lib/googleCalendarClient.js";

{
  const result = buildEventTimes({
    due: "2026-06-05",
    dueTime: null,
    isAllDay: true,
    timeZone: "America/Montevideo",
    durationMin: 30,
  });

  assert.deepEqual(
    result,
    {
      start: { date: "2026-06-05" },
      end: { date: "2026-06-06" },
    },
    "all-day Calendar events must use an exclusive next-day end date",
  );
}

{
  const result = buildEventTimes({
    due: "2026-06-05T12:34:56.000Z",
    dueTime: "9:05",
    isAllDay: false,
    timeZone: "America/Montevideo",
    durationMin: 45,
  });

  assert.deepEqual(
    result,
    {
      start: {
        dateTime: "2026-06-05T09:05:00",
        timeZone: "America/Montevideo",
      },
      end: {
        dateTime: "2026-06-05T09:50:00",
        timeZone: "America/Montevideo",
      },
    },
    "timed Calendar events should normalize HH:MM and preserve the configured timezone",
  );
}

{
  const result = buildEventTimes({
    due: "2026-06-05",
    dueTime: "23:50:00",
    isAllDay: false,
    timeZone: "America/Montevideo",
    durationMin: 30,
  });

  assert.equal(
    result.end.dateTime,
    "2026-06-06T00:20:00",
    "timed event end should roll over to the next day when duration crosses midnight",
  );
}

console.log("googleCalendarClient tests OK (3/3)");
